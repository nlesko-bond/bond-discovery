'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit2, 
  Copy, 
  Check,
  Globe,
  Eye,
  EyeOff,
  MoreVertical,
  RefreshCw
} from 'lucide-react';

interface PageConfig {
  id: string;
  name: string;
  slug: string;
  branding: {
    companyName: string;
    primaryColor: string;
  };
  organizationIds: string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PagesPage() {
  const [pages, setPages] = useState<PageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  
  // New page form state
  const [newPage, setNewPage] = useState({
    name: '',
    slug: '',
    companyName: '',
    organizationIds: '',
    primaryColor: '#1E2761',
    secondaryColor: '#6366F1',
    accentColor: '#8B5CF6',
    apiKey: '',
  });
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const res = await fetch('/api/pages');
      const data = await res.json();
      setPages(data.pages || []);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (slug: string) => {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const createPage = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPage.name,
          slug: newPage.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          branding: {
            companyName: newPage.companyName || newPage.name,
            primaryColor: newPage.primaryColor,
            secondaryColor: newPage.secondaryColor,
            accentColor: newPage.accentColor,
          },
          organizationIds: newPage.organizationIds.split(',').map(s => s.trim()).filter(Boolean),
          apiKey: newPage.apiKey || undefined,
        }),
      });
      
      if (res.ok) {
        setShowNewForm(false);
        setNewPage({ name: '', slug: '', companyName: '', organizationIds: '', primaryColor: '#1E2761', secondaryColor: '#6366F1', accentColor: '#8B5CF6', apiKey: '' });
        fetchPages();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create page');
      }
    } catch (error) {
      console.error('Error creating page:', error);
      alert('Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  const deletePage = async (slug: string) => {
    if (!confirm(`Are you sure you want to delete the page "/${slug}"?`)) return;
    
    try {
      const res = await fetch(`/api/pages/${slug}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPages();
      } else {
        alert('Failed to delete page');
      }
    } catch (error) {
      console.error('Error deleting page:', error);
    }
  };

  const togglePageStatus = async (slug: string, isActive: boolean) => {
    try {
      await fetch(`/api/pages/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchPages();
    } catch (error) {
      console.error('Error updating page:', error);
    }
  };

  const duplicatePage = async (slug: string) => {
    setDuplicating(slug);
    try {
      // Fetch the full page config
      const res = await fetch(`/api/pages/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch page');
      const { page } = await res.json();
      
      // Generate a unique slug
      let newSlug = `${slug}-copy`;
      let counter = 1;
      // Check if slug already exists
      while (pages.some(p => p.slug === newSlug)) {
        newSlug = `${slug}-copy-${counter}`;
        counter++;
      }
      
      // Create duplicate page with all settings
      const createRes = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${page.name} (Copy)`,
          slug: newSlug,
          organizationIds: page.organizationIds,
          facilityIds: page.facilityIds || [],
          apiKey: page.apiKey,
          partner_group_id: page.partnerGroupId,
          branding: page.branding,
          features: page.features,
          defaultParams: page.defaultParams,
          cacheTtl: page.cacheTtl,
          isActive: false, // Start as draft
        }),
      });
      
      if (createRes.ok) {
        fetchPages();
      } else {
        const error = await createRes.json();
        alert(error.error || 'Failed to duplicate page');
      }
    } catch (error) {
      console.error('Error duplicating page:', error);
      alert('Failed to duplicate page');
    } finally {
      setDuplicating(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Discovery Pages</h1>
          <p className="text-gray-600 mt-1">
            Create and manage discovery pages for different organizations
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Page
        </button>
      </div>

      {/* New Page Form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Page</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Page Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., TOCA Evanston"
                value={newPage.name}
                onChange={(e) => setNewPage({ ...newPage, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">URL Slug *</label>
              <div className="flex items-center">
                <span className="text-gray-500 text-sm mr-1">/</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., toca-evanston"
                  value={newPage.slug}
                  onChange={(e) => setNewPage({ 
                    ...newPage, 
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') 
                  })}
                />
              </div>
            </div>
            <div>
              <label className="label">Company/Brand Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., TOCA Soccer"
                value={newPage.companyName}
                onChange={(e) => setNewPage({ ...newPage, companyName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded cursor-pointer"
                  value={newPage.primaryColor}
                  onChange={(e) => setNewPage({ ...newPage, primaryColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={newPage.primaryColor}
                  onChange={(e) => setNewPage({ ...newPage, primaryColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Secondary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded cursor-pointer"
                  value={newPage.secondaryColor}
                  onChange={(e) => setNewPage({ ...newPage, secondaryColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={newPage.secondaryColor}
                  onChange={(e) => setNewPage({ ...newPage, secondaryColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded cursor-pointer"
                  value={newPage.accentColor}
                  onChange={(e) => setNewPage({ ...newPage, accentColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={newPage.accentColor}
                  onChange={(e) => setNewPage({ ...newPage, accentColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Organization IDs *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., 516, 512, 513"
                value={newPage.organizationIds}
                onChange={(e) => setNewPage({ ...newPage, organizationIds: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
            </div>
            <div>
              <label className="label">API Key (Optional)</label>
              <input
                type="password"
                className="input font-mono"
                placeholder="Leave empty for default"
                value={newPage.apiKey}
                onChange={(e) => setNewPage({ ...newPage, apiKey: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Partner-specific API key</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowNewForm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={createPage}
              disabled={creating || !newPage.name || !newPage.slug || !newPage.organizationIds}
              className="btn-primary flex items-center gap-2"
            >
              {creating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Page
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Pages List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Globe className="mx-auto mb-4 text-gray-300" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pages yet</h3>
          <p className="text-gray-500 mb-4">Create your first discovery page to get started.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="btn-primary"
          >
            Create First Page
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Page</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">URL</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Organizations</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: page.branding.primaryColor }}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{page.name}</p>
                        <p className="text-sm text-gray-500">{page.branding.companyName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        /{page.slug}
                      </code>
                      <button
                        onClick={() => copyToClipboard(page.slug)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy URL"
                      >
                        {copiedSlug === page.slug ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {page.organizationIds?.length || 0} orgs
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => togglePageStatus(page.slug, page.isActive !== false)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        page.isActive !== false
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {page.isActive !== false ? (
                        <>
                          <Eye size={12} />
                          Active
                        </>
                      ) : (
                        <>
                          <EyeOff size={12} />
                          Draft
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`${process.env.NEXT_PUBLIC_DISCOVERY_DOMAIN || ''}/${page.slug}`}
                        target="_blank"
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="View page"
                      >
                        <ExternalLink size={16} />
                      </Link>
                      <Link
                        href={`/admin/pages/${page.slug}`}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit page"
                      >
                        <Edit2 size={16} />
                      </Link>
                      <button
                        onClick={() => duplicatePage(page.slug)}
                        disabled={duplicating === page.slug}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                        title="Duplicate page"
                      >
                        {duplicating === page.slug ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                      {page.slug !== 'toca' && (
                        <button
                          onClick={() => deletePage(page.slug)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete page"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Help Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Deep Linking</h3>
        <p className="text-sm text-blue-800 mb-3">
          Each page supports URL parameters for filtering:
        </p>
        <div className="space-y-2 text-sm font-mono text-blue-700">
          <p><span className="text-blue-500">/toca</span>?facilityIds=123 — Filter by facility</p>
          <p><span className="text-blue-500">/toca</span>?programIds=456 — Filter by program</p>
          <p><span className="text-blue-500">/toca</span>?viewMode=schedule — Open schedule view</p>
        </div>
      </div>
    </div>
  );
}
