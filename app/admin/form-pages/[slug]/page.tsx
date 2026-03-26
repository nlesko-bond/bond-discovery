'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, ExternalLink } from 'lucide-react';
import type { FormPageBranding, FormPageConfigAdmin } from '@/types/form-pages';

export default function EditFormPagePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [config, setConfig] = useState<FormPageConfigAdmin | null>(null);
  const [staffPassword, setStaffPassword] = useState('');
  const [allowedIdsText, setAllowedIdsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/form-pages/${slug}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        const c = data.config as FormPageConfigAdmin;
        setConfig(c);
        setAllowedIdsText(c.allowed_questionnaire_ids?.join(', ') || '');
      } catch {
        setError('Failed to load config');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const allowed = allowedIdsText.trim()
        ? allowedIdsText
            .split(/[\s,]+/)
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n))
        : null;

      const body: Record<string, unknown> = {
        name: config.name,
        slug: config.slug,
        is_active: config.is_active,
        organization_id: config.organization_id,
        default_questionnaire_id: config.default_questionnaire_id,
        allowed_questionnaire_ids: allowed,
        staff_lock_to_default_questionnaire: true,
        branding: config.branding,
        default_range_days: config.default_range_days,
        max_range_days_cap: config.max_range_days_cap,
        titles_per_page: config.titles_per_page,
      };
      if (staffPassword) body.staff_password = staffPassword;

      const res = await fetch(`/api/admin/form-pages/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setConfig(data.config);
      setStaffPassword('');
      if (data.config.slug !== slug) {
        router.replace(`/admin/form-pages/${data.config.slug}`);
      }
      setSuccessMessage('Saved successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updateBranding(updates: Partial<FormPageBranding>) {
    if (!config) return;
    setConfig({ ...config, branding: { ...config.branding, ...updates } });
  }

  if (loading) {
    return (
      <div className="max-w-4xl animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
        <div className="h-96 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="max-w-4xl">
        <p className="text-red-600">{error}</p>
        <Link href="/admin/form-pages" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to list
        </Link>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/form-pages" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/form-responses/${config.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <ExternalLink size={14} /> Staff page
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{successMessage}</div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="space-y-6">
        <Section title="General">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Page name" value={config.name} onChange={(v) => setConfig({ ...config, name: v })} />
            <Field label="Slug" value={config.slug} onChange={(v) => setConfig({ ...config, slug: v })} />
            <Field
              label="Organization ID"
              type="number"
              value={String(config.organization_id)}
              onChange={(v) => setConfig({ ...config, organization_id: parseInt(v, 10) || 0 })}
            />
            <Field
              label="Default questionnaire ID"
              type="number"
              value={String(config.default_questionnaire_id)}
              onChange={(v) => setConfig({ ...config, default_questionnaire_id: parseInt(v, 10) || 0 })}
            />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allowed questionnaire IDs (comma-separated, empty = all org forms)
              </label>
              <input
                type="text"
                value={allowedIdsText}
                onChange={(e) => setAllowedIdsText(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. 12, 34, 56"
              />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="fp_active"
                checked={config.is_active}
                onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="fp_active" className="text-sm text-gray-700">
                Page active
              </label>
            </div>
            <p className="col-span-2 text-xs text-gray-500">
              Staff responses view always uses the default questionnaire ID above (form picker is
              disabled).
            </p>
          </div>
        </Section>

        <Section title="Staff password">
          <p className="text-sm text-gray-500 mb-3">
            {config.has_staff_password
              ? 'Password is set. Enter a new value below to rotate it.'
              : 'No password set yet — staff cannot sign in until you set one.'}
          </p>
          <Field
            label="New staff password (optional)"
            type="password"
            value={staffPassword}
            onChange={setStaffPassword}
          />
        </Section>

        <Section title="Branding (staff page)">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Company / org display name"
              value={config.branding.companyName}
              onChange={(v) => updateBranding({ companyName: v })}
            />
            <Field
              label="Logo URL"
              value={config.branding.logo || ''}
              onChange={(v) => updateBranding({ logo: v || null })}
              placeholder="https://..."
            />
            <ColorField label="Primary" value={config.branding.primaryColor} onChange={(v) => updateBranding({ primaryColor: v })} />
            <ColorField
              label="Secondary"
              value={config.branding.secondaryColor}
              onChange={(v) => updateBranding({ secondaryColor: v })}
            />
            <ColorField label="Accent" value={config.branding.accentColor} onChange={(v) => updateBranding({ accentColor: v })} />
          </div>
        </Section>

        <Section title="Data limits">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Default date range (days)"
              type="number"
              value={String(config.default_range_days)}
              onChange={(v) => setConfig({ ...config, default_range_days: parseInt(v, 10) || 60 })}
            />
            <Field
              label="Max range cap (days)"
              type="number"
              value={String(config.max_range_days_cap)}
              onChange={(v) => setConfig({ ...config, max_range_days_cap: parseInt(v, 10) || 90 })}
            />
            <Field
              label="Completions per page"
              type="number"
              value={String(config.titles_per_page)}
              onChange={(v) => setConfig({ ...config, titles_per_page: parseInt(v, 10) || 25 })}
            />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Set <code className="bg-gray-100 px-1 rounded">BOND_FORMS_DATABASE_URL</code> on the server to the Bond
            read-replica connection string.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 border rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
        />
      </div>
    </div>
  );
}
