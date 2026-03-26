import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { Suspense } from 'react';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DeleteTemplateForm } from './DeleteTemplateForm';
import { saveTemplate } from './actions';
import { TemplatesSavedRefresh } from './TemplatesSavedRefresh';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ error?: string; saved?: string; deleted?: string }>;

export default async function OnboardingTemplatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  const admin = getSupabaseAdmin();
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const showSaved = sp.saved === '1';
  const showDeleted = sp.deleted === '1';

  const { data: templates } = await admin.from('templates').select('*').order('created_at', { ascending: false });

  const defaultSteps: TemplateStep[] = [];

  return (
    <div className="space-y-10">
      <Suspense fallback={null}>
        <TemplatesSavedRefresh />
      </Suspense>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Onboarding templates</h1>
        <p className="mt-1 text-sm text-gray-600">
          Step definitions are stored as JSON. Each step should include title, time, description, links (label, url,
          icon), and doneWhen.
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {showSaved ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          Template saved. The list below is up to date.
        </div>
      ) : null}

      {showDeleted ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          Template deleted.
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">New template</h2>
        <form action={saveTemplate} className="mt-4 space-y-3">
          <input type="hidden" name="id" value="" />
          <div>
            <label className="text-sm font-medium text-gray-900" htmlFor="new-name">
              Name
            </label>
            <input
              id="new-name"
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-900" htmlFor="new-steps">
              Steps (JSON array)
            </label>
            <textarea
              id="new-steps"
              name="steps_json"
              required
              rows={12}
              defaultValue={JSON.stringify(defaultSteps, null, 2)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input type="checkbox" name="is_default" value="on" />
            Set as default template
          </label>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            Create template
          </button>
        </form>
      </section>

      <div className="space-y-8">
        {(templates ?? []).map((t) => {
          const steps = t.steps as TemplateStep[];
          return (
            <section key={t.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t.name}
                  {t.is_default ? (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Default
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-gray-600">{Array.isArray(steps) ? steps.length : 0} steps</p>
              </div>
              <form action={saveTemplate} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <div>
                  <label className="text-sm font-medium text-gray-900">Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={t.name}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900">Steps (JSON)</label>
                  <textarea
                    name="steps_json"
                    required
                    rows={14}
                    defaultValue={JSON.stringify(steps, null, 2)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-900">
                  <input type="checkbox" name="is_default" value="on" defaultChecked={t.is_default} />
                  Default template
                </label>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                  Save
                </button>
              </form>
              <DeleteTemplateForm id={t.id} />
            </section>
          );
        })}
      </div>

      <p className="text-sm text-gray-600">
        <Link href={`${ONBOARDING_BASE}/dashboard`} className="text-primary hover:underline">
          Back to onboarding dashboard
        </Link>
      </p>
    </div>
  );
}
