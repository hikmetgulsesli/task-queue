'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, X, Calendar } from 'lucide-react';

interface FormErrors {
  title?: string;
  priority?: string;
  [key: string]: string | undefined;
}

export default function NewTaskPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    workflow: 'feature-dev',
    target_repo: '',
    scheduled_at: '',
  });

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  const workflows = [
    { value: 'feature-dev', label: 'Feature Development' },
    { value: 'bugfix', label: 'Bug Fix' },
    { value: 'hotfix', label: 'Hot Fix' },
    { value: 'refactor', label: 'Refactor' },
    { value: 'docs', label: 'Documentation' },
  ];

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!['low', 'medium', 'high', 'critical'].includes(formData.priority)) {
      newErrors.priority = 'Invalid priority';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          priority: formData.priority,
          workflow: formData.workflow,
          target_repo: formData.target_repo.trim() || null,
          scheduled_at: formData.scheduled_at || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to create task');
      }

      router.push('/');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors duration-150 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Create New Task</h1>
        </div>

        {/* Error Toast */}
        {apiError && (
          <div className="mb-6 p-4 bg-[var(--error)]/10 border border-[var(--error)] rounded-lg text-[var(--error)]">
            {apiError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-4 py-2 bg-[var(--surface-2)] border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-colors duration-150 ${
                errors.title ? 'border-[var(--error)]' : 'border-[var(--border-subtle)]'
              }`}
              placeholder="Enter task title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-[var(--error)]">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-colors duration-150 resize-none"
              placeholder="Enter task description (optional)"
            />
          </div>

          {/* Priority & Workflow Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium mb-2">
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-colors duration-150 cursor-pointer"
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Workflow */}
            <div>
              <label htmlFor="workflow" className="block text-sm font-medium mb-2">
                Workflow
              </label>
              <select
                id="workflow"
                value={formData.workflow}
                onChange={(e) => setFormData({ ...formData, workflow: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-colors duration-150 cursor-pointer"
              >
                {workflows.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Repo */}
          <div>
            <label htmlFor="target_repo" className="block text-sm font-medium mb-2">
              Target Repository
            </label>
            <input
              type="text"
              id="target_repo"
              value={formData.target_repo}
              onChange={(e) => setFormData({ ...formData, target_repo: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-colors duration-150"
              placeholder="e.g., owner/repo"
            />
          </div>

          {/* Scheduled At */}
          <div>
            <label htmlFor="scheduled_at" className="block text-sm font-medium mb-2">
              Scheduled Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                id="scheduled_at"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] transition-colors duration-150"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors duration-150 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] rounded-lg font-medium transition-colors duration-150 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
