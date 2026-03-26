import Link from 'next/link';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createOrg } from '../actions';

type SearchParams = Promise<{ error?: string }>;

export default async function NewOnboardingOrgPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = getSupabaseAdmin();
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const { data: templates } = await admin.from('templates').select('id, name, is_default').order('name');

  const { data: staff } = await admin.from('staff').select('id, name, email').order('name');

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href={`${ONBOARDING_BASE}/orgs`} className="text-sm text-primary hover:underline">
          ← Organizations
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">New organization</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create an onboarding checklist for a new org and share the link.
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <form action={createOrg} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="name">
            Organization name *
          </label>
          <input
            id="name"
            name="name"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="slug">
            URL slug
          </label>
          <input
            id="slug"
            name="slug"
            placeholder="Auto-generated from name if empty"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="contact_name">
            Contact name
          </label>
          <input id="contact_name" name="contact_name" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="contact_email">
            Contact email
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="template_id">
            Template *
          </label>
          <select
            id="template_id"
            name="template_id"
            required
            defaultValue={templates?.find((t) => t.is_default)?.id ?? templates?.[0]?.id}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="assigned_rep">
            Assigned rep
          </label>
          <select id="assigned_rep" name="assigned_rep" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
            <option value="">Default to me</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="pin">
            PIN (optional)
          </label>
          <input id="pin" name="pin" type="password" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          <p className="mt-1 text-xs text-gray-500">If set, org users must enter this PIN before seeing the checklist.</p>
        </div>
        <button type="submit" className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-700">
          Create organization
        </button>
      </form>
    </div>
  );
}
