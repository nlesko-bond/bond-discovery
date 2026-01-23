'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink
} from 'lucide-react';

interface PartnerGroup {
  id: string;
  name: string;
  slug: string;
  api_key?: string;
  gtm_id?: string;
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    logo?: string;
    tagline?: string;
    fontFamily?: string;
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
  pages?: { id: string; name: string; slug: string; organization_ids: number[]; is_active: boolean }[];
}

export default function EditPartnerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partner, setPartner] = useState<PartnerGroup | null>(null);

  useEffect(() => {
    fetchPartner();
  }, [params.id]);

  const fetchPartner = async () => {
    try {
      const res = await fetch(`/api/partners/${params.id}`);
      if (!res.ok) throw new Error('Partner not found');
      const data = await res.json();
      setPartner(data.partner);
    } catch (error) {
      console.error('Error fetching partner:', error);
      alert('Partner not found');
      router.push('/admin/partners');
    } finally {
      setLoading(false);
    }
  };

  const savePartner = async () => {
    if (!partner) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/partners/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partner.name,
          api_key: partner.api_key,
          gtm_id: partner.gtm_id,
          branding: partner.branding,
          default_features: partner.default_features,
        }),
      });
      
      if (res.ok) {
        alert('Partner saved successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save partner');
      }
    } catch (error) {
      console.error('Error saving partner:', error);
      alert('Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/admin/partners"
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
            <p className="text-gray-500 text-sm">Partner Group</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/partners/${params.id}/pages/new`}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Page
          </Link>
          <button
            onClick={savePartner}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <><RefreshCw size={16} className="animate-spin" /> Saving...</>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </div>
      </div>

      {/* Branding Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding & API</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Partner Name</label>
            <input
              type="text"
              className="input"
              value={partner.name}
              onChange={(e) => setPartner({ ...partner, name: e.target.value })}
            />
          </div>
          
          <div>
            <label className="label">Display Name</label>
            <input
              type="text"
              className="input"
              value={partner.branding.companyName}
              onChange={(e) => setPartner({
                ...partner,
                branding: { ...partner.branding, companyName: e.target.value }
              })}
            />
          </div>
          
          <div>
            <label className="label">Logo URL</label>
            <input
              type="text"
              className="input"
              placeholder="https://..."
              value={partner.branding.logo || ''}
              onChange={(e) => setPartner({
                ...partner,
                branding: { ...partner.branding, logo: e.target.value || undefined }
              })}
            />
          </div>
          
          <div>
            <label className="label">Tagline</label>
            <input
              type="text"
              className="input"
              placeholder="Find your perfect program"
              value={partner.branding.tagline || ''}
              onChange={(e) => setPartner({
                ...partner,
                branding: { ...partner.branding, tagline: e.target.value || undefined }
              })}
            />
          </div>
          
          <div>
            <label className="label">Font Family</label>
            <select
              className="input"
              value={partner.branding.fontFamily || ''}
              onChange={(e) => setPartner({
                ...partner,
                branding: { ...partner.branding, fontFamily: e.target.value || undefined }
              })}
            >
              <option value="">System Default</option>
              <option value="'Inter', sans-serif">Inter</option>
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Open Sans', sans-serif">Open Sans</option>
              <option value="'Lato', sans-serif">Lato</option>
              <option value="'Montserrat', sans-serif">Montserrat</option>
              <option value="'Poppins', sans-serif">Poppins</option>
              <option value="'Nunito', sans-serif">Nunito</option>
              <option value="'Raleway', sans-serif">Raleway</option>
              <option value="'Oswald', sans-serif">Oswald</option>
              <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Font will be loaded from Google Fonts
            </p>
          </div>
          
          <div className="md:col-span-2">
            <label className="label">Bond Sports API Key</label>
            <input
              type="password"
              className="input font-mono"
              placeholder="Enter API key for this partner"
              value={partner.api_key || ''}
              onChange={(e) => setPartner({ ...partner, api_key: e.target.value || undefined })}
            />
            <p className="text-xs text-gray-500 mt-1">
              All pages under this partner will use this API key
            </p>
          </div>
        </div>
        
        <hr className="my-6" />
        
        <h3 className="font-semibold text-gray-900 mb-4">Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="label">Google Tag Manager ID</label>
            <input
              type="text"
              className="input font-mono"
              placeholder="GTM-XXXXXX"
              value={partner.gtm_id || ''}
              onChange={(e) => setPartner({ ...partner, gtm_id: e.target.value || undefined })}
            />
            <p className="text-xs text-gray-500 mt-1">
              GTM container ID for tracking. All pages under this partner will use this GTM ID unless overridden at page level.
            </p>
          </div>
        </div>
        
        <hr className="my-6" />
        
        <h3 className="font-semibold text-gray-900 mb-4">Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="label">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-12 h-12 rounded cursor-pointer border"
                value={partner.branding.primaryColor}
                onChange={(e) => setPartner({
                  ...partner,
                  branding: { ...partner.branding, primaryColor: e.target.value }
                })}
              />
              <input
                type="text"
                className="input flex-1"
                value={partner.branding.primaryColor}
                onChange={(e) => setPartner({
                  ...partner,
                  branding: { ...partner.branding, primaryColor: e.target.value }
                })}
              />
            </div>
          </div>
          
          <div>
            <label className="label">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-12 h-12 rounded cursor-pointer border"
                value={partner.branding.secondaryColor}
                onChange={(e) => setPartner({
                  ...partner,
                  branding: { ...partner.branding, secondaryColor: e.target.value }
                })}
              />
              <input
                type="text"
                className="input flex-1"
                value={partner.branding.secondaryColor}
                onChange={(e) => setPartner({
                  ...partner,
                  branding: { ...partner.branding, secondaryColor: e.target.value }
                })}
              />
            </div>
          </div>
          
          <div>
            <label className="label">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-12 h-12 rounded cursor-pointer border"
                value={partner.branding.accentColor || '#8B5CF6'}
                onChange={(e) => setPartner({
                  ...partner,
                  branding: { ...partner.branding, accentColor: e.target.value }
                })}
              />
              <input
                type="text"
                className="input flex-1"
                value={partner.branding.accentColor || '#8B5CF6'}
                onChange={(e) => setPartner({
                  ...partner,
                  branding: { ...partner.branding, accentColor: e.target.value }
                })}
              />
            </div>
          </div>
        </div>
        
        {/* Color Preview */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
          <div className="flex gap-3">
            <div 
              className="w-20 h-12 rounded shadow-sm flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: partner.branding.primaryColor }}
            >
              Primary
            </div>
            <div 
              className="w-20 h-12 rounded shadow-sm flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: partner.branding.secondaryColor }}
            >
              Secondary
            </div>
            <div 
              className="w-20 h-12 rounded shadow-sm flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: partner.branding.accentColor || '#8B5CF6' }}
            >
              Accent
            </div>
          </div>
        </div>
      </div>

      {/* Pages Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Discovery Pages</h2>
          <Link
            href={`/admin/partners/${params.id}/pages/new`}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus size={14} /> Add Page
          </Link>
        </div>
        
        {partner.pages && partner.pages.length > 0 ? (
          <div className="space-y-2">
            {partner.pages.map((page) => (
              <div 
                key={page.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{page.name}</p>
                  <p className="text-sm text-gray-500">
                    /{page.slug} • {page.organization_ids?.length || 0} orgs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${page.slug}`}
                    target="_blank"
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink size={16} />
                  </Link>
                  <Link
                    href={`/admin/pages/${page.slug}`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Configure →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No pages yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
