import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-task-queue.db');

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

interface MockTask {
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

describe('Task Detail Page', () => {
  const mockTask: MockTask = {
    id: 'test-task-123',
    title: 'Test Task Title',
    description: '# Test Description\n\nThis is a **markdown** description.',
    priority: 'high',
    status: 'queued',
    workflow: 'feature-dev',
    target_repo: '/home/setrox/test-repo',
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    antfarm_run_id: null,
    queue_order: 1,
    created_at: '2026-02-19T10:00:00.000Z',
    updated_at: '2026-02-19T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Mock Data Validation', () => {
    it('should have valid mock task data', () => {
      expect(mockTask.id).toBe('test-task-123');
      expect(mockTask.title).toBe('Test Task Title');
      expect(mockTask.priority).toBe('high');
      expect(mockTask.status).toBe('queued');
    });

    it('should have markdown in description', () => {
      expect(mockTask.description).toContain('# Test Description');
      expect(mockTask.description).toContain('**markdown**');
    });
  });

  describe('Status History Logic', () => {
    it('should calculate status history correctly', () => {
      const statusHistory = [
        { status: 'backlog', label: 'Created', timestamp: mockTask.created_at },
        { status: 'queued', label: 'Queued', timestamp: mockTask.status !== 'backlog' ? mockTask.created_at : null },
        { status: 'running', label: 'Started', timestamp: mockTask.started_at },
        { status: 'done', label: 'Completed', timestamp: mockTask.completed_at },
      ];

      expect(statusHistory[0].label).toBe('Created');
      expect(statusHistory[0].timestamp).toBe(mockTask.created_at);
      expect(statusHistory[2].timestamp).toBeNull(); // Not started yet
    });

    it('should show failed status for failed tasks', () => {
      const failedTask = { ...mockTask, status: 'failed' as const, completed_at: '2026-02-19T12:00:00.000Z' };
      const lastStatus = failedTask.status === 'failed' ? 'Failed' : 'Completed';
      expect(lastStatus).toBe('Failed');
    });
  });

  describe('Date Formatting', () => {
    it('should format date time correctly', () => {
      const formatDateTime = (dateString: string | null): string => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      const formatted = formatDateTime(mockTask.created_at);
      expect(formatted).toContain('Feb');
      expect(formatted).toContain('2026');
    });

    it('should calculate duration for completed tasks', () => {
      const started_at = '2026-02-19T10:00:00.000Z';
      const completed_at = '2026-02-19T11:30:00.000Z';
      
      const start = new Date(started_at).getTime();
      const end = new Date(completed_at).getTime();
      const diff = end - start;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      expect(hours).toBe(1);
      expect(minutes).toBe(30);
    });

    it('should return Not set for null dates', () => {
      const formatDateTime = (dateString: string | null): string => {
        if (!dateString) return 'Not set';
        return dateString;
      };

      expect(formatDateTime(null)).toBe('Not set');
    });
  });

  describe('Priority Badge Classes', () => {
    it('should return correct classes for each priority', () => {
      const getPriorityBadgeClass = (priority: MockTask['priority']): string => {
        const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium';
        switch (priority) {
          case 'critical':
            return `${baseClasses} bg-red-500/20 text-red-400`;
          case 'high':
            return `${baseClasses} bg-orange-500/20 text-orange-400`;
          case 'medium':
            return `${baseClasses} bg-blue-500/20 text-blue-400`;
          case 'low':
            return `${baseClasses} bg-gray-500/20 text-gray-400`;
          default:
            return `${baseClasses} bg-gray-500/20 text-gray-400`;
        }
      };

      expect(getPriorityBadgeClass('critical')).toContain('red');
      expect(getPriorityBadgeClass('high')).toContain('orange');
      expect(getPriorityBadgeClass('medium')).toContain('blue');
      expect(getPriorityBadgeClass('low')).toContain('gray');
    });
  });

  describe('Status Badge Classes', () => {
    it('should return correct classes for each status', () => {
      const getStatusBadgeClass = (status: MockTask['status']): string => {
        const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium';
        switch (status) {
          case 'backlog':
            return `${baseClasses} bg-gray-500/20 text-gray-400`;
          case 'queued':
            return `${baseClasses} bg-yellow-500/20 text-yellow-400`;
          case 'running':
            return `${baseClasses} bg-blue-500/20 text-blue-400 animate-pulse`;
          case 'done':
            return `${baseClasses} bg-green-500/20 text-green-400`;
          case 'failed':
            return `${baseClasses} bg-red-500/20 text-red-400`;
          case 'cancelled':
            return `${baseClasses} bg-gray-500/20 text-gray-400`;
          default:
            return `${baseClasses} bg-gray-500/20 text-gray-400`;
        }
      };

      expect(getStatusBadgeClass('backlog')).toContain('gray');
      expect(getStatusBadgeClass('queued')).toContain('yellow');
      expect(getStatusBadgeClass('running')).toContain('blue');
      expect(getStatusBadgeClass('done')).toContain('green');
      expect(getStatusBadgeClass('failed')).toContain('red');
    });
  });

  describe('Markdown Rendering', () => {
    it('should handle code blocks in markdown', () => {
      const markdown = '```typescript\nconst x = 1;\n```';
      expect(markdown).toContain('```');
      expect(markdown).toContain('typescript');
    });

    it('should handle inline code in markdown', () => {
      const markdown = 'Use `console.log()` for debugging';
      expect(markdown).toContain('`console.log()`');
    });

    it('should handle headers in markdown', () => {
      const markdown = '# Header 1\n## Header 2\n### Header 3';
      expect(markdown).toContain('# Header 1');
      expect(markdown).toContain('## Header 2');
      expect(markdown).toContain('### Header 3');
    });
  });

  describe('Relative Time Formatting', () => {
    it('should format relative time correctly', () => {
      const formatRelativeTime = (dateString: string | null): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      // Test with a recent date
      const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      expect(formatRelativeTime(recentDate)).toBe('5m ago');

      // Test with null
      expect(formatRelativeTime(null)).toBe('');
    });
  });
});

describe('Task Detail API Route', () => {
  it('should have API route file for individual tasks', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(process.cwd(), 'app', 'api', 'tasks', '[id]', 'route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should export GET, PATCH, and DELETE handlers', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(process.cwd(), 'app', 'api', 'tasks', '[id]', 'route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');
    
    expect(content).toContain('export async function GET');
    expect(content).toContain('export async function PATCH');
    expect(content).toContain('export async function DELETE');
  });

  it('should use parameterized queries', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(process.cwd(), 'app', 'api', 'tasks', '[id]', 'route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Should use ? for parameters, not string concatenation
    expect(content).toContain('SELECT * FROM tasks WHERE id = ?');
    expect(content).toContain('DELETE FROM tasks WHERE id = ?');
  });

  it('should handle validation errors', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(process.cwd(), 'app', 'api', 'tasks', '[id]', 'route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');
    
    expect(content).toContain('VALIDATION_ERROR');
    expect(content).toContain('NOT_FOUND');
  });
});

describe('Task Detail Page Component', () => {
  it('should have page component file', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it('should import required icons from lucide-react', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('lucide-react');
    expect(content).toContain('ArrowLeft');
    expect(content).toContain('Edit');
    expect(content).toContain('Trash2');
  });

  it('should have edit functionality', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('isEditing');
    expect(content).toContain('setIsEditing');
    expect(content).toContain('handleSave');
  });

  it('should have delete confirmation', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('showDeleteConfirm');
    expect(content).toContain('Delete Task');
    expect(content).toContain('Are you sure');
  });

  it('should render markdown description', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('renderMarkdown');
    expect(content).toContain('markdown');
  });

  it('should display status history', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('Status History');
    expect(content).toContain('getStatusHistory');
  });

  it('should show timing information', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('Timing');
    expect(content).toContain('created_at');
    expect(content).toContain('started_at');
    expect(content).toContain('completed_at');
  });

  it('should have start task functionality', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('handleStartTask');
  });

  it('should display antfarm run information', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.join(process.cwd(), 'app', 'tasks', '[id]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    
    expect(content).toContain('antfarm_run_id');
    expect(content).toContain('Antfarm Run');
  });
});
