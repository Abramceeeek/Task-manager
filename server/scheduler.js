const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('./db');

const SOLVER_URL = process.env.SOLVER_URL || 'http://solver:8001';

router.post('/plan', async (req, res) => {
  try {
    const { user_id = 1, date, timezone = 'Europe/London' } = req.body;
    
    const tasks = db.prepare(`
      SELECT * FROM tasks 
      WHERE user_id = ? AND status != 'done' 
      ORDER BY priority DESC, created_at ASC
    `).all(user_id);

    const prefs = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(user_id);
    const defaultPrefs = {
      work_hours_by_day: JSON.parse(prefs?.work_hours_by_day || '{"monday":"09:00-18:00","tuesday":"09:00-18:00","wednesday":"09:00-18:00","thursday":"09:00-18:00","friday":"09:00-18:00"}'),
      buffer_min: prefs?.buffer_min || 15,
      meeting_gap_min: prefs?.meeting_gap_min || 10,
      sleep_window: prefs?.sleep_window || '22:00-07:00',
      travel_speed_kmh: prefs?.travel_speed_kmh || 5,
      energy_profile_by_hour: JSON.parse(prefs?.energy_profile_by_hour || '{}'),
      avoid_times: JSON.parse(prefs?.avoid_times || '[]'),
      weights: JSON.parse(prefs?.weights || '{}')
    };

    const fixedEvents = db.prepare(`
      SELECT * FROM calendar_events 
      WHERE user_id = ? AND start_dt >= ? AND end_dt <= ?
    `).all(user_id, `${date}T00:00:00`, `${date}T23:59:59`);

    const requestData = {
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        duration_min: task.estimated_minutes || 60,
        priority: priorityToNumber(task.priority),
        energy: task.energy,
        deadline_dt: task.deadline_at,
        earliest_start_dt: task.start_after,
        latest_end_dt: task.due_at,
        hard_fixed: task.hard_fixed,
        location: task.location
      })),
      fixed_events: fixedEvents.map(event => ({
        id: event.id,
        start_dt: event.start_dt,
        end_dt: event.end_dt,
        title: event.title || 'Fixed Event',
        is_blocking: event.is_blocking,
        is_commute: event.is_commute,
        location: event.location
      })),
      prefs: defaultPrefs,
      date: date,
      timezone: timezone
    };

    const solverResponse = await axios.post(`${SOLVER_URL}/solve`, requestData, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    const proposedEvents = solverResponse.data.proposed_events || [];
    
    const diff = generateDiff(proposedEvents, user_id, date);
    
    res.json({
      success: true,
      proposed_events: proposedEvents,
      diff: diff,
      tasks_count: tasks.length,
      fixed_events_count: fixedEvents.length
    });

  } catch (error) {
    console.error('Planning error:', error);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.json({
        success: false,
        error: 'Solver service unavailable. Using fallback planner.',
        fallback_plan: fallbackPlan(req.body.user_id || 1, req.body.date)
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      fallback_plan: fallbackPlan(req.body.user_id || 1, req.body.date)
    });
  }
});

router.post('/apply', async (req, res) => {
  try {
    const { user_id = 1, idempotency_key, dry_run = false } = req.body;
    
    if (!idempotency_key) {
      return res.status(400).json({ error: 'Idempotency key required' });
    }

    const existing = db.prepare(`
      SELECT * FROM blocks WHERE user_id = ? AND idempotency_key = ?
    `).get(user_id, idempotency_key);

    if (existing) {
      return res.json({ 
        success: true, 
        message: 'Already applied',
        blocks: JSON.parse(existing.blocks_data)
      });
    }

    const proposedEvents = req.body.proposed_events || [];
    
    if (dry_run) {
      return res.json({
        success: true,
        dry_run: true,
        would_create: proposedEvents.length,
        diff: generateDiff(proposedEvents, user_id, req.body.date)
      });
    }

    const createdBlocks = [];
    const stmt = db.prepare(`
      INSERT INTO blocks (task_id, user_id, title, start, end, idempotency_key, blocks_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const event of proposedEvents) {
      const result = stmt.run(
        event.task_id,
        user_id,
        event.title,
        event.start_dt,
        event.end_dt,
        idempotency_key,
        JSON.stringify(proposedEvents)
      );
      
      createdBlocks.push({
        id: result.lastInsertRowid,
        task_id: event.task_id,
        title: event.title,
        start: event.start_dt,
        end: event.end_dt
      });
    }

    if (process.env.FEATURE_CALENDAR === '1') {
      await syncToCalendar(createdBlocks, user_id);
    }

    res.json({
      success: true,
      blocks: createdBlocks,
      count: createdBlocks.length
    });

  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ error: error.message });
  }
});

function priorityToNumber(priority) {
  switch (priority) {
    case 'high': return 0.9;
    case 'medium': return 0.5;
    case 'low': return 0.1;
    default: return 0.5;
  }
}

function generateDiff(proposedEvents, userId, date) {
  const existingBlocks = db.prepare(`
    SELECT * FROM blocks 
    WHERE user_id = ? AND DATE(start) = ?
  `).all(userId, date);

  const added = proposedEvents.filter(event => 
    !existingBlocks.some(block => 
      block.task_id === event.task_id && 
      block.start === event.start_dt
    )
  );

  const moved = [];
  const conflicts = [];

  return {
    added: added.map(event => ({
      title: event.title,
      start: event.start_dt,
      end: event.end_dt,
      reason: event.reason || 'Scheduled by AI'
    })),
    moved,
    conflicts,
    summary: `Will add ${added.length} new time blocks`
  };
}

function fallbackPlan(userId, date) {
  const tasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE user_id = ? AND status != 'done' 
    ORDER BY priority DESC, created_at ASC
    LIMIT 5
  `).all(userId);

  const prefs = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(userId);
  const workStart = '09:00';
  const workEnd = '18:00';
  const bufferMin = prefs?.buffer_min || 15;

  const blocks = [];
  let currentTime = new Date(`${date}T${workStart}:00`);
  const endTime = new Date(`${date}T${workEnd}:00`);

  for (const task of tasks) {
    if (currentTime >= endTime) break;
    
    const duration = task.estimated_minutes || 60;
    const endTimeForTask = new Date(currentTime.getTime() + duration * 60000);
    
    if (endTimeForTask <= endTime) {
      blocks.push({
        task_id: task.id,
        title: task.title,
        start_dt: currentTime.toISOString(),
        end_dt: endTimeForTask.toISOString(),
        reason: 'Fallback scheduling'
      });
      
      currentTime = new Date(endTimeForTask.getTime() + bufferMin * 60000);
    }
  }

  return {
    proposed_events: blocks,
    diff: generateDiff(blocks, userId, date)
  };
}

async function syncToCalendar(blocks, userId) {
  if (process.env.FEATURE_CALENDAR !== '1') return;
  
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    for (const block of blocks) {
      await calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary: block.title,
          start: { dateTime: block.start },
          end: { dateTime: block.end },
          description: `Scheduled by Motion AI Task Manager`
        }
      });
    }
  } catch (error) {
    console.error('Calendar sync error:', error);
  }
}

module.exports = router;