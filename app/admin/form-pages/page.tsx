'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import type { FormPageConfigAdmin, QuestionnaireListItem } from '@/types/form-pages';

export default function FormPagesAdminList() {
  const [configs, setConfigs] = useState<FormPageConfigAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    slug: '',
    organization_id: '',
    default_questionnaire_id: '',
    staff_password: '',
    staff_can_switch_forms: true,
    allow_all_questionnaires: false,
    enable_staff_inquiry_workflow: true,
  });
  const [createQuestionnaires, setCreateQuestionnaires] = useState<QuestionnaireListItem[]>([]);
  const [createSelectedQuestionnaireIds, setCreateSelectedQuestionnaireIds] = useState<number[]>([]);
  const [questionnairesLoading, setQuestionnairesLoading] = useState(false);
  const [questionnairesError, setQuestionnairesError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const res = await fetch('/api/admin/form-pages');
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const defaultQuestionnaireId = parseInt(newForm.default_questionnaire_id, 10);
      const allowedQuestionnaireIds = newForm.allow_all_questionnaires
        ? null
        : [...new Set([...createSelectedQuestionnaireIds, defaultQuestionnaireId])]
            .filter((n) => Number.isFinite(n));
      const res = await fetch('/api/admin/form-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newForm.name,
          slug: newForm.slug,
          organization_id: parseInt(newForm.organization_id, 10),
          default_questionnaire_id: defaultQuestionnaireId,
          allowed_questionnaire_ids: allowedQuestionnaireIds,
          staff_password: newForm.staff_password,
          staff_lock_to_default_questionnaire: !newForm.staff_can_switch_forms,
          enable_staff_inquiry_workflow: newForm.enable_staff_inquiry_workflow,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewForm({
          name: '',
          slug: '',
          organization_id: '',
          default_questionnaire_id: '',
          staff_password: '',
          staff_can_switch_forms: true,
          allow_all_questionnaires: false,
          enable_staff_inquiry_workflow: true,
        });
        setCreateQuestionnaires([]);
        setCreateSelectedQuestionnaireIds([]);
        fetchConfigs();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Create failed');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCreateQuestionnaires() {
    const organizationId = parseInt(newForm.organization_id, 10);
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
      setCreateQuestionnaires(data.questionnaires || []);
    } catch (e) {
      setQuestionnairesError(e instanceof Error ? e.message : 'Failed to load forms');
    } finally {
      setQuestionnairesLoading(false);
    }
  }

  function toggleCreateQuestionnaire(id: number) {
    setCreateSelectedQuestionnaireIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleToggle(slug: string, isActive: boolean) {
    await fetch(`/api/admin/form-pages/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    fetchConfigs();
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete form responses page "${slug}"?`)) return;
    await fetch(`/api/admin/form-pages/${slug}`, { method: 'DELETE' });
    fetchConfigs();
  }

  if (loading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Form responses pages</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Form responses pages</h1>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />
          New page
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-sm border mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Create form responses page</h3>
          <p className="text-sm text-gray-500">
            Staff open <code className="text-xs bg-gray-100 px-1 rounded">/form-responses/your-slug</code> with the
            password you set. Run Supabase migration <code className="text-xs">006_add_form_pages.sql</code> first.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Page name"
              value={newForm.name}
              onChange={(v) => setNewForm({ ...newForm, name: v })}
              required
            />
            <Field
              label="Slug (URL)"
              value={newForm.slug}
              onChange={(v) => setNewForm({ ...newForm, slug: v })}
              required
            />
            <Field
              label="Organization ID"
              type="number"
              value={newForm.organization_id}
              onChange={(v) => setNewForm({ ...newForm, organization_id: v })}
              required
            />
            <Field
              label="Default questionnaire (form) ID"
              type="number"
              value={newForm.default_questionnaire_id}
              onChange={(v) => setNewForm({ ...newForm, default_questionnaire_id: v })}
              required
            />
            <div className="col-span-2 rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Available forms</p>
                  <p className="text-xs text-gray-500">Load forms from the org, then choose which staff can use.</p>
                </div>
                <button
                  type="button"
                  onClick={loadCreateQuestionnaires}
                  disabled={questionnairesLoading}
                  className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {questionnairesLoading ? 'Loading…' : 'Load org forms'}
                </button>
              </div>
              {questionnairesError ? <p className="mt-2 text-xs text-red-600">{questionnairesError}</p> : null}
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newForm.allow_all_questionnaires}
                  onChange={(e) => setNewForm({ ...newForm, allow_all_questionnaires: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Allow all organization forms on this page
              </label>
              {createQuestionnaires.length > 0 && !newForm.allow_all_questionnaires ? (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                  {createQuestionnaires.map((q) => (
                    <label key={q.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={createSelectedQuestionnaireIds.includes(q.id)}
                          onChange={() => toggleCreateQuestionnaire(q.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="truncate">{q.title || `Form ${q.id}`}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewForm({ ...newForm, default_questionnaire_id: String(q.id) })}
                        className="shrink-0 text-xs text-blue-600 hover:underline"
                      >
                        Use as default
                      </button>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="col-span-2">
              <Field
                label="Staff password (required)"
                type="password"
                value={newForm.staff_password}
                onChange={(v) => setNewForm({ ...newForm, staff_password: v })}
                required
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newForm.staff_can_switch_forms}
                onChange={(e) => setNewForm({ ...newForm, staff_can_switch_forms: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Allow staff to switch between allowed forms
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newForm.enable_staff_inquiry_workflow}
                onChange={(e) => setNewForm({ ...newForm, enable_staff_inquiry_workflow: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Enable inquiry status workflow
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {configs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <p className="text-gray-500 mb-4">No form response pages yet.</p>
          <button type="button" onClick={() => setShowCreate(true)} className="text-blue-600 font-medium hover:underline">
            Create your first one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((c) => (
            <div key={c.id} className="bg-white rounded-lg shadow-sm border p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                  {!c.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactive</span>
                  )}
                  {!c.has_staff_password && (
                    <span className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded">No password</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  /form-responses/{c.slug} · Org {c.organization_id} · default form {c.default_questionnaire_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/form-responses/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50"
                  title="Open staff page"
                >
                  <ExternalLink size={16} />
                </a>
                <Link
                  href={`/admin/form-pages/${c.slug}`}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50"
                  title="Edit"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggle(c.slug, c.is_active)}
                  className="p-2 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-gray-50"
                  title={c.is_active ? 'Deactivate' : 'Activate'}
                >
                  {c.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.slug)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        required={required}
      />
    </div>
  );
}
