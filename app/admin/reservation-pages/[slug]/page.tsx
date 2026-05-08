'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, ExternalLink } from 'lucide-react';
import type { IReservationPageConfig, ReservationPageBranding } from '@/types/reservation-pages';
import { MIN_VIEWER_PASSWORD_LENGTH } from '@/lib/reservation-page-password';

export default function EditReservationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [config, setConfig] = useState<IReservationPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [organizationIdsStr, setOrganizationIdsStr] = useState('');
  const [newViewerPassword, setNewViewerPassword] = useState('');
  const [confirmViewerPassword, setConfirmViewerPassword] = useState('');
  const [clearViewerPassword, setClearViewerPassword] = useState(false);

  useEffect(() => {
    void fetchConfig();
  }, [slug]);

  async function fetchConfig() {
    try {
      const res = await fetch(`/api/admin/reservation-pages/${slug}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      const c = data.config as IReservationPageConfig;
      setConfig(c);
      setOrganizationIdsStr(c.organization_ids.join(', '));
    } catch {
      setError('Failed to load config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    if (!clearViewerPassword && newViewerPassword.trim()) {
      if (newViewerPassword !== confirmViewerPassword) {
        setError('New passwords do not match');
        return;
      }
      if (newViewerPassword.trim().length < MIN_VIEWER_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_VIEWER_PASSWORD_LENGTH} characters`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload: Record<string, unknown> = {
        ...config,
        organization_ids: organizationIdsStr,
      };
      if (clearViewerPassword) {
        payload.viewer_password_clear = true;
      } else if (newViewerPassword.trim()) {
        payload.viewer_password_new = newViewerPassword.trim();
      }
      const res = await fetch(`/api/admin/reservation-pages/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      const next = data.config as IReservationPageConfig;
      setConfig(next);
      setOrganizationIdsStr(next.organization_ids.join(', '));
      setNewViewerPassword('');
      setConfirmViewerPassword('');
      setClearViewerPassword(false);
      setSuccessMessage('Saved successfully!');
      if (next.slug !== slug) {
        router.replace(`/admin/reservation-pages/${next.slug}`);
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updateBranding(updates: Partial<ReservationPageBranding>) {
    if (!config) return;
    setConfig({ ...config, branding: { ...config.branding, ...updates } });
  }

  if (loading) {
    return (
      <div className="max-w-4xl animate-pulse">
        <div className="mb-6 h-8 w-48 rounded bg-gray-200" />
        <div className="h-96 rounded-lg bg-gray-200" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="max-w-4xl">
        <p className="text-red-600">{error}</p>
        <Link href="/admin/reservation-pages" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/reservation-pages" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/reservations/${config.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <ExternalLink size={14} /> Preview
          </a>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {successMessage ? <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{successMessage}</div> : null}
      {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="space-y-6">
        <Section title="General">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-center gap-2">
              {config.hasViewerPassword ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  Password protected
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Public</span>
              )}
            </div>
            <Field label="Page name" value={config.name} onChange={(v) => setConfig({ ...config, name: v })} />
            <Field label="Slug" value={config.slug} onChange={(v) => setConfig({ ...config, slug: v })} />
            <div className="col-span-2">
              <Field
                label="Organization IDs (comma-separated)"
                value={organizationIdsStr}
                onChange={setOrganizationIdsStr}
              />
            </div>
            <Field
              label="Page header title"
              value={config.page_title || ''}
              onChange={(v) => setConfig({ ...config, page_title: v || null })}
            />
            <Field
              label="Page subtitle"
              value={config.page_subtitle || ''}
              onChange={(v) => setConfig({ ...config, page_subtitle: v || null })}
            />
          </div>
        </Section>

        <Section title="Access">
          <label className="mb-4 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={clearViewerPassword}
              onChange={(e) => setClearViewerPassword(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-800">Remove password protection</span>
          </label>
          <div className={`grid grid-cols-2 gap-4 ${clearViewerPassword ? 'pointer-events-none opacity-50' : ''}`}>
            <PasswordField
              label={`New viewer password (min ${MIN_VIEWER_PASSWORD_LENGTH} chars, optional)`}
              value={newViewerPassword}
              onChange={setNewViewerPassword}
            />
            <PasswordField label="Confirm new password" value={confirmViewerPassword} onChange={setConfirmViewerPassword} />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Production needs{' '}
            <code className="rounded bg-gray-100 px-1 font-mono text-[0.7rem]">RESERVATION_PAGE_ACCESS_SECRET</code>{' '}
            so unlock cookies can be signed.
          </p>
        </Section>

        <Section title="Branding">
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Primary" value={config.branding.primaryColor} onChange={(v) => updateBranding({ primaryColor: v })} />
            <ColorField label="Accent" value={config.branding.accentColor} onChange={(v) => updateBranding({ accentColor: v })} />
            <ColorField
              label="Accent light"
              value={config.branding.accentColorLight || ''}
              onChange={(v) => updateBranding({ accentColorLight: v })}
            />
            <ColorField label="Background" value={config.branding.bgColor} onChange={(v) => updateBranding({ bgColor: v })} />
            <Field label="Heading font" value={config.branding.fontHeading} onChange={(v) => updateBranding({ fontHeading: v })} />
            <Field label="Body font" value={config.branding.fontBody} onChange={(v) => updateBranding({ fontBody: v })} />
            <div className="col-span-2">
              <Field
                label="Logo URL"
                value={config.branding.logoUrl || ''}
                onChange={(v) => updateBranding({ logoUrl: v || null })}
                placeholder="https://..."
              />
            </div>
            <div className="col-span-2">
              <Field
                label="Hero title (optional; also used as default header if page title empty)"
                value={config.branding.heroTitle || ''}
                onChange={(v) => updateBranding({ heroTitle: v || null })}
              />
            </div>
            <div className="col-span-2">
              <Field
                label="Hero subtitle"
                value={config.branding.heroSubtitle || ''}
                onChange={(v) => updateBranding({ heroSubtitle: v || null })}
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </label>
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
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 font-mono text-sm"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
