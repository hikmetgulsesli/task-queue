'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  Calendar,
  FileText,
  GitBranch,
  Layers,
  AlertTriangle
} from 'lucide-react';

interface FormErrors {
  title?: string;
  description?: string;
  priority?: string;
  workflow?: string;
  target_repo?: string;
  scheduled_at?: string;
  general?: string;
}

interface FormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  workflow: 'feature-dev' | 'bug-fix' | 'security-audit';
  target_repo: string;
  scheduled_at: string;
}

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-blue-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
] as const;

const workflowOptions = [
  { value: 'feature-dev', label: 'Feature Development' },
  { value: 'bug-fix', label: 'Bug Fix' },
  { value: 'security-audit', label: 'Security Audit' },
] as const;

export default function NewTaskPage(): JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'medium',
    workflow: 'feature-dev',
    target_repo: '',
    scheduled_at: '',
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title must be 200 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload: Record<string, string | undefined> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        workflow: formData.workflow,
        target_repo: formData.target_repo.trim() || undefined,
        scheduled_at: formData.scheduled_at || undefined,
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.code === 'VALIDATION_ERROR' && data.error?.details) {
          const fieldErrors: FormErrors = {};
          data.error.details.forEach((err: { field: string; message: string }) => {
            fieldErrors[err.field as keyof FormErrors] = err.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.error?.message || 'Failed to create task' });
        }
        return;
      }

      // Success - redirect to task list
      router.push('/tasks');
      router.refresh();
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/tasks"
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors duration-150 cursor-pointer"
          aria-label="Go back to tasks"
        >
          <ArrowLeft className="w-5 h-5" />
        </a>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            New Task
          </h1>
          <p className="text-[var(--text-secondary)]">
            Create a new task for the agent queue
          </p>
        </div>
      </div>

      {/* General Error */}
      {errors.general && (
        <div className="card border-l-4 border-l-red-500 mb-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>{errors.general}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="card">
          <label 
            htmlFor="title" 
            className="block text-sm font-medium text-[var(--text-primary)] mb-2"
          >
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter task title..."
            className={`input ${errors.title ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_20px_rgba(239,68,68,0.3)]' : ''}`}
            aria-invalid={errors.title ? 'true' : 'false'}
            aria-describedby={errors.title ? 'title-error' : undefined}
            autoComplete="off"
          />
          {errors.title ? (
            <p id="title-error" className="mt-2 text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {errors.title}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              A clear, concise title for this task
            </p>
          )}
        </div>

        {/* Description Field */}
        <div className="card">
          <label 
            htmlFor="description" 
            className="block text-sm font-medium text-[var(--text-primary)] mb-2"
          >
            <span className="inline-flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" />
              Description
            </span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter detailed description (markdown supported)..."
            rows={6}
            className={`input font-mono text-sm resize-y min-h-[120px] ${errors.description ? 'border-red-500' : ''}`}
            aria-invalid={errors.description ? 'true' : 'false'}
          />
          {errors.description && (
            <p className="mt-2 text-sm text-red-400">{errors.description}</p>
          )}
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Markdown formatting is supported. Use this for detailed instructions.
          </p>
        </div>

        {/* Priority and Workflow Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Priority Field */}
          <div className="card">
            <label 
              htmlFor="priority" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--text-muted)]" />
                Priority
              </span>
            </label>
            <div className="relative">
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input appearance-none pr-10 cursor-pointer"
                aria-label="Select priority"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>
            {errors.priority && (
              <p className="mt-2 text-sm text-red-400">{errors.priority}</p>
            )}
          </div>

          {/* Workflow Field */}
          <div className="card">
            <label 
              htmlFor="workflow" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              <span className="inline-flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
                Workflow
              </span>
            </label>
            <div className="relative">
              <select
                id="workflow"
                name="workflow"
                value={formData.workflow}
                onChange={handleChange}
                className="input appearance-none pr-10 cursor-pointer"
                aria-label="Select workflow"
              >
                {workflowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <GitBranch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>
            {errors.workflow && (
              <p className="mt-2 text-sm text-red-400">{errors.workflow}</p>
            )}
          </div>
        </div>

        {/* Target Repo and Scheduled At Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Repo Field */}
          <div className="card">
            <label 
              htmlFor="target_repo" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              <span className="inline-flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
                Target Repository
              </span>
            </label>
            <input
              type="text"
              id="target_repo"
              name="target_repo"
              value={formData.target_repo}
              onChange={handleChange}
              placeholder="/path/to/repo or github.com/user/repo"
              className={`input ${errors.target_repo ? 'border-red-500' : ''}`}
              autoComplete="off"
            />
            {errors.target_repo && (
              <p className="mt-2 text-sm text-red-400">{errors.target_repo}</p>
            )}
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Optional: Path to the target repository
            </p>
          </div>

          {/* Scheduled At Field */}
          <div className="card">
            <label 
              htmlFor="scheduled_at" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                Scheduled For
              </span>
            </label>
            <input
              type="datetime-local"
              id="scheduled_at"
              name="scheduled_at"
              value={formData.scheduled_at}
              onChange={handleChange}
              className={`input ${errors.scheduled_at ? 'border-red-500' : ''}`}
            />
            {errors.scheduled_at && (
              <p className="mt-2 text-sm text-red-400">{errors.scheduled_at}</p>
            )}
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Optional: Schedule this task for a future time
            </p>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary flex-1 sm:flex-none sm:min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Create Task</span>
              </>
            )}
          </button>
          <a
            href="/tasks"
            className="btn btn-secondary flex-1 sm:flex-none sm:min-w-[120px] text-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
