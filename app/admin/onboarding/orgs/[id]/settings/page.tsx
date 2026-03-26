import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import { getSupabaseAdmin } from '@/lib/supabase';
import { saveOrgSettings } from '../../actions';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function OnboardingOrgSettingsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const admin = getSupabaseAdmin();

  const { data: org, error } = await admin.from('orgs').select('*').eq('id', id).maybeSingle();

  if (error || !org) {
    notFound();
  }

  const { data: templates } = await admin.from('templates').select('id, name, is_default').order('name');

  const { data: staff } = await admin.from('staff').select('id, name, email').order('name');

  const save = saveOrgSettings.bind(null, id);
  const logoUrl = (org as { logo_url?: string | null }).logo_url ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href={`${ONBOARDING_BASE}/orgs/${id}`} className="text-sm text-primary hover:underline">
          ← {org.name}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Organization settings</h1>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <form action={save} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="name">
            Organization name *
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={org.name}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="slug">
            URL slug *
          </label>
          <input
            id="slug"
            name="slug"
            required
            defaultValue={org.slug}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="logo_url">
            Logo image URL (optional)
          </label>
          <input
            id="logo_url"
            name="logo_url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://example.com/logo.png"
            defaultValue={logoUrl ?? ''}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">
            Direct HTTPS link to a PNG, JPG, or SVG. Shown on the public onboarding checklist. Leave empty to hide.
          </p>
          {logoUrl ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white">
                <Image
                  src={logoUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
              <span className="text-xs text-gray-600">How it will appear on the checklist</span>
            </div>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="contact_name">
            Contact name
          </label>
          <input
            id="contact_name"
            name="contact_name"
            defaultValue={org.contact_name ?? ''}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="contact_email">
            Contact email
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={org.contact_email ?? ''}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="template_id">
            Template
          </label>
          <select
            id="template_id"
            name="template_id"
            defaultValue={org.template_id ?? ''}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="assigned_rep">
            Assigned rep
          </label>
          <select
            id="assigned_rep"
            name="assigned_rep"
            defaultValue={org.assigned_rep ?? ''}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="pin">
            PIN (leave blank to keep unchanged)
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            placeholder="••••••"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={org.status}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button type="submit" className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white">
          Save changes
        </button>
      </form>
    </div>
  );
}
