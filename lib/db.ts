import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'task-queue.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Initialize schema if tables don't exist
  initializeSchema(db);

  return db;
}

function initializeSchema(database: Database.Database): void {
  // Create tasks table
  database.exec(`
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
  `);

  // Create index for queue ordering
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_queue_order ON tasks(status, queue_order);
  `);

  // Create index for status filtering
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);

  // Create index for priority filtering
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
  `);

  // Create index for workflow filtering
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_workflow ON tasks(workflow);
  `);

  // Create queue_config table for queue state (using paused as INTEGER 0/1)
  database.exec(`
    CREATE TABLE IF NOT EXISTS queue_config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      paused INTEGER DEFAULT 0 CHECK (paused IN (0, 1)),
      max_concurrent INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default queue config if not exists
  database.exec(`
    INSERT OR IGNORE INTO queue_config (id, paused, max_concurrent) VALUES (1, 0, 1);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Export types for TypeScript
export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'backlog' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  workflow: string;
  target_repo: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  antfarm_run_id: string | null;
  queue_order: number;
  created_at: string;
  updated_at: string;
}

export interface QueueConfig {
  id: number;
  paused: number; // 0 or 1
  max_concurrent: number;
  updated_at: string;
}

// Queue management helpers
export function getQueueStatus(): { paused: boolean; runningCount: number; maxConcurrent: number } {
  const database = getDb();
  
  const config = database.prepare('SELECT paused, max_concurrent FROM queue_config WHERE id = 1').get() as QueueConfig;
  const runningCount = database.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'running'").get() as { count: number };
  
  return {
    paused: config.paused === 1,
    runningCount: runningCount.count,
    maxConcurrent: config.max_concurrent
  };
}

export function setQueuePaused(paused: boolean): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare('UPDATE queue_config SET paused = ?, updated_at = ? WHERE id = 1').run(paused ? 1 : 0, now);
}

export function reorderTasks(orders: { id: string; order: number }[]): void {
  const database = getDb();
  const updateStmt = database.prepare('UPDATE tasks SET queue_order = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();
  
  database.transaction(() => {
    for (const { id, order } of orders) {
      updateStmt.run(order, now, id);
    }
  })();
}

export function getNextQueuedTask(): Task | null {
  const database = getDb();
  
  const task = database.prepare(`
    SELECT * FROM tasks 
    WHERE status = 'queued' 
    ORDER BY queue_order ASC, created_at ASC 
    LIMIT 1
  `).get() as Task | undefined;
  
  return task ?? null;
}

export function updateTaskQueueOrder(id: string, queueOrder: number): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare('UPDATE tasks SET queue_order = ?, updated_at = ? WHERE id = ?').run(queueOrder, now, id);
}
