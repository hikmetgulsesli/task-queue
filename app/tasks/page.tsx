'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Filter, 
  Plus, 
  Calendar, 
  ArrowUpDown,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'backlog' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  workflow: string;
  target_repo: string | null;
  queue_order: number;
  created_at: string;
  updated_at: string;
}

interface TasksResponse {
  tasks: Task[];
  error?: { code: string; message: string };
}

type StatusFilter = 'all' | 'backlog' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type WorkflowFilter = 'all' | 'feature-dev' | 'bug-fix' | 'security-audit';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All Priority' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const workflowOptions: { value: WorkflowFilter; label: string }[] = [
  { value: 'all', label: 'All Workflows' },
  { value: 'feature-dev', label: 'Feature Dev' },
  { value: 'bug-fix', label: 'Bug Fix' },
  { value: 'security-audit', label: 'Security Audit' },
];

function getPriorityBadgeClass(priority: Task['priority']): string {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
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
}

function getStatusBadgeClass(status: Task['status']): string {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
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
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TasksPage(): JSX.Element {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (workflowFilter !== 'all') params.set('workflow', workflowFilter);
      
      const response = await fetch(`/api/tasks?${params.toString()}`);
      const data: TasksResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch tasks');
      }
      
      setTasks(data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, workflowFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleRowClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setWorkflowFilter('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || workflowFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Tasks
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Manage and monitor all tasks in the queue
          </p>
        </div>
        <a
          href="/tasks/new"
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </a>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="input appearance-none pr-10 cursor-pointer text-sm min-w-[140px]"
                aria-label="Filter by status"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                className="input appearance-none pr-10 cursor-pointer text-sm min-w-[140px]"
                aria-label="Filter by priority"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {/* Workflow Filter */}
            <div className="relative">
              <select
                value={workflowFilter}
                onChange={(e) => setWorkflowFilter(e.target.value as WorkflowFilter)}
                className="input appearance-none pr-10 cursor-pointer text-sm min-w-[160px]"
                aria-label="Filter by workflow"
              >
                {workflowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors duration-150 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface-3)] text-xs text-[var(--text-secondary)]">
                Status: {statusOptions.find(o => o.value === statusFilter)?.label}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-1 hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Remove status filter"
                >
                  ×
                </button>
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface-3)] text-xs text-[var(--text-secondary)]">
                Priority: {priorityOptions.find(o => o.value === priorityFilter)?.label}
                <button
                  onClick={() => setPriorityFilter('all')}
                  className="ml-1 hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Remove priority filter"
                >
                  ×
                </button>
              </span>
            )}
            {workflowFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface-3)] text-xs text-[var(--text-secondary)]">
                Workflow: {workflowOptions.find(o => o.value === workflowFilter)?.label}
                <button
                  onClick={() => setWorkflowFilter('all')}
                  className="ml-1 hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Remove workflow filter"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
          <span className="ml-3 text-[var(--text-secondary)]">Loading tasks...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tasks.length === 0 && (
        <div className="card text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--surface-3)] mb-4">
            <Calendar className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No tasks found
          </h3>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            {hasActiveFilters 
              ? 'Try adjusting your filters to see more results.'
              : 'Get started by creating your first task.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-secondary mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Task Table */}
      {!loading && !error && tasks.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-3)]/50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)] w-[100px]">
                    Priority
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)] w-[120px]">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)] w-[140px]">
                    Workflow
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)] w-[100px]">
                    Queue
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)] w-[140px]">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => handleRowClick(task.id)}
                    className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-3)]/30 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium truncate max-w-[300px]">
                        {task.title}
                      </div>
                      {task.target_repo && (
                        <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[300px]">
                          {task.target_repo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={getPriorityBadgeClass(task.priority)}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={getStatusBadgeClass(task.status)}>
                        {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {task.workflow}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-[var(--text-secondary)] tabular-nums">
                        {task.queue_order}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-[var(--text-secondary)]">
                        {formatDate(task.created_at)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {formatTime(task.created_at)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Results count */}
          <div className="border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--surface-3)]/30">
            <p className="text-sm text-[var(--text-muted)]">
              Showing {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
