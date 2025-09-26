const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'tasks.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      timezone TEXT DEFAULT 'Europe/London',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      project_id INTEGER,
      user_id INTEGER,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
      estimated_minutes INTEGER,
      due_at DATETIME,
      deadline_at DATETIME,
      start_after DATETIME,
      energy TEXT DEFAULT 'light' CHECK (energy IN ('deep', 'light')),
      location TEXT,
      hard_fixed BOOLEAN DEFAULT 0,
      recur_rule TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      user_id INTEGER,
      title TEXT NOT NULL,
      start DATETIME NOT NULL,
      end DATETIME NOT NULL,
      idempotency_key TEXT,
      blocks_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      work_hours_by_day TEXT DEFAULT '{"monday":"09:00-18:00","tuesday":"09:00-18:00","wednesday":"09:00-18:00","thursday":"09:00-18:00","friday":"09:00-18:00","saturday":"","sunday":""}',
      buffer_min INTEGER DEFAULT 15,
      meeting_gap_min INTEGER DEFAULT 10,
      sleep_window TEXT DEFAULT '22:00-07:00',
      travel_speed_kmh INTEGER DEFAULT 5,
      energy_profile_by_hour TEXT DEFAULT '{"09:00":0.8,"10:00":0.9,"11:00":0.9,"12:00":0.7,"13:00":0.6,"14:00":0.7,"15:00":0.8,"16:00":0.8,"17:00":0.7,"18:00":0.6}',
      avoid_times TEXT DEFAULT '[]',
      objective TEXT,
      weights TEXT DEFAULT '{"deep_work_morning":0.5,"context_switching":0.3,"after_hours":0.2}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      provider TEXT DEFAULT 'google',
      external_id TEXT,
      title TEXT,
      start_dt DATETIME NOT NULL,
      end_dt DATETIME NOT NULL,
      location TEXT,
      is_blocking BOOLEAN DEFAULT 1,
      is_commute BOOLEAN DEFAULT 0,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      kind TEXT CHECK (kind IN ('user_edit', 'completion', 'lateness')),
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at 
    AFTER UPDATE ON tasks 
    BEGIN 
      UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
};

initTables();

module.exports = db;