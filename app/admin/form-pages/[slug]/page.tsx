'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, ExternalLink } from 'lucide-react';
import type { FormPageBranding, FormPageConfigAdmin, QuestionnaireListItem } from '@/types/form-pages';

export default function EditFormPagePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [config, setConfig] = useState<FormPageConfigAdmin | null>(null);
  const [staffPassword, setStaffPassword] = useState('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireListItem[]>([]);
  const [selectedQuestionnaireIds, setSelectedQuestionnaireIds] = useState<number[]>([]);
  const [allowAllQuestionnaires, setAllowAllQuestionnaires] = useState(false);
  const [questionnairesLoading, setQuestionnairesLoading] = useState(false);
  const [questionnairesError, setQuestionnairesError] = useState<string | null>(null);
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
        setSelectedQuestionnaireIds(c.allowed_questionnaire_ids ?? []);
        setAllowAllQuestionnaires(!c.allowed_questionnaire_ids || c.allowed_questionnaire_ids.length === 0);
        void loadQuestionnairesForOrg(c.organization_id);
      } catch {
        setError('Failed to load config');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  async function loadQuestionnairesForOrg(organizationId: number) {
    if (!Number.isFinite(organizationId)) {
      setQuestionnairesError('Enter an organization ID first.');
      return;
    }
    setQuestionnairesLoading(true);
    setQuestionnairesError(null);
    try {
      const res = await fetch(`/api/admin/form-pages/questionnaires?organizationId=${organizationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load forms');
      setQuestionnaires(data.questionnaires || []);
    } catch (e) {
      setQuestionnairesError(e instanceof Error ? e.message : 'Failed to load forms');
    } finally {
      setQuestionnairesLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const allowed = allowAllQuestionnaires
        ? null
        : [...new Set([...selectedQuestionnaireIds, config.default_questionnaire_id])]
            .filter((n) => Number.isFinite(n));

      const body: Record<string, unknown> = {
        name: config.name,
        slug: config.slug,
        is_active: config.is_active,
        organization_id: config.organization_id,
        default_questionnaire_id: config.default_questionnaire_id,
        allowed_questionnaire_ids: allowed,
        staff_lock_to_default_questionnaire: config.staff_lock_to_default_questionnaire,
        enable_staff_inquiry_workflow: config.enable_staff_inquiry_workflow,
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

  function toggleQuestionnaire(id: number) {
    setSelectedQuestionnaireIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
            <div className="col-span-2 rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Available forms</p>
                  <p className="text-xs text-gray-500">Choose which organization forms staff can view on this page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadQuestionnairesForOrg(config.organization_id)}
                  disabled={questionnairesLoading}
                  className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {questionnairesLoading ? 'Loading…' : 'Reload org forms'}
                </button>
              </div>
              {questionnairesError ? <p className="mt-2 text-xs text-red-600">{questionnairesError}</p> : null}
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowAllQuestionnaires}
                  onChange={(e) => setAllowAllQuestionnaires(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Allow all organization forms on this page
              </label>
              {questionnaires.length > 0 && !allowAllQuestionnaires ? (
                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                  {questionnaires.map((q) => (
                    <label key={q.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedQuestionnaireIds.includes(q.id)}
                          onChange={() => toggleQuestionnaire(q.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="truncate">{q.title || `Form ${q.id}`}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, default_questionnaire_id: q.id })}
                        className="shrink-0 text-xs text-blue-600 hover:underline"
                      >
                        Use as default
                      </button>
                    </label>
                  ))}
                </div>
              ) : null}
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
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!config.staff_lock_to_default_questionnaire}
                onChange={(e) =>
                  setConfig({ ...config, staff_lock_to_default_questionnaire: !e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Allow staff to switch between allowed forms
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.enable_staff_inquiry_workflow}
                onChange={(e) =>
                  setConfig({ ...config, enable_staff_inquiry_workflow: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Enable inquiry status workflow
            </label>
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
