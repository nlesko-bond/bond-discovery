'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, ExternalLink } from 'lucide-react';
import { MembershipPageConfig, MembershipBranding, CategoryOverride } from '@/types/membership';

export default function EditMembershipPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [config, setConfig] = useState<MembershipPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, [slug]);

  async function fetchConfig() {
    try {
      const res = await fetch(`/api/admin/memberships/${slug}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setConfig(data.config);
    } catch {
      setError('Failed to load config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/memberships/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error('Save failed');

      const data = await res.json();
      setConfig(data.config);
      setSuccessMessage('Saved successfully!');

      if (data.config.slug !== slug) {
        router.replace(`/admin/memberships/${data.config.slug}`);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updateBranding(updates: Partial<MembershipBranding>) {
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
        <Link href="/admin/memberships" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to list
        </Link>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/memberships" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/memberships/${config.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <ExternalLink size={14} /> Preview
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{successMessage}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-6">
        {/* General */}
        <Section title="General">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Page Name" value={config.name} onChange={(v) => setConfig({ ...config, name: v })} />
            <Field label="Slug" value={config.slug} onChange={(v) => setConfig({ ...config, slug: v })} />
            <Field label="Organization ID" type="number" value={String(config.organization_id)} onChange={(v) => setConfig({ ...config, organization_id: parseInt(v) || 0 })} />
            <Field label="Organization Name" value={config.organization_name || ''} onChange={(v) => setConfig({ ...config, organization_name: v })} />
            <Field label="Organization Slug (for Bond URLs)" value={config.organization_slug || ''} onChange={(v) => setConfig({ ...config, organization_slug: v })} />
            <Field label="Facility ID" type="number" value={config.facility_id ? String(config.facility_id) : ''} onChange={(v) => setConfig({ ...config, facility_id: v ? parseInt(v) : null })} />
          </div>
        </Section>

        {/* Branding */}
        <Section title="Branding">
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Primary Color" value={config.branding.primaryColor} onChange={(v) => updateBranding({ primaryColor: v })} />
            <ColorField label="Accent Color" value={config.branding.accentColor} onChange={(v) => updateBranding({ accentColor: v })} />
            <ColorField label="Accent Light" value={config.branding.accentColorLight || ''} onChange={(v) => updateBranding({ accentColorLight: v })} />
            <ColorField label="Background Color" value={config.branding.bgColor} onChange={(v) => updateBranding({ bgColor: v })} />
            <Field label="Heading Font" value={config.branding.fontHeading} onChange={(v) => updateBranding({ fontHeading: v })} />
            <Field label="Body Font" value={config.branding.fontBody} onChange={(v) => updateBranding({ fontBody: v })} />
            <Field label="Logo URL" value={config.branding.logoUrl || ''} onChange={(v) => updateBranding({ logoUrl: v || null })} placeholder="https://..." />
            <div className="col-span-2">
              <Field label="Hero Title" value={config.branding.heroTitle || ''} onChange={(v) => updateBranding({ heroTitle: v || null })} placeholder="WHITE MARSH\nSWIM CLUB" />
            </div>
            <div className="col-span-2">
              <Field label="Hero Subtitle" value={config.branding.heroSubtitle || ''} onChange={(v) => updateBranding({ heroSubtitle: v || null })} placeholder="Summer 2026 Pool Memberships..." />
            </div>
          </div>
        </Section>

        {/* Filters */}
        <Section title="Membership Filters">
          <div className="space-y-4">
            <Field
              label="Include Only (membership IDs, comma-separated)"
              value={config.membership_ids_include?.join(', ') || ''}
              onChange={(v) => setConfig({
                ...config,
                membership_ids_include: v.trim() ? v.split(',').map((s) => parseInt(s.trim())).filter(Boolean) : null,
              })}
              placeholder="Leave empty to include all"
            />
            <Field
              label="Exclude (membership IDs, comma-separated)"
              value={config.membership_ids_exclude?.join(', ') || ''}
              onChange={(v) => setConfig({
                ...config,
                membership_ids_exclude: v.trim() ? v.split(',').map((s) => parseInt(s.trim())).filter(Boolean) : null,
              })}
              placeholder="Leave empty to exclude none"
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="include_not_open"
                checked={config.include_not_open_for_registration}
                onChange={(e) => setConfig({ ...config, include_not_open_for_registration: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="include_not_open" className="text-sm text-gray-700">
                Show memberships not yet open for registration
              </label>
            </div>
          </div>
        </Section>

        {/* Category Overrides */}
        <Section title="Category Overrides">
          <p className="text-sm text-gray-500 mb-4">
            Define custom categories based on age range or name matching. Overrides are checked top-to-bottom; the first match wins.
          </p>
          <CategoryOverridesEditor
            overrides={config.category_overrides || []}
            onChange={(overrides) => setConfig({ ...config, category_overrides: overrides.length > 0 ? overrides : null })}
          />
        </Section>

        {/* Links */}
        <Section title="Links & Footer">
          <div className="space-y-4">
            <Field
              label="Registration Link Template"
              value={config.registration_link_template}
              onChange={(v) => setConfig({ ...config, registration_link_template: v })}
              placeholder="https://bondsports.co/{orgSlug}/memberships/{membershipSlug}/{membershipId}"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nav Links (JSON array)
              </label>
              <textarea
                value={JSON.stringify(config.nav_links || [], null, 2)}
                onChange={(e) => {
                  try {
                    setConfig({ ...config, nav_links: JSON.parse(e.target.value) });
                  } catch { /* allow invalid JSON while editing */ }
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Footer Info (JSON)
              </label>
              <textarea
                value={JSON.stringify(config.footer_info || {}, null, 2)}
                onChange={(e) => {
                  try {
                    setConfig({ ...config, footer_info: JSON.parse(e.target.value) });
                  } catch { /* allow invalid JSON while editing */ }
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                rows={4}
              />
            </div>
          </div>
        </Section>

        {/* Cache */}
        <Section title="Cache">
          <Field
            label="Cache TTL (seconds)"
            type="number"
            value={String(config.cache_ttl)}
            onChange={(v) => setConfig({ ...config, cache_ttl: parseInt(v) || 900 })}
          />
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
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function CategoryOverridesEditor({
  overrides,
  onChange,
}: {
  overrides: CategoryOverride[];
  onChange: (overrides: CategoryOverride[]) => void;
}) {
  function addOverride() {
    onChange([
      ...overrides,
      { key: '', label: '', badgeBg: '#E8F5E9', badgeColor: '#2E7D32' },
    ]);
  }

  function removeOverride(index: number) {
    onChange(overrides.filter((_, i) => i !== index));
  }

  function updateOverride(index: number, updates: Partial<CategoryOverride>) {
    onChange(overrides.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  }

  return (
    <div className="space-y-4">
      {overrides.map((override, idx) => (
        <div key={idx} className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Override #{idx + 1}</span>
            <button
              onClick={() => removeOverride(idx)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Key (e.g. senior, youth)"
              value={override.key}
              onChange={(v) => updateOverride(idx, { key: v })}
              placeholder="senior"
            />
            <Field
              label="Tab Label (e.g. Senior (65+))"
              value={override.label}
              onChange={(v) => updateOverride(idx, { label: v })}
              placeholder="Senior (65+)"
            />
            <Field
              label="Min Age (match if minAgeYears >=)"
              type="number"
              value={override.minAge != null ? String(override.minAge) : ''}
              onChange={(v) => updateOverride(idx, { minAge: v ? parseInt(v) : undefined })}
              placeholder="e.g. 65"
            />
            <Field
              label="Max Age (match if maxAgeYears <=)"
              type="number"
              value={override.maxAge != null ? String(override.maxAge) : ''}
              onChange={(v) => updateOverride(idx, { maxAge: v ? parseInt(v) : undefined })}
              placeholder="e.g. 120"
            />
            <div className="col-span-2">
              <Field
                label="Name Contains (case-insensitive)"
                value={override.nameContains || ''}
                onChange={(v) => updateOverride(idx, { nameContains: v || undefined })}
                placeholder="e.g. Senior"
              />
            </div>
            <ColorField
              label="Badge Background"
              value={override.badgeBg}
              onChange={(v) => updateOverride(idx, { badgeBg: v })}
            />
            <ColorField
              label="Badge Text Color"
              value={override.badgeColor}
              onChange={(v) => updateOverride(idx, { badgeColor: v })}
            />
          </div>
        </div>
      ))}
      <button
        onClick={addOverride}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        + Add Category Override
      </button>
    </div>
  );
}
