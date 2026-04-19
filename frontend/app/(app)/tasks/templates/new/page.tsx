'use client';

/**
 * New template page — /tasks/templates/new
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TemplateForm } from '@/components/tasks/TemplateForm';
import { createTemplate } from '@/lib/templates';
import type { TaskTemplateRequest } from '@/lib/templates';
import { useUser } from '@/lib/user-context';

export default function NewTemplatePage() {
  const router = useRouter();
  const { user } = useUser();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/tasks/templates');
    }
  }, [user, router]);

  async function handleSubmit(data: TaskTemplateRequest) {
    await createTemplate(data);
    router.push('/tasks/templates');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/tasks/templates"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Templates
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Template</h1>
        <p className="text-slate-500 text-sm mt-1">
          Define a reusable task with a list of subtasks to choose from.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-6">
        <TemplateForm onSubmit={handleSubmit} submitLabel="Create Template" />
      </div>
    </div>
  );
}
