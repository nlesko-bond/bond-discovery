'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { MembershipPageConfig } from '@/types/membership';

export default function MembershipsAdminPage() {
  const [configs, setConfigs] = useState<MembershipPageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    slug: '',
    organization_id: '',
    organization_name: '',
    organization_slug: '',
    facility_id: '',
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const res = await fetch('/api/admin/memberships');
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (error) {
      console.error('Failed to fetch membership configs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newForm,
          organization_id: parseInt(newForm.organization_id),
          facility_id: newForm.facility_id ? parseInt(newForm.facility_id) : null,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewForm({ name: '', slug: '', organization_id: '', organization_name: '', organization_slug: '', facility_id: '' });
        fetchConfigs();
      }
    } catch (error) {
      console.error('Failed to create config:', error);
    }
  }

  async function handleToggle(slug: string, isActive: boolean) {
    try {
      await fetch(`/api/admin/memberships/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      fetchConfigs();
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete membership page "${slug}"?`)) return;
    try {
      await fetch(`/api/admin/memberships/${slug}`, { method: 'DELETE' });
      fetchConfigs();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Membership Pages</h1>
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
        <h1 className="text-2xl font-bold text-gray-900">Membership Pages</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Page
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-sm border mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Create Membership Page</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Page Name</label>
              <input
                required
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="White Marsh Swim Club Memberships"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                required
                value={newForm.slug}
                onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="coppermine-whitemarsh"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
              <input
                required
                type="number"
                value={newForm.organization_id}
                onChange={(e) => setNewForm({ ...newForm, organization_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="529"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                value={newForm.organization_name}
                onChange={(e) => setNewForm({ ...newForm, organization_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Coppermine"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Slug (for Bond URLs)</label>
              <input
                value={newForm.organization_slug}
                onChange={(e) => setNewForm({ ...newForm, organization_slug: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Coppermine"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility ID (optional)</label>
              <input
                type="number"
                value={newForm.facility_id}
                onChange={(e) => setNewForm({ ...newForm, facility_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="665"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {configs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <p className="text-gray-500 mb-4">No membership pages yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-blue-600 font-medium hover:underline"
          >
            Create your first one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="bg-white rounded-lg shadow-sm border p-5 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{config.name}</h3>
                  {!config.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  /{config.slug} · Org {config.organization_id}
                  {config.organization_name && ` (${config.organization_name})`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/memberships/${config.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50"
                  title="Preview"
                >
                  <ExternalLink size={16} />
                </a>
                <Link
                  href={`/admin/memberships/${config.slug}`}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50"
                  title="Edit"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  onClick={() => handleToggle(config.slug, config.is_active)}
                  className="p-2 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-gray-50"
                  title={config.is_active ? 'Deactivate' : 'Activate'}
                >
                  {config.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => handleDelete(config.slug)}
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
