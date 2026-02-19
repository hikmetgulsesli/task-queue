'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { 
  Play, 
  X, 
  GripVertical, 
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowUp,
  ArrowDown
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

interface QueueResponse {
  data: Task[];
  meta: {
    total: number;
  };
}

export default function QueuePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<Task | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch queued tasks
  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/queue');
      if (!response.ok) {
        throw new Error('Failed to fetch queue');
      }
      const result: QueueResponse = await response.json();
      setTasks(result.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchQueue();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchQueue, 10000);
    
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedItem(task);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image to be cleaner
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  };

  // Handle drag end
  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (!draggedItem) return;

    const dragIndex = tasks.findIndex(t => t.id === draggedItem.id);
    if (dragIndex === -1 || dragIndex === dropIndex) return;

    // Reorder locally first for immediate feedback
    const newTasks = [...tasks];
    const [removed] = newTasks.splice(dragIndex, 1);
    newTasks.splice(dropIndex, 0, removed);
    
    // Update queue_order for all items
    const reorderedTasks = newTasks.map((task, index) => ({
      ...task,
      queue_order: index + 1,
    }));
    
    setTasks(reorderedTasks);

    // Send reorder to server
    try {
      const orders = reorderedTasks.map(task => ({
        id: task.id,
        queue_order: task.queue_order,
      }));

      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder queue');
      }

      // Refresh to get server state
      fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
      // Revert on error
      fetchQueue();
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Start next task
  const handleStartNext = async () => {
    setActionLoading('start-next');
    try {
      const response = await fetch('/api/queue/start-next', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start next task');
      }

      const result = await response.json();
      
      if (result.data) {
        // Task was claimed, refresh queue
        fetchQueue();
      } else {
        // No tasks available
        alert('No queued tasks available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start next task');
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel all tasks
  const handleCancelAll = async () => {
    setActionLoading('cancel-all');
    try {
      const response = await fetch('/api/queue/cancel-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel tasks');
      }

      const result = await response.json();
      setShowCancelConfirm(false);
      fetchQueue();
      
      if (result.data.cancelled === 0) {
        alert('No queued tasks to cancel');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel tasks');
    } finally {
      setActionLoading(null);
    }
  };

  // Move task up in queue
  const moveUp = async (index: number) => {
    if (index === 0) return;
    
    const newTasks = [...tasks];
    [newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]];
    
    const reorderedTasks = newTasks.map((task, idx) => ({
      ...task,
      queue_order: idx + 1,
    }));
    
    setTasks(reorderedTasks);

    try {
      const orders = reorderedTasks.map(task => ({
        id: task.id,
        queue_order: task.queue_order,
      }));

      await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });

      fetchQueue();
    } catch (err) {
      fetchQueue();
    }
  };

  // Move task down in queue
  const moveDown = async (index: number) => {
    if (index === tasks.length - 1) return;
    
    const newTasks = [...tasks];
    [newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]];
    
    const reorderedTasks = newTasks.map((task, idx) => ({
      ...task,
      queue_order: idx + 1,
    }));
    
    setTasks(reorderedTasks);

    try {
      const orders = reorderedTasks.map(task => ({
        id: task.id,
        queue_order: task.queue_order,
      }));

      await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });

      fetchQueue();
    } catch (err) {
      fetchQueue();
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-[var(--priority-critical)]';
      case 'high':
        return 'text-[var(--priority-high)]';
      case 'medium':
        return 'text-[var(--priority-medium)]';
      default:
        return 'text-[var(--priority-low)]';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-[var(--surface-1)]">
      <div className="flex min-h-screen">
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          
          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                    Queue Management
                  </h2>
                  <p className="text-[var(--text-secondary)] mt-1">
                    Manage and reorder queued tasks
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Last Updated */}
                  <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
                  </div>
                  
                  {/* Refresh Button */}
                  <button
                    onClick={fetchQueue}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                    aria-label="Refresh queue"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Bulk Actions */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">
                      Bulk Actions
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''} in queue
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleStartNext}
                      disabled={actionLoading === 'start-next' || tasks.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--status-done)] text-white font-medium hover:opacity-90 transition-opacity duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                    >
                      {actionLoading === 'start-next' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="w-4 h-4" aria-hidden="true" />
                      )}
                      Start Next
                    </button>
                    
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={actionLoading === 'cancel-all' || tasks.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--error)] text-white font-medium hover:opacity-90 transition-opacity duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                    >
                      {actionLoading === 'cancel-all' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <X className="w-4 h-4" aria-hidden="true" />
                      )}
                      Cancel All
                    </button>
                  </div>
                </div>
              </div>

              {/* Queue List */}
              <div className="card">
                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
                  Task Queue
                </h3>
                
                {loading && tasks.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" aria-hidden="true" />
                    <p>Loading queue...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                    <p className="text-lg font-medium">No tasks in queue</p>
                    <p className="mt-1">Queue is empty. Add tasks from the Tasks page.</p>
                  </div>
                ) : (
                  <div className="space-y-2" role="list" aria-label="Queued tasks">
                    {tasks.map((task, index) => (
                      <div
                        key={task.id}
                        role="listitem"
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragLeave={handleDragLeave}
                        className={`
                          flex items-center gap-3 p-4 rounded-lg border
                          transition-all duration-150 cursor-move
                          ${dragOverIndex === index 
                            ? 'border-[var(--primary)] bg-[var(--primary)]/10' 
                            : 'border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--border-default)]'
                          }
                        `}
                      >
                        {/* Drag Handle */}
                        <div 
                          className="flex-shrink-0 text-[var(--text-muted)]"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="w-5 h-5" aria-hidden="true" />
                        </div>
                        
                        {/* Position Number */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-3)] text-sm font-medium text-[var(--text-secondary)]">
                          {index + 1}
                        </div>
                        
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-[var(--text-primary)] truncate">
                              {task.title}
                            </h4>
                            <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] mt-1">
                            <span className="truncate">{task.workflow}</span>
                            {task.target_repo && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <span className="hidden sm:inline truncate">{task.target_repo}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Reorder Buttons */}
                        <div className="hidden sm:flex items-center gap-1">
                          <button
                            onClick={() => moveUp(index)}
                            disabled={index === 0}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                            aria-label={`Move ${task.title} up`}
                          >
                            <ArrowUp className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => moveDown(index)}
                            disabled={index === tasks.length - 1}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                            aria-label={`Move ${task.title} down`}
                          >
                            <ArrowDown className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                        
                        {/* Queue Order */}
                        <div className="hidden md:block text-sm text-[var(--text-muted)] tabular-nums">
                          #{task.queue_order}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="text-sm text-[var(--text-muted)]">
                <p>
                  <strong className="text-[var(--text-secondary)]">Tip:</strong> Drag and drop tasks to reorder them, or use the arrow buttons. 
                  The queue automatically refreshes every 10 seconds.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div 
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div className="w-full max-w-md p-6 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--error)]/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--error)]" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 
                  id="cancel-modal-title" 
                  className="text-lg font-semibold text-[var(--text-primary)]"
                >
                  Cancel All Tasks?
                </h3>
                <p className="text-[var(--text-secondary)] mt-2">
                  This will cancel all {tasks.length} task{tasks.length !== 1 ? 's' : ''} in the queue. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                Keep Tasks
              </button>
              <button
                onClick={handleCancelAll}
                disabled={actionLoading === 'cancel-all'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--error)] text-white font-medium hover:opacity-90 transition-opacity duration-150 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                {actionLoading === 'cancel-all' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="w-4 h-4" aria-hidden="true" />
                )}
                Cancel All Tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Import Layers icon for empty state
import { Layers } from 'lucide-react';
