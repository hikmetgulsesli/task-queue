export default function StatsPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border-subtle)] pb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Statistics
        </h1>
        <p className="mt-2 text-[var(--text-secondary)] font-body">
          Performance metrics and analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Total Tasks</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)] font-heading">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Success Rate</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)] font-heading">—</p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--text-muted)] font-body">Avg Duration</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)] font-heading">—</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-heading text-xl font-semibold text-[var(--text-primary)] mb-4">
          Task History
        </h2>
        <p className="text-[var(--text-muted)] font-body">No data available yet</p>
      </div>
    </div>
  );
}
