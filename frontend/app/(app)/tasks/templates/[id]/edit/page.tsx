'use client';

/**
 * Edit template page — /tasks/templates/[id]/edit
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TemplateForm } from '@/components/tasks/TemplateForm';
import { getTemplate, updateTemplate } from '@/lib/templates';
import type { TaskTemplate, TaskTemplateRequest } from '@/lib/templates';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditTemplatePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [template, setTemplate] = useState<TaskTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTemplate(id)
      .then(setTemplate)
      .catch(() => setError('Template not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(data: TaskTemplateRequest) {
    await updateTemplate(id, data);
    router.push('/tasks/templates');
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-4 w-24 bg-slate-100 rounded mb-8" />
        <div className="h-7 w-1/2 bg-slate-100 rounded" />
        <div className="h-4 w-full bg-slate-50 rounded" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/tasks/templates"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                     transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Templates
        </Link>
        <div className="rounded-2xl bg-red-50/80 border border-red-200/60 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Template not found.'}
        </div>
      </div>
    );
  }

  const initialValues: Partial<TaskTemplateRequest> = {
    name: template.name,
    description: template.description ?? undefined,
    subtasks: template.subtasks
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ text: s.text, position: s.position })),
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/tasks/templates"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Templates
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Template</h1>
        <p className="text-slate-500 text-sm mt-1 truncate max-w-md">{template.name}</p>
      </div>

      <div className="glass rounded-3xl px-6 py-6">
        <TemplateForm onSubmit={handleSubmit} initialValues={initialValues} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
