'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import type { FormPageConfigAdmin } from '@/types/form-pages';

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
  });

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
      const res = await fetch('/api/admin/form-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newForm.name,
          slug: newForm.slug,
          organization_id: parseInt(newForm.organization_id, 10),
          default_questionnaire_id: parseInt(newForm.default_questionnaire_id, 10),
          staff_password: newForm.staff_password,
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
        });
        fetchConfigs();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Create failed');
      }
    } catch (e) {
      console.error(e);
    }
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
            <div className="col-span-2">
              <Field
                label="Staff password (required)"
                type="password"
                value={newForm.staff_password}
                onChange={(v) => setNewForm({ ...newForm, staff_password: v })}
                required
              />
            </div>
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
