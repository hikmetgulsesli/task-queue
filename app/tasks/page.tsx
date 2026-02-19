'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Filter, 
  Plus, 
  Calendar, 
  ArrowUpDown,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ListFilter
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
  data: Task[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

type StatusFilter = 'all' | 'backlog' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type WorkflowFilter = 'all' | 'feature-dev' | 'bug-fix' | 'security-audit';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const workflowOptions: { value: WorkflowFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'feature-dev', label: 'Feature Dev' },
  { value: 'bug-fix', label: 'Bug Fix' },
  { value: 'security-audit', label: 'Security Audit' },
];

const ITEMS_PER_PAGE = 20;

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

function TasksPageContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Read filters from URL params
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) || 'all'
  );
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(
    (searchParams.get('priority') as PriorityFilter) || 'all'
  );
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>(
    (searchParams.get('workflow') as WorkflowFilter) || 'all'
  );
  const [currentPage, setCurrentPage] = useState(
    Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Update URL when filters change
  const updateUrlParams = useCallback((
    status: StatusFilter,
    priority: PriorityFilter,
    workflow: WorkflowFilter,
    page: number
  ) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (workflow !== 'all') params.set('workflow', workflow);
    if (page > 1) params.set('page', page.toString());
    
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '/tasks';
    router.push(newUrl, { scroll: false });
  }, [router]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (workflowFilter !== 'all') params.set('workflow', workflowFilter);
      
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      params.set('limit', ITEMS_PER_PAGE.toString());
      params.set('offset', offset.toString());
      
      const response = await fetch(`/api/tasks?${params.toString()}`);
      const data: TasksResponse = await response.json();
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      
      setTasks(data.data);
      setTotal(data.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, workflowFilter, currentPage]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Update URL when filters change
  useEffect(() => {
    updateUrlParams(statusFilter, priorityFilter, workflowFilter, currentPage);
  }, [statusFilter, priorityFilter, workflowFilter, currentPage, updateUrlParams]);

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePriorityChange = (value: PriorityFilter) => {
    setPriorityFilter(value);
    setCurrentPage(1);
  };

  const handleWorkflowChange = (value: WorkflowFilter) => {
    setWorkflowFilter(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setWorkflowFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || workflowFilter !== 'all';
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

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
        <Link
          href="/tasks/new"
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <ListFilter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Status Filter */}
            <div className="relative">
              <label htmlFor="status-filter" className="sr-only">Filter by status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
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
              <label htmlFor="priority-filter" className="sr-only">Filter by priority</label>
              <select
                id="priority-filter"
                value={priorityFilter}
                onChange={(e) => handlePriorityChange(e.target.value as PriorityFilter)}
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
              <label htmlFor="workflow-filter" className="sr-only">Filter by workflow</label>
              <select
                id="workflow-filter"
                value={workflowFilter}
                onChange={(e) => handleWorkflowChange(e.target.value as WorkflowFilter)}
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
                  onClick={() => handleStatusChange('all')}
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
                  onClick={() => handlePriorityChange('all')}
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
                  onClick={() => handleWorkflowChange('all')}
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
                    className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-3)]/30 transition-colors duration-150"
                  >
                    <td className="py-3 px-4">
                      <Link 
                        href={`/tasks/${task.id}`}
                        className="font-medium truncate max-w-[300px] hover:text-[var(--primary)] transition-colors cursor-pointer"
                      >
                        {task.title}
                      </Link>
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
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--surface-3)]/30 flex items-center justify-between">
              <p className="text-sm text-[var(--text-muted)]">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} tasks
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-[var(--text-secondary)] px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Results count (no pagination) */}
          {totalPages <= 1 && (
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--surface-3)]/30">
              <p className="text-sm text-[var(--text-muted)]">
                Showing {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TasksPage(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="card flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading...</span>
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}
