const express = require('express');
const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const { db } = require('./db');
const { DateTime } = require('luxon');

const router = express.Router();

// Environment configuration
const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8001';
const FEATURE_CALENDAR = parseInt(process.env.FEATURE_CALENDAR || '0', 10) === 1;

// Store the last plan for apply operation
let lastPlanResult = null;

// Helper functions
const calculateResponseHash = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

const callSolver = async (requestData) => {
  try {
    const response = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Solver responded with ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Solver request failed:', error);
    throw new Error(`Solver unavailable: ${error.message}`);
  }
};

const formatTimeForUI = (isoString) => {
  try {
    return DateTime.fromISO(isoString).setZone('Europe/London').toFormat('HH:mm');
  } catch (e) {
    return isoString;
  }
};

const formatDateTimeForUI = (isoString) => {
  try {
    return DateTime.fromISO(isoString).setZone('Europe/London').toFormat('MMM dd, HH:mm');
  } catch (e) {
    return isoString;
  }
};

const generatePlanDiff = (proposedBlocks, existingBlocks) => {
  const diff = {
    added: [],
    moved: [],
    conflicts: [],
    buffers: []
  };

  const existing = existingBlocks.filter(b => b.block_type !== 'buffer');
  const proposed = proposedBlocks.filter(b => b.block_type === 'task');
  const proposedBuffers = proposedBlocks.filter(b => b.block_type === 'buffer');

  // Find added tasks (in proposed but not in existing)
  for (const prop of proposed) {
    const existingMatch = existing.find(ex => ex.task_id === prop.task_id);
    if (!existingMatch) {
      diff.added.push({
        task_id: prop.task_id,
        title: prop.title,
        start: formatDateTimeForUI(prop.start),
        end: formatDateTimeForUI(prop.end),
        duration: Math.round((new Date(prop.end) - new Date(prop.start)) / 60000)
      });
    } else {
      // Check if moved (different time)
      const existingStart = new Date(existingMatch.start);
      const proposedStart = new Date(prop.start);

      if (Math.abs(existingStart - proposedStart) > 60000) { // More than 1 minute difference
        diff.moved.push({
          task_id: prop.task_id,
          title: prop.title,
          from: formatDateTimeForUI(existingMatch.start),
          to: formatDateTimeForUI(prop.start),
          duration: Math.round((new Date(prop.end) - new Date(prop.start)) / 60000)
        });
      }
    }
  }

  // Check for conflicts (overlapping times)
  for (let i = 0; i < proposed.length - 1; i++) {
    const current = proposed[i];
    const next = proposed[i + 1];

    if (new Date(current.end) > new Date(next.start)) {
      diff.conflicts.push({
        task1: current.title,
        task2: next.title,
        overlap: 'Scheduling conflict detected'
      });
    }
  }

  // Add buffer information
  diff.buffers = proposedBuffers.map(buffer => ({
    title: buffer.title,
    start: formatTimeForUI(buffer.start),
    end: formatTimeForUI(buffer.end),
    duration: Math.round((new Date(buffer.end) - new Date(buffer.start)) / 60000)
  }));

  return diff;
};

