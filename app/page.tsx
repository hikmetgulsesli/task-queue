'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Clock, 
  Play, 
  CheckCircle2, 
  XCircle,
  Plus,
  List,
  ArrowRight,
  Activity
} from 'lucide-react';

interface Stats {
  total: number;
  byStatus: {
    backlog: number;
    queued: number;
    running: number;
    done: number;
    failed: number;
    cancelled: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  successRate: number;
  averageCompletionTimeMinutes: number | null;
}

interface Task {
  id: string;
  title: string;
  status: 'backlog' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  workflow: string;
  created_at: string;
}

interface RecentTasksResponse {
  data: Task[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

interface StatsResponse {
  data: Stats;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  href,
  filter
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  color: string;
  href: string;
  filter?: string;
}) {
  const linkHref = filter ? `${href}?status=${filter}` : href;
  
  return (
    <Link 
      href={linkHref}
      className="group block bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[var(--text-secondary)] text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{value}</p>
        </div>
        <div 
          className="p-3 rounded-lg"
          style={{ backgroundColor: `rgba(${color}, 0.1)` }}
        >
          <Icon 
            className="w-6 h-6" 
            style={{ color: `rgb(${color})` }}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
        <span>View details</span>
        <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

function StatusBar({ 
  stats 
}: { 
  stats: Stats['byStatus'];
}) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  
  if (total === 0) {
    return (
      <div className="bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)]">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Status Breakdown</h3>
        <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">
          No tasks yet
        </div>
      </div>
    );
  }

  const segments = [
    { key: 'backlog', label: 'Backlog', color: '107, 114, 128', value: stats.backlog },
    { key: 'queued', label: 'Queued', color: '234, 179, 8', value: stats.queued },
    { key: 'running', label: 'Running', color: '59, 130, 246', value: stats.running },
    { key: 'done', label: 'Done', color: '34, 197, 94', value: stats.done },
    { key: 'failed', label: 'Failed', color: '239, 68, 68', value: stats.failed },
    { key: 'cancelled', label: 'Cancelled', color: '107, 114, 128', value: stats.cancelled },
  ];

  return (
    <div className="bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)]">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Status Breakdown</h3>
      
      {/* Stacked bar */}
      <div className="h-4 flex rounded-full overflow-hidden mb-4">
        {segments.map((segment) => {
          const percentage = total > 0 ? (segment.value / total) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <div
              key={segment.key}
              className="h-full transition-all duration-300 hover:opacity-80"
              style={{ 
                width: `${percentage}%`, 
                backgroundColor: `rgb(${segment.color})`,
                minWidth: percentage > 0 ? '4px' : '0'
              }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {segments.map((segment) => (
          <Link
            key={segment.key}
            href={`/tasks?status=${segment.key}`}
            className="flex items-center gap-2 text-sm hover:bg-[var(--surface-3)] rounded-lg p-2 transition-colors cursor-pointer"
          >
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: `rgb(${segment.color})` }}
            />
            <span className="text-[var(--text-secondary)]">{segment.label}</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums ml-auto">
              {segment.value}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentTasksList({ tasks }: { tasks: Task[] }) {
  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-[var(--status-running)]" />;
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-[var(--status-done)]" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-[var(--status-failed)]" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-[var(--status-queued)]" />;
      default:
        return <Layers className="w-4 h-4 text-[var(--status-backlog)]" />;
    }
  };

  const getPriorityClass = (priority: Task['priority']) => {
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)]">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recent Tasks</h3>
        <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">
          No tasks yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Tasks</h3>
        <Link 
          href="/tasks" 
          className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-1 transition-colors cursor-pointer"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="space-y-2">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={`/tasks/${task.id}`}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--surface-3)] transition-colors group cursor-pointer"
          >
            {getStatusIcon(task.status)}
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--primary)] transition-colors">
                {task.title}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {task.workflow} • {formatDate(task.created_at)}
              </p>
            </div>
            <span className={`text-xs font-medium uppercase ${getPriorityClass(task.priority)}`}>
              {task.priority}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)]">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h3>
      <div className="space-y-3">
        <Link
          href="/tasks/new"
          className="flex items-center gap-3 p-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">New Task</span>
        </Link>
        <Link
          href="/tasks?status=queued"
          className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-3)] text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-all duration-200 cursor-pointer"
        >
          <List className="w-5 h-5" />
          <span className="font-medium">View Queue</span>
        </Link>
        <Link
          href="/tasks?status=running"
          className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-3)] text-[var(--text-primary)] hover:bg-[var(--border-default)] transition-all duration-200 cursor-pointer"
        >
          <Activity className="w-5 h-5" />
          <span className="font-medium">Running Tasks</span>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch stats
        const statsRes = await fetch('/api/stats');
        if (!statsRes.ok) throw new Error('Failed to fetch stats');
        const statsData: StatsResponse = await statsRes.json();
        setStats(statsData.data);

        // Fetch recent tasks (last 10 created)
        const tasksRes = await fetch('/api/tasks?limit=10');
        if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
        const tasksData: RecentTasksResponse = await tasksRes.json();
        setRecentTasks(tasksData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-[var(--text-muted)]">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span>Loading dashboard...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[var(--surface-2)] rounded-xl p-8 border border-[var(--error)] text-center">
            <XCircle className="w-12 h-12 text-[var(--error)] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Failed to load dashboard</h2>
            <p className="text-[var(--text-secondary)] mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Dashboard</h1>
          <p className="text-[var(--text-secondary)]">
            Overview of your task queue and recent activity
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              title="Total Tasks"
              value={stats.total}
              icon={Layers}
              color="107, 114, 128"
              href="/tasks"
            />
            <StatCard
              title="Queued"
              value={stats.byStatus.queued}
              icon={Clock}
              color="234, 179, 8"
              href="/tasks"
              filter="queued"
            />
            <StatCard
              title="Running"
              value={stats.byStatus.running}
              icon={Play}
              color="59, 130, 246"
              href="/tasks"
              filter="running"
            />
            <StatCard
              title="Done Today"
              value={stats.byStatus.done}
              icon={CheckCircle2}
              color="34, 197, 94"
              href="/tasks"
              filter="done"
            />
            <StatCard
              title="Failed"
              value={stats.byStatus.failed}
              icon={XCircle}
              color="239, 68, 68"
              href="/tasks"
              filter="failed"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Status breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {stats && <StatusBar stats={stats.byStatus} />}
            <RecentTasksList tasks={recentTasks} />
          </div>

          {/* Right column - Quick actions */}
          <div className="space-y-6">
            <QuickActions />
            
            {/* Success Rate Card */}
            {stats && (
              <div className="bg-[var(--surface-2)] rounded-xl p-6 border border-[var(--border-subtle)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Success Rate</h3>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        fill="none"
                        stroke="var(--surface-3)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        fill="none"
                        stroke="var(--success)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(stats.successRate / 100) * 251.2} 251.2`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
                        {Math.round(stats.successRate)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {stats.averageCompletionTimeMinutes ? (
                        <>
                          Average completion time:<br />
                          <span className="text-[var(--text-primary)] font-medium">
                            {stats.averageCompletionTimeMinutes.toFixed(1)} minutes
                          </span>
                        </>
                      ) : (
                        'No completed tasks yet'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
