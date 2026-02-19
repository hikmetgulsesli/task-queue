export default function TasksPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Tasks
          </h1>
          <p className="mt-2 text-[var(--text-secondary)] font-body">
            Manage and monitor all tasks
          </p>
        </div>
        <button className="btn btn-primary">
          <span className="font-body">New Task</span>
        </button>
      </div>

      <div className="card">
        <p className="text-[var(--text-muted)] font-body">No tasks yet</p>
      </div>
    </div>
  );
}