// Preferences endpoints
router.get('/prefs', (req, res) => {
  try {
    const prefs = db.prepare('SELECT * FROM preferences WHERE id = ?').get('default');
    if (!prefs) {
      return res.json({
        work_start: '09:00',
        work_end: '17:00',
        buffer_minutes: 15,
        deep_work_morning: 0.6,
        allow_overtime: false,
        max_overtime_minutes: 120
      });
    }

    res.json({
      work_start: prefs.work_start,
      work_end: prefs.work_end,
      buffer_minutes: prefs.buffer_minutes,
      deep_work_morning: prefs.deep_work_morning,
      allow_overtime: Boolean(prefs.allow_overtime),
      max_overtime_minutes: prefs.max_overtime_minutes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/prefs', (req, res) => {
  try {
    const {
      work_start = '09:00',
      work_end = '17:00',
      buffer_minutes = 15,
      deep_work_morning = 0.6,
      allow_overtime = false,
      max_overtime_minutes = 120
    } = req.body;

    db.prepare(`
      INSERT OR REPLACE INTO preferences
      (id, work_start, work_end, buffer_minutes, deep_work_morning, allow_overtime, max_overtime_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('default', work_start, work_end, buffer_minutes, deep_work_morning, allow_overtime ? 1 : 0, max_overtime_minutes);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enhanced scheduling endpoints
router.post('/schedule/plan', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get preferences
    const prefs = db.prepare('SELECT * FROM preferences WHERE id = ?').get('default') || {};

    // Get tasks for scheduling (todo status only)
    const tasks = db.prepare('SELECT * FROM tasks WHERE status = ?').all('todo');

    // Get existing blocks for the date to show diff
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const existingBlocks = db.prepare('SELECT * FROM blocks WHERE start >= ? AND start <= ?').all(dayStart, dayEnd);

    // Prepare solver request
    const solverRequest = {
      date: `${date}T09:00:00`, // Default start time
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        estimated_minutes: task.estimated_minutes || 30,
        priority: task.priority === 1 ? 0.9 : task.priority === 3 ? 0.3 : 0.6,
        due_at: task.due_at,
        start_after: task.start_after,
        task_type: task.estimated_minutes > 90 ? 'deep_work' : 'general'
      })),
      fixed_events: [], // Could be populated from calendar integration
      preferences: {
        work_start: prefs.work_start || '09:00',
        work_end: prefs.work_end || '17:00',
        buffer_minutes: prefs.buffer_minutes || 15,
        deep_work_morning: prefs.deep_work_morning || 0.6,
        allow_overtime: Boolean(prefs.allow_overtime || false),
        max_overtime_minutes: prefs.max_overtime_minutes || 120
      }
    };

    // Call solver
    const solverResult = await callSolver(solverRequest);

    if (!solverResult.success) {
      return res.status(400).json({
        error: 'Could not generate schedule',
        details: solverResult.messages,
        stats: solverResult.stats
      });
    }

    // Generate human-readable diff
    const diff = generatePlanDiff(solverResult.scheduled_blocks, existingBlocks);

    // Store result for later apply
    lastPlanResult = {
      date,
      solverResult,
      timestamp: Date.now()
    };

    res.json({
      success: true,
      date,
      diff,
      stats: {
        ...solverResult.stats,
        total_blocks: solverResult.scheduled_blocks.length,
        unscheduled_count: solverResult.unscheduled_tasks.length
      },
      unscheduled_tasks: solverResult.unscheduled_tasks,
      messages: solverResult.messages
    });

  } catch (err) {
    console.error('Plan generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/schedule/apply', async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'X-Idempotency-Key header required' });
    }

    // Check if this key was already processed
    const existing = db.prepare('SELECT * FROM idempotency_keys WHERE key = ?').get(idempotencyKey);
    if (existing) {
      return res.json({
        success: true,
        applied: false,
        message: 'Operation already applied',
        hash: existing.response_hash
      });
    }

    if (!lastPlanResult || (Date.now() - lastPlanResult.timestamp) > 300000) { // 5 minutes
      return res.status(400).json({ error: 'No recent plan found or plan expired. Generate a new plan first.' });
    }

    const { date, solverResult } = lastPlanResult;

    // Clear existing blocks for the date
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    db.prepare('DELETE FROM blocks WHERE start >= ? AND start <= ?').run(dayStart, dayEnd);

    // Insert new blocks
    const insertBlock = db.prepare(`
      INSERT INTO blocks (id, task_id, title, start, end, block_type, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    for (const block of solverResult.scheduled_blocks) {
      insertBlock.run(
        uuid(),
        block.task_id || null,
        block.title,
        block.start,
        block.end,
        block.block_type || 'task',
        block.confidence || 1.0
      );
      insertedCount++;
    }

    // Google Calendar integration (if enabled)
    let calendarResult = null;
    if (FEATURE_CALENDAR === 1) {
      try {
        // Placeholder for Google Calendar integration
        // In a real implementation, you'd use google-auth-library and googleapis
        console.log('Calendar integration would sync blocks to Google Calendar here');
        calendarResult = { synced: insertedCount, message: 'Calendar sync not implemented' };
      } catch (calError) {
        console.error('Calendar sync failed:', calError);
        calendarResult = { error: calError.message };
      }
    }

    // Calculate response hash for idempotency
    const responseData = {
      applied: true,
      blocks_inserted: insertedCount,
      calendar: calendarResult
    };
    const responseHash = calculateResponseHash(responseData);

    // Store idempotency key
    db.prepare('INSERT INTO idempotency_keys (key, response_hash) VALUES (?, ?)').run(idempotencyKey, responseHash);

    res.json({
      success: true,
      ...responseData,
      hash: responseHash
    });

  } catch (err) {
    console.error('Apply schedule error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telemetry endpoint
router.post('/telemetry', (req, res) => {
  try {
    const { event_type, data } = req.body;
    if (!event_type || !data) {
      return res.status(400).json({ error: 'event_type and data are required' });
    }

    const id = uuid();
    db.prepare('INSERT INTO telemetry (id, event_type, data) VALUES (?, ?, ?)').run(
      id,
      event_type,
      JSON.stringify(data)
    );

    // Simple learning logic for deep_work_morning preference
    if (event_type === 'drag_move' && data.task_type === 'deep_work') {
      const moveTime = new Date(data.new_start);
      const isMorning = moveTime.getHours() < 12;

      if (isMorning) {
        // User moved deep work to morning - increase morning preference
        const currentPrefs = db.prepare('SELECT * FROM preferences WHERE id = ?').get('default');
        if (currentPrefs) {
          const currentWeight = currentPrefs.deep_work_morning;
          const newWeight = Math.min(1.0, currentWeight * 0.8 + 0.2 * 0.8); // EWMA: 0.8 old + 0.2 * observed (0.8 for morning)

          db.prepare('UPDATE preferences SET deep_work_morning = ?, updated_at = datetime("now") WHERE id = ?')
            .run(newWeight, 'default');

          console.log(`Updated deep_work_morning preference: ${currentWeight} -> ${newWeight}`);
        }
      }
    }

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Calendar endpoints (placeholder for Google Calendar integration)
router.get('/calendar/events', async (req, res) => {
  try {
    if (!FEATURE_CALENDAR) {
      return res.json({ events: [], message: 'Calendar integration disabled' });
    }

    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query parameters required' });
    }

    // Placeholder - in real implementation, fetch from Google Calendar API
    const events = [
      {
        id: 'placeholder',
        title: 'Calendar integration not implemented',
        start: from,
        end: to,
        source: 'placeholder'
      }
    ];

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;