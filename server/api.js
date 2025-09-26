const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/projects', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/projects', (req, res) => {
  try {
    const { name, user_id = 1 } = req.body;
    const stmt = db.prepare('INSERT INTO projects (name, user_id) VALUES (?, ?)');
    const result = stmt.run(name, user_id);
    res.json({ id: result.lastInsertRowid, name, user_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const { status, priority, project_id } = req.query;
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    if (project_id) {
      query += ' AND project_id = ?';
      params.push(project_id);
    }

    query += ' ORDER BY created_at DESC';
    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', (req, res) => {
  try {
    const {
      title,
      description,
      project_id,
      priority = 'medium',
      status = 'todo',
      estimated_minutes,
      due_at,
      deadline_at,
      start_after,
      energy = 'light',
      location,
      hard_fixed = false,
      recur_rule,
      tags,
      user_id = 1
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO tasks (
        title, description, project_id, priority, status, estimated_minutes,
        due_at, deadline_at, start_after, energy, location, hard_fixed,
        recur_rule, tags, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title, description, project_id, priority, status, estimated_minutes,
      due_at, deadline_at, start_after, energy, location, hard_fixed,
      recur_rule, tags, user_id
    );

    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const stmt = db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/blocks', (req, res) => {
  try {
    const { from, to, user_id = 1 } = req.query;
    let query = 'SELECT * FROM blocks WHERE user_id = ?';
    const params = [user_id];

    if (from) {
      query += ' AND start >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND end <= ?';
      params.push(to);
    }

    query += ' ORDER BY start ASC';
    const blocks = db.prepare(query).all(...params);
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/blocks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM blocks WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/prefs', (req, res) => {
  try {
    const { user_id = 1 } = req.query;
    const prefs = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(user_id);
    res.json(prefs || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/prefs', (req, res) => {
  try {
    const { user_id = 1 } = req.body;
    const updates = req.body;
    delete updates.user_id;

    const existing = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(user_id);
    
    if (existing) {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const stmt = db.prepare(`UPDATE preferences SET ${setClause} WHERE user_id = ?`);
      stmt.run(...values, user_id);
    } else {
      const stmt = db.prepare('INSERT INTO preferences (user_id, work_hours_by_day, buffer_min, meeting_gap_min, sleep_window, travel_speed_kmh, energy_profile_by_hour, avoid_times, objective, weights) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run(user_id, updates.work_hours_by_day || '{}', updates.buffer_min || 15, updates.meeting_gap_min || 10, updates.sleep_window || '22:00-07:00', updates.travel_speed_kmh || 5, updates.energy_profile_by_hour || '{}', updates.avoid_times || '[]', updates.objective || '', updates.weights || '{}');
    }

    const updated = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(user_id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/telemetry', (req, res) => {
  try {
    const { user_id = 1, kind, payload } = req.body;
    const stmt = db.prepare('INSERT INTO telemetry (user_id, kind, payload) VALUES (?, ?, ?)');
    stmt.run(user_id, kind, JSON.stringify(payload));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;