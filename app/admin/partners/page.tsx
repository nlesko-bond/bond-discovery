'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Edit2, 
  Trash2,
  ChevronRight,
  RefreshCw,
  Users,
  FileText,
  Copy,
  Check
} from 'lucide-react';

interface PartnerGroup {
  id: string;
  name: string;
  slug: string;
  api_key?: string;
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    logo?: string;
    tagline?: string;
  };
  default_features: {
    showPricing: boolean;
    showAvailability: boolean;
    showMembershipBadges: boolean;
    showAgeGender: boolean;
    enableFilters: string[];
    defaultView: 'programs' | 'schedule';
    allowViewToggle: boolean;
  };
  is_active: boolean;
  pages?: { id: string; name: string; slug: string }[];
  created_at: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [newPartner, setNewPartner] = useState({
    name: '',
    slug: '',
    companyName: '',
    apiKey: '',
    primaryColor: '#1E2761',
    secondaryColor: '#6366F1',
    accentColor: '#8B5CF6',
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/partners');
      const data = await res.json();
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPartner = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPartner.name,
          slug: newPartner.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          api_key: newPartner.apiKey || null,
          branding: {
            companyName: newPartner.companyName || newPartner.name,
            primaryColor: newPartner.primaryColor,
            secondaryColor: newPartner.secondaryColor,
            accentColor: newPartner.accentColor,
          },
        }),
      });
      
      if (res.ok) {
        setShowNewForm(false);
        setNewPartner({
          name: '', slug: '', companyName: '', apiKey: '',
          primaryColor: '#1E2761', secondaryColor: '#6366F1', accentColor: '#8B5CF6'
        });
        fetchPartners();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create partner');
      }
    } catch (error) {
      console.error('Error creating partner:', error);
      alert('Failed to create partner');
    } finally {
      setCreating(false);
    }
  };

  const deletePartner = async (id: string, name: string) => {
    if (!confirm(`Delete partner "${name}" and all its pages?`)) return;
    
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPartners();
      } else {
        alert('Failed to delete partner');
      }
    } catch (error) {
      console.error('Error deleting partner:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Partner Groups</h1>
          <p className="text-gray-600 mt-1">
            Manage partner organizations with shared branding and API keys
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Partner
        </button>
      </div>

      {/* New Partner Form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Partner Group</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Partner Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Socceroof"
                value={newPartner.name}
                onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Slug *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., socceroof"
                value={newPartner.slug}
                onChange={(e) => setNewPartner({ 
                  ...newPartner, 
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') 
                })}
              />
              <p className="text-xs text-gray-500 mt-1">Used for grouping, not URLs</p>
            </div>
            <div>
              <label className="label">Display Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Socceroof NYC"
                value={newPartner.companyName}
                onChange={(e) => setNewPartner({ ...newPartner, companyName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">API Key</label>
              <input
                type="password"
                className="input font-mono"
                placeholder="Bond Sports API Key"
                value={newPartner.apiKey}
                onChange={(e) => setNewPartner({ ...newPartner, apiKey: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded cursor-pointer"
                  value={newPartner.primaryColor}
                  onChange={(e) => setNewPartner({ ...newPartner, primaryColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={newPartner.primaryColor}
                  onChange={(e) => setNewPartner({ ...newPartner, primaryColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Secondary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded cursor-pointer"
                  value={newPartner.secondaryColor}
                  onChange={(e) => setNewPartner({ ...newPartner, secondaryColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={newPartner.secondaryColor}
                  onChange={(e) => setNewPartner({ ...newPartner, secondaryColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded cursor-pointer"
                  value={newPartner.accentColor}
                  onChange={(e) => setNewPartner({ ...newPartner, accentColor: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={newPartner.accentColor}
                  onChange={(e) => setNewPartner({ ...newPartner, accentColor: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowNewForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={createPartner}
              disabled={creating || !newPartner.name || !newPartner.slug}
              className="btn-primary flex items-center gap-2"
            >
              {creating ? (
                <><RefreshCw size={16} className="animate-spin" /> Creating...</>
              ) : (
                <><Plus size={16} /> Create Partner</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Partners List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="mx-auto mb-4 text-gray-300" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No partners yet</h3>
          <p className="text-gray-500 mb-4">Create your first partner group to get started.</p>
          <button onClick={() => setShowNewForm(true)} className="btn-primary">
            Create First Partner
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {partners.map((partner) => (
            <div key={partner.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Partner Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: partner.branding.primaryColor }}
                    >
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                      <p className="text-sm text-gray-500">
                        {partner.branding.companyName} • {partner.pages?.length || 0} pages
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/partners/${partner.id}`}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Edit2 size={16} />
                      Edit
                    </Link>
                    <Link
                      href={`/admin/partners/${partner.id}/pages/new`}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add Page
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Partner Pages */}
              {partner.pages && partner.pages.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {partner.pages.map((page) => (
                    <div key={page.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3 pl-12">
                        <FileText size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-700">{page.name}</span>
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          /{page.slug}
                        </code>
                      </div>
                      <Link
                        href={`/admin/pages/${page.slug}`}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        Configure <ChevronRight size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Empty Pages State */}
              {(!partner.pages || partner.pages.length === 0) && (
                <div className="px-4 py-6 text-center text-gray-500">
                  <p className="text-sm">No pages yet.</p>
                  <Link
                    href={`/admin/partners/${partner.id}/pages/new`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Create first page →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How Partner Groups Work</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• <strong>Partner Group</strong> = Shared branding, API key, and default settings</li>
          <li>• <strong>Discovery Page</strong> = Specific orgs/facilities with a unique URL (e.g., /socceroof-nyc)</li>
          <li>• Pages inherit branding from their partner group but can have different org IDs</li>
          <li>• Example: Socceroof → /socceroof-nyc (3 orgs), /socceroof-canada (2 orgs)</li>
        </ul>
      </div>
    </div>
  );
}
