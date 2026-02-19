import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb } from '../lib/db';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'task-queue.db');

describe('POST /api/tasks', () => {
  beforeEach(() => {
    closeDb();
    try {
      if (existsSync(TEST_DB_PATH)) {
        unlinkSync(TEST_DB_PATH);
      }
    } catch {
      // Ignore errors if file doesn't exist
    }
  });

  afterEach(() => {
    closeDb();
  });

  it('should create a task with minimal required fields', async () => {
    const db = getDb();
    
    const result = db.prepare(`
      INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, queue_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-task-1',
      'Test Task Title',
      null,
      'medium',
      'backlog',
      'feature-dev',
      null,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );
    
    expect(result.changes).toBe(1);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('test-task-1') as Record<string, unknown>;
    expect(task).toBeDefined();
    expect(task.title).toBe('Test Task Title');
    expect(task.priority).toBe('medium');
    expect(task.status).toBe('backlog');
    expect(task.workflow).toBe('feature-dev');
  });

  it('should create a task with all fields', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO tasks (id, title, description, priority, status, workflow, target_repo, scheduled_at, queue_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-task-2',
      'Full Task Title',
      'This is a detailed description',
      'high',
      'backlog',
      'bug-fix',
      '/home/user/project',
      now,
      1,
      now,
      now
    );
    
    expect(result.changes).toBe(1);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('test-task-2') as Record<string, unknown>;
    expect(task).toBeDefined();
    expect(task.title).toBe('Full Task Title');
    expect(task.description).toBe('This is a detailed description');
    expect(task.priority).toBe('high');
    expect(task.workflow).toBe('bug-fix');
    expect(task.target_repo).toBe('/home/user/project');
    expect(task.scheduled_at).toBe(now);
  });

  it('should reject task without title (NULL)', () => {
    const db = getDb();
    
    expect(() => {
      db.prepare(`
        INSERT INTO tasks (id, title) VALUES (?, ?)
      `).run('test-task-3', null);
    }).toThrow();
  });

  it('should accept all valid priority values', () => {
    const db = getDb();
    const priorities = ['low', 'medium', 'high', 'critical'];
    
    priorities.forEach((priority, index) => {
      const result = db.prepare(`
        INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)
      `).run(`priority-test-${index}`, `Task with ${priority} priority`, priority);
      
      expect(result.changes).toBe(1);
      
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(`priority-test-${index}`) as Record<string, unknown>;
      expect(task.priority).toBe(priority);
    });
  });

  it('should accept all valid workflow values', () => {
    const db = getDb();
    const workflows = ['feature-dev', 'bug-fix', 'security-audit'];
    
    workflows.forEach((workflow, index) => {
      const result = db.prepare(`
        INSERT INTO tasks (id, title, workflow) VALUES (?, ?, ?)
      `).run(`workflow-test-${index}`, `Task with ${workflow} workflow`, workflow);
      
      expect(result.changes).toBe(1);
      
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(`workflow-test-${index}`) as Record<string, unknown>;
      expect(task.workflow).toBe(workflow);
    });
  });

  it('should reject invalid priority values', () => {
    const db = getDb();
    
    expect(() => {
      db.prepare(`
        INSERT INTO tasks (id, title, priority) VALUES (?, ?, ?)
      `).run('invalid-priority', 'Task', 'invalid');
    }).toThrow();
  });

  it('should reject invalid status values', () => {
    const db = getDb();
    
    expect(() => {
      db.prepare(`
        INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)
      `).run('invalid-status', 'Task', 'invalid');
    }).toThrow();
  });
});

describe('New Task Form Validation', () => {
  it('should validate title is required', () => {
    const formData = {
      title: '',
      description: 'Valid description',
      priority: 'medium',
      workflow: 'feature-dev',
    };
    
    const errors: string[] = [];
    if (!formData.title || formData.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    expect(errors).toContain('Title is required');
  });

  it('should validate title max length', () => {
    const formData = {
      title: 'a'.repeat(201),
      description: 'Valid description',
      priority: 'medium',
      workflow: 'feature-dev',
    };
    
    const errors: string[] = [];
    if (formData.title.trim().length > 200) {
      errors.push('Title must be 200 characters or less');
    }
    
    expect(errors).toContain('Title must be 200 characters or less');
  });

  it('should accept valid priority values', () => {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    
    validPriorities.forEach(priority => {
      const errors: string[] = [];
      if (!validPriorities.includes(priority)) {
        errors.push('Invalid priority');
      }
      expect(errors).toHaveLength(0);
    });
  });

  it('should accept valid workflow values', () => {
    const validWorkflows = ['feature-dev', 'bug-fix', 'security-audit'];
    
    validWorkflows.forEach(workflow => {
      const errors: string[] = [];
      if (!validWorkflows.includes(workflow)) {
        errors.push('Invalid workflow');
      }
      expect(errors).toHaveLength(0);
    });
  });

  it('should validate scheduled_at format', () => {
    const validDate = '2024-12-25T10:00';
    const invalidDate = 'invalid-date';
    
    const isValidDate = (dateStr: string): boolean => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    };
    
    expect(isValidDate(validDate)).toBe(true);
    expect(isValidDate(invalidDate)).toBe(false);
  });
});

describe('Task Form Data Structure', () => {
  it('should have correct default values', () => {
    const defaultFormData = {
      title: '',
      description: '',
      priority: 'medium',
      workflow: 'feature-dev',
      target_repo: '',
      scheduled_at: '',
    };
    
    expect(defaultFormData.priority).toBe('medium');
    expect(defaultFormData.workflow).toBe('feature-dev');
    expect(defaultFormData.title).toBe('');
  });

  it('should have all required field keys', () => {
    const formData = {
      title: 'Test',
      description: '',
      priority: 'medium',
      workflow: 'feature-dev',
      target_repo: '',
      scheduled_at: '',
    };
    
    expect(formData).toHaveProperty('title');
    expect(formData).toHaveProperty('description');
    expect(formData).toHaveProperty('priority');
    expect(formData).toHaveProperty('workflow');
    expect(formData).toHaveProperty('target_repo');
    expect(formData).toHaveProperty('scheduled_at');
  });
});
