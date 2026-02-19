-- Migration 001: Create tasks table and queue_config table
-- Run this to initialize the database schema

-- Tasks table: stores all task queue items
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'queued', 'running', 'done', 'failed', 'cancelled')),
  workflow TEXT DEFAULT 'feature-dev',
  target_repo TEXT,
  scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  antfarm_run_id TEXT,
  queue_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_queue_order ON tasks(queue_order);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow ON tasks(workflow);

-- Queue config table: stores queue state (running/paused) and max concurrent runs
CREATE TABLE IF NOT EXISTS queue_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT DEFAULT 'running' CHECK (state IN ('running', 'paused')),
  max_concurrent INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default queue config
INSERT OR IGNORE INTO queue_config (id, state, max_concurrent) VALUES (1, 'running', 1);
