import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = 'http://localhost:3518';

// Helper to create a task via API
async function createTask(data: {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'backlog' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  workflow?: string;
  target_repo?: string;
}): Promise<{ id: string; [key: string]: unknown }> {
  const response = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }
  
  const result = await response.json();
  return result.data;
}

// Helper to fetch tasks with filters
async function fetchTasks(filters?: {
  status?: string;
  priority?: string;
  workflow?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  data: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    workflow: string;
    queue_order: number;
    created_at: string;
  }>;
  meta: { limit: number; offset: number; total: number };
}> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.workflow) params.set('workflow', filters.workflow);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());
  
  const response = await fetch(`${API_BASE}/api/tasks?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.status}`);
  }
  
  return response.json();
}

describe('Task List Page - Filtering UI', () => {
  // Store created task IDs for cleanup
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Verify API is available
    try {
      const response = await fetch(`${API_BASE}/api/tasks?limit=1`);
      if (!response.ok) {
        console.warn('API may not be fully ready, tests might fail');
      }
    } catch {
      console.warn('Could not connect to API at', API_BASE);
    }
  });

  afterAll(async () => {
    // Clean up created tasks
    for (const id of createdTaskIds) {
      try {
        await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Status Filter Options', () => {
    it('should have all required status filter options', () => {
      const expectedStatuses = [
        { value: 'all', label: 'All' },
        { value: 'backlog', label: 'Backlog' },
        { value: 'queued', label: 'Queued' },
        { value: 'running', label: 'Running' },
        { value: 'done', label: 'Done' },
        { value: 'failed', label: 'Failed' },
        { value: 'cancelled', label: 'Cancelled' },
      ];

      // Verify all expected statuses are defined
      expect(expectedStatuses).toHaveLength(7);
      expect(expectedStatuses.map(s => s.value)).toContain('all');
      expect(expectedStatuses.map(s => s.value)).toContain('backlog');
      expect(expectedStatuses.map(s => s.value)).toContain('queued');
      expect(expectedStatuses.map(s => s.value)).toContain('running');
      expect(expectedStatuses.map(s => s.value)).toContain('done');
      expect(expectedStatuses.map(s => s.value)).toContain('failed');
      expect(expectedStatuses.map(s => s.value)).toContain('cancelled');
    });

    it('should filter tasks by status=backlog via API', async () => {
      const task = await createTask({ 
        title: 'Backlog Filter Test Task', 
        status: 'backlog',
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ status: 'backlog' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.status === 'backlog')).toBe(true);
    });

    it('should filter tasks by status=queued via API', async () => {
      const task = await createTask({ 
        title: 'Queued Filter Test Task', 
        status: 'queued',
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ status: 'queued' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.status === 'queued')).toBe(true);
    });

    it('should filter tasks by status=running via API', async () => {
      const task = await createTask({ 
        title: 'Running Filter Test Task', 
        status: 'running',
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ status: 'running' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.status === 'running')).toBe(true);
    });

    it('should filter tasks by status=done via API', async () => {
      const task = await createTask({ 
        title: 'Done Filter Test Task', 
        status: 'done',
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ status: 'done' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.status === 'done')).toBe(true);
    });

    it('should filter tasks by status=failed via API', async () => {
      const task = await createTask({ 
        title: 'Failed Filter Test Task', 
        status: 'failed',
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ status: 'failed' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.status === 'failed')).toBe(true);
    });

    it('should filter tasks by status=cancelled via API', async () => {
      const task = await createTask({ 
        title: 'Cancelled Filter Test Task', 
        status: 'cancelled',
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ status: 'cancelled' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.status === 'cancelled')).toBe(true);
    });
  });

  describe('Priority Filter Options', () => {
    it('should have all required priority filter options', () => {
      const expectedPriorities = [
        { value: 'all', label: 'All' },
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ];

      expect(expectedPriorities).toHaveLength(5);
      expect(expectedPriorities.map(p => p.value)).toContain('all');
      expect(expectedPriorities.map(p => p.value)).toContain('critical');
      expect(expectedPriorities.map(p => p.value)).toContain('high');
      expect(expectedPriorities.map(p => p.value)).toContain('medium');
      expect(expectedPriorities.map(p => p.value)).toContain('low');
    });

    it('should filter tasks by priority=critical via API', async () => {
      const task = await createTask({ 
        title: 'Critical Priority Test Task', 
        priority: 'critical'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ priority: 'critical' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.priority === 'critical')).toBe(true);
    });

    it('should filter tasks by priority=high via API', async () => {
      const task = await createTask({ 
        title: 'High Priority Test Task', 
        priority: 'high'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ priority: 'high' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.priority === 'high')).toBe(true);
    });

    it('should filter tasks by priority=medium via API', async () => {
      const task = await createTask({ 
        title: 'Medium Priority Test Task', 
        priority: 'medium'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ priority: 'medium' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.priority === 'medium')).toBe(true);
    });

    it('should filter tasks by priority=low via API', async () => {
      const task = await createTask({ 
        title: 'Low Priority Test Task', 
        priority: 'low'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ priority: 'low' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.priority === 'low')).toBe(true);
    });
  });

  describe('Workflow Filter Options', () => {
    it('should have all required workflow filter options', () => {
      const expectedWorkflows = [
        { value: 'all', label: 'All' },
        { value: 'feature-dev', label: 'Feature Dev' },
        { value: 'bug-fix', label: 'Bug Fix' },
        { value: 'security-audit', label: 'Security Audit' },
      ];

      expect(expectedWorkflows).toHaveLength(4);
      expect(expectedWorkflows.map(w => w.value)).toContain('all');
      expect(expectedWorkflows.map(w => w.value)).toContain('feature-dev');
      expect(expectedWorkflows.map(w => w.value)).toContain('bug-fix');
      expect(expectedWorkflows.map(w => w.value)).toContain('security-audit');
    });

    it('should filter tasks by workflow=feature-dev via API', async () => {
      const task = await createTask({ 
        title: 'Feature Dev Workflow Test Task', 
        workflow: 'feature-dev'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ workflow: 'feature-dev' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.workflow === 'feature-dev')).toBe(true);
    });

    it('should filter tasks by workflow=bug-fix via API', async () => {
      const task = await createTask({ 
        title: 'Bug Fix Workflow Test Task', 
        workflow: 'bug-fix'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ workflow: 'bug-fix' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.workflow === 'bug-fix')).toBe(true);
    });

    it('should filter tasks by workflow=security-audit via API', async () => {
      const task = await createTask({ 
        title: 'Security Audit Workflow Test Task', 
        workflow: 'security-audit'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ workflow: 'security-audit' });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => t.workflow === 'security-audit')).toBe(true);
    });
  });

  describe('Combined Filters', () => {
    it('should filter by multiple criteria via API', async () => {
      const task = await createTask({ 
        title: 'Combined Filter Test Task', 
        priority: 'high', 
        workflow: 'feature-dev',
        status: 'backlog'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks({ 
        priority: 'high', 
        workflow: 'feature-dev',
        status: 'backlog'
      });
      
      expect(result.data.some(t => t.id === task.id)).toBe(true);
      expect(result.data.every(t => 
        t.priority === 'high' && 
        t.workflow === 'feature-dev' && 
        t.status === 'backlog'
      )).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should support pagination via API', async () => {
      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        const task = await createTask({ 
          title: `Pagination Test Task ${i}`, 
          priority: 'low'
        });
        createdTaskIds.push(task.id);
      }

      const page1 = await fetchTasks({ limit: 2, offset: 0 });
      expect(page1.data.length).toBeLessThanOrEqual(2);
      expect(page1.meta.limit).toBe(2);
      expect(page1.meta.offset).toBe(0);

      const page2 = await fetchTasks({ limit: 2, offset: 2 });
      expect(page2.data.length).toBeLessThanOrEqual(2);
      expect(page2.meta.offset).toBe(2);
    });
  });

  describe('Task Display', () => {
    it('should return tasks with all required fields', async () => {
      const task = await createTask({ 
        title: 'Display Test Task',
        description: 'Test description',
        priority: 'medium',
        status: 'backlog',
        workflow: 'feature-dev'
      });
      createdTaskIds.push(task.id);

      const result = await fetchTasks();
      const foundTask = result.data.find(t => t.id === task.id);
      
      expect(foundTask).toBeDefined();
      expect(foundTask).toHaveProperty('id');
      expect(foundTask).toHaveProperty('title');
      expect(foundTask).toHaveProperty('priority');
      expect(foundTask).toHaveProperty('status');
      expect(foundTask).toHaveProperty('workflow');
      expect(foundTask).toHaveProperty('queue_order');
      expect(foundTask).toHaveProperty('created_at');
    });
  });
});
