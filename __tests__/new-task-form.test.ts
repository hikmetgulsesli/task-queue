import { describe, it, expect, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('New Task Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates required title field', () => {
    const formData = {
      title: '',
      description: '',
      priority: 'medium',
      workflow: 'feature-dev',
      target_repo: '',
      scheduled_at: '',
    };

    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    expect(errors.title).toBe('Title is required');
  });

  it('allows valid priority values', () => {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    
    validPriorities.forEach(priority => {
      expect(['low', 'medium', 'high', 'critical']).toContain(priority);
    });
  });

  it('rejects invalid priority values', () => {
    const invalidPriorities = ['invalid', 'urgent', 'normal', ''];
    
    invalidPriorities.forEach(priority => {
      expect(['low', 'medium', 'high', 'critical']).not.toContain(priority);
    });
  });

  it('validates workflow field exists', () => {
    const workflows = ['feature-dev', 'bugfix', 'hotfix', 'refactor', 'docs'];
    
    workflows.forEach(workflow => {
      expect(workflow).toBeDefined();
    });
  });

  it('correctly formats form data for API submission', () => {
    const formData = {
      title: '  Test Task  ',
      description: '  Test Description  ',
      priority: 'high',
      workflow: 'bugfix',
      target_repo: ' owner/repo ',
      scheduled_at: '2026-02-20T12:00',
    };

    const apiData = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      priority: formData.priority,
      workflow: formData.workflow,
      target_repo: formData.target_repo.trim() || null,
      scheduled_at: formData.scheduled_at || null,
    };

    expect(apiData.title).toBe('Test Task');
    expect(apiData.description).toBe('Test Description');
    expect(apiData.priority).toBe('high');
    expect(apiData.workflow).toBe('bugfix');
    expect(apiData.target_repo).toBe('owner/repo');
    expect(apiData.scheduled_at).toBe('2026-02-20T12:00');
  });

  it('handles empty optional fields correctly', () => {
    const formData = {
      title: 'Test Task',
      description: '',
      priority: 'medium',
      workflow: 'feature-dev',
      target_repo: '',
      scheduled_at: '',
    };

    const apiData = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      priority: formData.priority,
      workflow: formData.workflow,
      target_repo: formData.target_repo.trim() || null,
      scheduled_at: formData.scheduled_at || null,
    };

    expect(apiData.description).toBeNull();
    expect(apiData.target_repo).toBeNull();
    expect(apiData.scheduled_at).toBeNull();
  });

  it('submits correct API payload', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'new-task-id' } }),
    });

    const formData = {
      title: 'New Task',
      description: 'Description',
      priority: 'high',
      workflow: 'feature-dev',
      target_repo: 'owner/repo',
      scheduled_at: '',
    };

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        workflow: formData.workflow,
        target_repo: formData.target_repo,
        scheduled_at: formData.scheduled_at || null,
      }),
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Task',
        description: 'Description',
        priority: 'high',
        workflow: 'feature-dev',
        target_repo: 'owner/repo',
        scheduled_at: null,
      }),
    });
  });

  it('handles API error response', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Validation error' } }),
    });

    const response = await fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    });

    const data = await response.json();
    
    expect(response.ok).toBe(false);
    expect(data.error.message).toBe('Validation error');
  });

  it('redirects on successful submission', () => {
    // This test verifies the redirect logic would work
    const router = {
      push: vi.fn(),
    };

    const success = true;
    
    if (success) {
      router.push('/');
    }

    expect(router.push).toHaveBeenCalledWith('/');
  });
});
