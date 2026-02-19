export default function BoardPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border-subtle)] pb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Kanban Board
        </h1>
        <p className="mt-2 text-[var(--text-secondary)] font-body">
          Drag and drop to organize tasks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card min-h-[400px]">
          <h3 className="font-heading text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Backlog
          </h3>
          <p className="text-[var(--text-muted)] font-body text-sm">No tasks</p>
        </div>
        
        <div className="card min-h-[400px]">
          <h3 className="font-heading text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Queued
          </h3>
          <p className="text-[var(--text-muted)] font-body text-sm">No tasks</p>
        </div>
        
        <div className="card min-h-[400px]">
          <h3 className="font-heading text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Running
          </h3>
          <p className="text-[var(--text-muted)] font-body text-sm">No tasks</p>
        </div>
        
        <div className="card min-h-[400px]">
          <h3 className="font-heading text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Done
          </h3>
          <p className="text-[var(--text-muted)] font-body text-sm">No tasks</p>
        </div>
      </div>
    </div>
  );
}
