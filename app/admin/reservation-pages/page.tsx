'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink, Pencil, Trash2, Eye, EyeOff, Lock } from 'lucide-react';
import type { IReservationPageConfig } from '@/types/reservation-pages';
import { MIN_VIEWER_PASSWORD_LENGTH } from '@/lib/reservation-page-password';

export default function ReservationPagesAdminList() {
  const [configs, setConfigs] = useState<IReservationPageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    slug: '',
    organization_ids: '',
    page_title: '',
    page_subtitle: '',
    viewer_password: '',
    viewer_password_confirm: '',
  });

  useEffect(() => {
    void fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const res = await fetch('/api/admin/reservation-pages');
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (error) {
      console.error('Failed to fetch reservation page configs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newForm.viewer_password.trim()) {
      if (newForm.viewer_password !== newForm.viewer_password_confirm) {
        alert('Passwords do not match');
        return;
      }
      if (newForm.viewer_password.trim().length < MIN_VIEWER_PASSWORD_LENGTH) {
        alert(`Password must be at least ${MIN_VIEWER_PASSWORD_LENGTH} characters`);
        return;
      }
    }
    try {
      const body: Record<string, unknown> = {
        name: newForm.name,
        slug: newForm.slug,
        organization_ids: newForm.organization_ids,
        page_title: newForm.page_title.trim() || null,
        page_subtitle: newForm.page_subtitle.trim() || null,
      };
      if (newForm.viewer_password.trim()) {
        body.viewer_password_new = newForm.viewer_password.trim();
      }
      const res = await fetch('/api/admin/reservation-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewForm({
          name: '',
          slug: '',
          organization_ids: '',
          page_title: '',
          page_subtitle: '',
          viewer_password: '',
          viewer_password_confirm: '',
        });
        void fetchConfigs();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Create failed');
      }
    } catch (error) {
      console.error('Failed to create config:', error);
    }
  }

  async function handleToggle(slug: string, isActive: boolean) {
    await fetch(`/api/admin/reservation-pages/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    void fetchConfigs();
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete reservation page "${slug}"?`)) return;
    await fetch(`/api/admin/reservation-pages/${slug}`, { method: 'DELETE' });
    void fetchConfigs();
  }

  if (loading) {
    return (
      <div className="max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Reservation schedule pages</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="min-w-0 text-2xl font-bold text-gray-900">Reservation schedule pages</h1>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          New page
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-4 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Create reservation schedule page</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Page name" value={newForm.name} onChange={(v) => setNewForm({ ...newForm, name: v })} required />
            <Field label="Slug (URL)" value={newForm.slug} onChange={(v) => setNewForm({ ...newForm, slug: v })} required />
            <div className="col-span-2">
              <Field
                label="Organization IDs (comma-separated)"
                value={newForm.organization_ids}
                onChange={(v) => setNewForm({ ...newForm, organization_ids: v })}
                placeholder="417, 529"
                required
              />
            </div>
            <Field
              label="Page header title (optional)"
              value={newForm.page_title}
              onChange={(v) => setNewForm({ ...newForm, page_title: v })}
            />
            <Field
              label="Page subtitle (optional)"
              value={newForm.page_subtitle}
              onChange={(v) => setNewForm({ ...newForm, page_subtitle: v })}
            />
            <PasswordCreateField
              label={`Viewer password (optional, min ${MIN_VIEWER_PASSWORD_LENGTH} chars)`}
              value={newForm.viewer_password}
              onChange={(v) => setNewForm({ ...newForm, viewer_password: v })}
            />
            <PasswordCreateField
              label="Confirm viewer password"
              value={newForm.viewer_password_confirm}
              onChange={(v) => setNewForm({ ...newForm, viewer_password_confirm: v })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {configs.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <p className="mb-4 text-gray-500">No reservation pages yet.</p>
          <button type="button" onClick={() => setShowCreate(true)} className="font-medium text-blue-600 hover:underline">
            Create your first one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div key={config.id} className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-gray-900">{config.name}</h3>
                  {config.hasViewerPassword ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      <Lock size={12} aria-hidden />
                      Locked
                    </span>
                  ) : null}
                  {!config.is_active ? (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  /reservations/{config.slug} · Org IDs {config.organization_ids.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/reservations/${config.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-blue-600"
                  title="Open page"
                >
                  <ExternalLink size={16} />
                </a>
                <Link
                  href={`/admin/reservation-pages/${config.slug}`}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-blue-600"
                  title="Edit"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggle(config.slug, config.is_active)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-yellow-600"
                  title={config.is_active ? 'Deactivate' : 'Activate'}
                >
                  {config.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(config.slug)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-red-600"
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
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

function PasswordCreateField({
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
