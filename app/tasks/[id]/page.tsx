'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertCircle,
  Loader2,
  GitBranch,
  Layers,
  Clock,
  Calendar,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock3,
  RotateCcw,
  Ban
} from 'lucide-react';

interface Task {
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

interface TaskResponse {
  data?: Task;
  error?: { code: string; message: string };
}

interface StatusHistoryItem {
  status: Task['status'];
  label: string;
  timestamp: string | null;
  icon: React.ReactNode;
  color: string;
}

function getPriorityBadgeClass(priority: Task['priority']): string {
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
}

function getStatusBadgeClass(status: Task['status']): string {
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
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateString: string | null): string {
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
}

function getStatusHistory(task: Task): StatusHistoryItem[] {
  return [
    {
      status: 'backlog',
      label: 'Created',
      timestamp: task.created_at,
      icon: <Clock className="w-4 h-4" />,
      color: 'text-gray-400',
    },
    {
      status: 'queued',
      label: 'Queued',
      timestamp: task.status !== 'backlog' ? task.created_at : null,
      icon: <Clock3 className="w-4 h-4" />,
      color: 'text-yellow-400',
    },
    {
      status: 'running',
      label: 'Started',
      timestamp: task.started_at,
      icon: <Play className="w-4 h-4" />,
      color: 'text-blue-400',
    },
    {
      status: 'done',
      label: task.status === 'failed' ? 'Failed' : task.status === 'cancelled' ? 'Cancelled' : 'Completed',
      timestamp: task.completed_at,
      icon: task.status === 'failed' ? <XCircle className="w-4 h-4" /> : task.status === 'cancelled' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />,
      color: task.status === 'failed' ? 'text-red-400' : task.status === 'cancelled' ? 'text-gray-400' : 'text-green-400',
    },
  ];
}

// Simple markdown renderer
function renderMarkdown(text: string | null): JSX.Element {
  if (!text) return <p className="text-[var(--text-muted)] italic">No description provided</p>;

  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLanguage = '';

  lines.forEach((line, index) => {
    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${index}`} className="bg-[var(--surface-0)] p-4 rounded-lg overflow-x-auto my-4">
            <code className="text-sm font-mono text-[var(--text-primary)]">{codeContent}</code>
          </pre>
        );
        codeContent = '';
        codeLanguage = '';
      } else {
        codeLanguage = line.slice(3).trim();
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      return;
    }

    // Inline code
    const processedLine = line.replace(/`([^`]+)`/g, '<code class="bg-[var(--surface-0)] px-1.5 py-0.5 rounded text-sm font-mono text-[var(--primary)]">$1</code>');

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-2xl font-bold text-[var(--text-primary)] mt-6 mb-4">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-xl font-bold text-[var(--text-primary)] mt-5 mb-3">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-lg font-bold text-[var(--text-primary)] mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('- ')) {
      // List item
      elements.push(
        <li key={index} className="text-[var(--text-secondary)] ml-4 mb-1 list-disc" dangerouslySetInnerHTML={{ __html: processedLine.slice(2) }} />
      );
    } else if (line.match(/^\d+\. /)) {
      // Numbered list
      elements.push(
        <li key={index} className="text-[var(--text-secondary)] ml-4 mb-1 list-decimal" dangerouslySetInnerHTML={{ __html: processedLine.replace(/^\d+\. /, '') }} />
      );
    } else if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />);
    } else {
      // Paragraph
      elements.push(
        <p key={index} className="text-[var(--text-secondary)] mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />
      );
    }
  });

  return <div className="markdown-content">{elements}</div>;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`);
      const data: TaskResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch task');
      }

      if (data.data) {
        setTask(data.data);
        setEditForm(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete task');
      }

      router.push('/tasks');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to cancel task');
      }

      setTask(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          target_repo: editForm.target_repo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update task');
      }

      setTask(data.data);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTask = async () => {
    setIsActionLoading(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to start task');
      }

      setTask(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start task');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    setIsActionLoading(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to complete task');
      }

      setTask(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFailTask = async () => {
    setIsActionLoading(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to mark task as failed');
      }

      setTask(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark task as failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleQueueTask = async () => {
    setIsActionLoading(true);
    try {
      const { id } = await params;
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'queued' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to queue task');
      }

      setTask(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue task');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading task...</span>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">{error || 'Task not found'}</p>
              <a
                href="/tasks"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 inline-flex items-center gap-1 mt-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to tasks
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusHistory = getStatusHistory(task);
  const canStart = task.status === 'queued' || task.status === 'backlog';
  const canComplete = task.status === 'running';
  const canFail = task.status === 'running';
  const canCancel = task.status === 'queued' || task.status === 'running' || task.status === 'backlog';
  const canQueue = task.status === 'backlog';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div className="flex items-center gap-4">
          <a
            href="/tasks"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors duration-150 cursor-pointer"
            aria-label="Go back to tasks"
          >
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="bg-[var(--surface-3)] border border-[var(--border-subtle)] rounded-lg px-3 py-1 text-2xl font-bold w-full max-w-xl"
                  />
                ) : (
                  task.title
                )}
              </h1>
              <span className={getPriorityBadgeClass(task.priority)}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
              <span className={getStatusBadgeClass(task.status)}>
                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </span>
            </div>
            <p className="text-[var(--text-muted)] text-sm mt-1 font-mono">{task.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Action Buttons */}
          {canQueue && (
            <button
              onClick={handleQueueTask}
              disabled={isActionLoading}
              className="btn btn-secondary disabled:opacity-50"
              aria-label="Queue task"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              <span>Queue</span>
            </button>
          )}

          {canStart && (
            <button
              onClick={handleStartTask}
              disabled={isActionLoading}
              className="btn btn-primary disabled:opacity-50"
              aria-label="Start task"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>Start</span>
            </button>
          )}

          {canComplete && (
            <button
              onClick={handleCompleteTask}
              disabled={isActionLoading}
              className="btn bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              aria-label="Complete task"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              <span>Complete</span>
            </button>
          )}

          {canFail && (
            <button
              onClick={handleFailTask}
              disabled={isActionLoading}
              className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
              aria-label="Fail task"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              <span>Fail</span>
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={isActionLoading}
              className="btn bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
              aria-label="Cancel task"
            >
              <Ban className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}

          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Save</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm(task);
                }}
                className="btn btn-secondary"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-secondary"
              aria-label="Edit task"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30"
            aria-label="Delete task"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Delete Task</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-center gap-3 text-yellow-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Cancel Task</h3>
            </div>
            <p className="text-[var(--text-secondary)] mb-6">
              Are you sure you want to cancel this task? This will stop any ongoing processing.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="btn btn-secondary"
                disabled={isCancelling}
              >
                Cancel
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="btn bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Confirm Cancel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Description */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--text-muted)]" />
              Description
            </h2>
            {isEditing ? (
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={10}
                className="input font-mono text-sm w-full"
                placeholder="Enter task description (markdown supported)..."
              />
            ) : (
              <div className="prose prose-invert max-w-none">
                {renderMarkdown(task.description)}
              </div>
            )}
          </div>

          {/* Status History */}
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--text-muted)]" />
              Status History
            </h2>
            <div className="space-y-4">
              {statusHistory.map((item, index) => {
                const isActive = item.timestamp !== null;
                const isCurrent = task.status === item.status ||
                  (task.status === 'done' && item.status === 'done') ||
                  (task.status === 'failed' && item.status === 'done') ||
                  (task.status === 'cancelled' && item.status === 'done');

                return (
                  <div
                    key={item.status}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      isCurrent ? 'bg-[var(--surface-3)]' : ''
                    }`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      isActive ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface-0)]'
                    } ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                        {item.label}
                      </p>
                      {isActive && (
                        <p className="text-sm text-[var(--text-muted)]">
                          {formatDateTime(item.timestamp)}
                          <span className="ml-2 text-xs">({formatRelativeTime(item.timestamp)})</span>
                        </p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="text-xs text-[var(--primary)] font-medium">Current</span>
                    )}
                    {index < statusHistory.length - 1 && isActive && (
                      <div className="hidden sm:block absolute left-[2.25rem] mt-12 h-4 w-px bg-[var(--border-subtle)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Task Details Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Task Details
            </h2>
            <div className="space-y-4">
              {/* Workflow */}
              <div>
                <label className="text-sm text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <GitBranch className="w-3 h-3" />
                  Workflow
                </label>
                <p className="text-[var(--text-primary)] font-medium">{task.workflow}</p>
              </div>

              {/* Target Repo */}
              <div>
                <label className="text-sm text-[var(--text-muted)] flex items-center gap-1 mb-1">
                  <GitBranch className="w-3 h-3" />
                  Target Repository
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.target_repo || ''}
                    onChange={(e) => setEditForm({ ...editForm, target_repo: e.target.value })}
                    className="input text-sm w-full"
                    placeholder="/path/to/repo"
                  />
                ) : (
                  <p className="text-[var(--text-primary)] font-mono text-sm">
                    {task.target_repo || <span className="text-[var(--text-muted)] italic">Not specified</span>}
                  </p>
                )}
              </div>

              {/* Priority - Edit only */}
              {isEditing && (
                <div>
                  <label className="text-sm text-[var(--text-muted)] flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    Priority
                  </label>
                  <select
                    value={editForm.priority || ''}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as Task['priority'] })}
                    className="input text-sm w-full"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              )}

              {/* Queue Order */}
              <div>
                <label className="text-sm text-[var(--text-muted)] mb-1">Queue Order</label>
                <p className="text-[var(--text-primary)] font-mono text-sm tabular-nums">
                  {task.queue_order}
                </p>
              </div>
            </div>
          </div>

          {/* Timing Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--text-muted)]" />
              Timing
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--text-muted)] mb-1">Created</label>
                <p className="text-[var(--text-primary)] text-sm">{formatDateTime(task.created_at)}</p>
                <p className="text-xs text-[var(--text-muted)]">{formatRelativeTime(task.created_at)}</p>
              </div>

              {task.scheduled_at && (
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-1">Scheduled For</label>
                  <p className="text-[var(--text-primary)] text-sm">{formatDateTime(task.scheduled_at)}</p>
                </div>
              )}

              {task.started_at && (
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-1">Started</label>
                  <p className="text-[var(--text-primary)] text-sm">{formatDateTime(task.started_at)}</p>
                </div>
              )}

              {task.completed_at && (
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-1">Completed</label>
                  <p className="text-[var(--text-primary)] text-sm">{formatDateTime(task.completed_at)}</p>
                </div>
              )}

              {task.updated_at !== task.created_at && (
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-1">Last Updated</label>
                  <p className="text-[var(--text-primary)] text-sm">{formatDateTime(task.updated_at)}</p>
                </div>
              )}

              {task.started_at && task.completed_at && (
                <div className="pt-3 border-t border-[var(--border-subtle)]">
                  <label className="text-sm text-[var(--text-muted)] mb-1">Duration</label>
                  <p className="text-[var(--text-primary)] text-sm font-mono">
                    {(() => {
                      const start = new Date(task.started_at!).getTime();
                      const end = new Date(task.completed_at!).getTime();
                      const diff = end - start;
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      if (hours > 0) {
                        return `${hours}h ${minutes}m`;
                      }
                      return `${minutes}m`;
                    })()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
