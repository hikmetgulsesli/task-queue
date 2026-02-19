export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border-subtle)] pb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Dashboard
        </h1>
        <p className="mt-2 text-[var(--text-secondary)] font-body">
          Overview of your task queue and active runs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Queue Status</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)] font-heading">Active</p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Running Tasks</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)] font-heading">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Queued</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)] font-heading">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Completed Today</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)] font-heading">0</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-heading text-xl font-semibold text-[var(--text-primary)] mb-4">
          Recent Activity
        </h2>
        <p className="text-[var(--text-muted)] font-body">No recent activity</p>
      </div>
    </div>
  );
}
