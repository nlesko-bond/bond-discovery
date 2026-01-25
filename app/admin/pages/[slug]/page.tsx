'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  ExternalLink,
  RefreshCw,
  Palette,
  Building2,
  SlidersHorizontal,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

interface PageConfig {
  id: string;
  name: string;
  slug: string;
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    logo?: string;
    tagline?: string;
    showTaglineOnMobile?: boolean;
  };
  organizationIds: string[];
  facilityIds?: string[];
  excludedProgramIds?: string[]; // Programs to exclude from this page
  apiKey?: string; // Per-page API key
  gtmId?: string; // Page-level GTM ID (overrides partner group)
  features: {
    showPricing: boolean;
    showAvailability: boolean;
    showMembershipBadges: boolean;
    showAgeGender: boolean;
    enableFilters: string[];
    defaultView: 'programs' | 'schedule';
    defaultScheduleView?: 'list' | 'table' | 'day' | 'week' | 'month'; // Default view for schedule tab (desktop)
    mobileDefaultScheduleView?: 'list' | 'table' | 'day' | 'week' | 'month'; // Default view for mobile
    allowViewToggle: boolean;
    showTableView?: boolean; // Show table view option on desktop
    // Embed options
    headerDisplay?: 'full' | 'minimal' | 'hidden';
    disableStickyHeader?: boolean;
  };
  defaultParams?: Record<string, string>;
  cacheTtl?: number;
  isActive?: boolean;
}

const ALL_FILTERS = [
  { id: 'facility', name: 'Facility', description: 'Filter by location/facility' },
  { id: 'programType', name: 'Program Type', description: 'Filter by camp, clinic, class, etc.' },
  { id: 'sport', name: 'Sport', description: 'Filter by sport type' },
  { id: 'age', name: 'Age Range', description: 'Filter by age restrictions' },
  { id: 'gender', name: 'Gender', description: 'Filter by gender restrictions' },
  { id: 'dateRange', name: 'Date Range', description: 'Filter by date' },
  { id: 'program', name: 'Program', description: 'Filter by specific program' },
  { id: 'availability', name: 'Availability', description: 'Filter by spots available' },
  { id: 'price', name: 'Price', description: 'Filter by price range' },
];

export default function EditPagePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PageConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'branding' | 'filters' | 'settings'>('branding');

  useEffect(() => {
    fetchPage();
  }, [params.slug]);

  const fetchPage = async () => {
    try {
      const res = await fetch(`/api/pages/${params.slug}`);
      if (!res.ok) throw new Error('Page not found');
      const data = await res.json();
      setConfig(data.page);
    } catch (error) {
      console.error('Error fetching page:', error);
      alert('Page not found');
      router.push('/admin/pages');
    } finally {
      setLoading(false);
    }
  };

  const savePage = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${params.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (res.ok) {
        alert('Page saved successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save page');
      }
    } catch (error) {
      console.error('Error saving page:', error);
      alert('Failed to save page');
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

  if (!config) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/admin/pages"
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
            <p className="text-gray-500 text-sm">/{config.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`${process.env.NEXT_PUBLIC_DISCOVERY_DOMAIN || ''}/${config.slug}`}
            target="_blank"
            className="btn-secondary flex items-center gap-2"
          >
            <ExternalLink size={16} />
            Preview
          </Link>
          <button
            onClick={savePage}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'branding' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Palette size={16} />
          Branding
        </button>
        <button
          onClick={() => setActiveTab('filters')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'filters' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'settings' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding & Appearance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Company/Brand Name</label>
                <input
                  type="text"
                  className="input"
                  value={config.branding.companyName}
                  onChange={(e) => setConfig({
                    ...config,
                    branding: { ...config.branding, companyName: e.target.value }
                  })}
                />
              </div>
              
              <div>
                <label className="label">Tagline</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Optional tagline"
                  value={config.branding.tagline || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    branding: { ...config.branding, tagline: e.target.value }
                  })}
                />
                {config.branding.tagline && (
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={config.branding.showTaglineOnMobile || false}
                      onChange={(e) => setConfig({
                        ...config,
                        branding: { ...config.branding, showTaglineOnMobile: e.target.checked }
                      })}
                    />
                    Show tagline on mobile
                  </label>
                )}
              </div>
              
              <div>
                <label className="label">Logo URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://example.com/logo.png"
                  value={config.branding.logo || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    branding: { ...config.branding, logo: e.target.value }
                  })}
                />
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
                    className="w-12 h-12 rounded cursor-pointer border border-gray-200"
                    value={config.branding.primaryColor}
                    onChange={(e) => setConfig({
                      ...config,
                      branding: { ...config.branding, primaryColor: e.target.value }
                    })}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    value={config.branding.primaryColor}
                    onChange={(e) => setConfig({
                      ...config,
                      branding: { ...config.branding, primaryColor: e.target.value }
                    })}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Main brand color (header, buttons)</p>
              </div>
              
              <div>
                <label className="label">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-12 h-12 rounded cursor-pointer border border-gray-200"
                    value={config.branding.secondaryColor}
                    onChange={(e) => setConfig({
                      ...config,
                      branding: { ...config.branding, secondaryColor: e.target.value }
                    })}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    value={config.branding.secondaryColor}
                    onChange={(e) => setConfig({
                      ...config,
                      branding: { ...config.branding, secondaryColor: e.target.value }
                    })}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Secondary highlights</p>
              </div>
              
              <div>
                <label className="label">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-12 h-12 rounded cursor-pointer border border-gray-200"
                    value={config.branding.accentColor || '#8B5CF6'}
                    onChange={(e) => setConfig({
                      ...config,
                      branding: { ...config.branding, accentColor: e.target.value }
                    })}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    value={config.branding.accentColor || '#8B5CF6'}
                    onChange={(e) => setConfig({
                      ...config,
                      branding: { ...config.branding, accentColor: e.target.value }
                    })}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Accents and hover states</p>
              </div>
            </div>
            
            {/* Color Preview */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Color Preview</p>
              <div className="flex gap-4">
                <div 
                  className="w-24 h-16 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: config.branding.primaryColor }}
                >
                  Primary
                </div>
                <div 
                  className="w-24 h-16 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: config.branding.secondaryColor }}
                >
                  Secondary
                </div>
                <div 
                  className="w-24 h-16 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: config.branding.accentColor || '#8B5CF6' }}
                >
                  Accent
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Configuration</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select which filters are available on this discovery page.
            </p>
            
            <div className="space-y-3">
              {ALL_FILTERS.map((filter) => (
                <label 
                  key={filter.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-gray-300"
                    checked={config.features.enableFilters.includes(filter.id)}
                    onChange={(e) => {
                      const newFilters = e.target.checked
                        ? [...config.features.enableFilters, filter.id]
                        : config.features.enableFilters.filter(f => f !== filter.id);
                      setConfig({
                        ...config,
                        features: { ...config.features, enableFilters: newFilters }
                      });
                    }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{filter.name}</p>
                    <p className="text-sm text-gray-500">{filter.description}</p>
                  </div>
                </label>
              ))}
            </div>
            
            <hr className="my-6" />
            
            <h3 className="font-semibold text-gray-900 mb-4">Display Options</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.showPricing}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, showPricing: e.target.checked }
                  })}
                />
                <span>Show pricing information</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.showAvailability}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, showAvailability: e.target.checked }
                  })}
                />
                <span>Show availability/spots remaining</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.showMembershipBadges}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, showMembershipBadges: e.target.checked }
                  })}
                />
                <span>Show membership badges</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.showAgeGender}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, showAgeGender: e.target.checked }
                  })}
                />
                <span>Show age and gender restrictions</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.allowViewToggle}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, allowViewToggle: e.target.checked }
                  })}
                />
                <span>Allow switching between Programs and Schedule view</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.showTableView || false}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, showTableView: e.target.checked }
                  })}
                />
                <span>Show Table view option on desktop (great for high-volume events)</span>
              </label>
            </div>
            
            <hr className="my-6" />
            
            <h3 className="font-semibold text-gray-900 mb-4">Embed Options</h3>
            <p className="text-sm text-gray-500 mb-4">
              Configure these settings when embedding the discovery page on another website.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Header Display</label>
                <select
                  className="input"
                  value={config.features.headerDisplay || 'full'}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, headerDisplay: e.target.value as 'full' | 'minimal' | 'hidden' }
                  })}
                >
                  <option value="full">Full - Logo, tagline, tabs, share button (sticky)</option>
                  <option value="minimal">Minimal - Tabs and share button only (not sticky)</option>
                  <option value="hidden">Hidden - No header (tabs move to filter bar)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Use "Minimal" or "Hidden" when embedding on a site that already has its own header/branding.
                </p>
              </div>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={config.features.disableStickyHeader || false}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, disableStickyHeader: e.target.checked }
                  })}
                />
                <div>
                  <span>Disable sticky main header</span>
                  <p className="text-xs text-gray-500">Calendar navigation headers will still stick for better UX</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Page Name</label>
                <input
                  type="text"
                  className="input"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="label">Default View</label>
                <select
                  className="input"
                  value={config.features.defaultView}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, defaultView: e.target.value as 'programs' | 'schedule' }
                  })}
                >
                  <option value="programs">Programs</option>
                  <option value="schedule">Schedule</option>
                </select>
              </div>
              
              <div>
                <label className="label">Default Schedule View (Desktop)</label>
                <select
                  className="input"
                  value={config.features.defaultScheduleView || 'list'}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, defaultScheduleView: e.target.value as 'list' | 'table' | 'day' | 'week' | 'month' }
                  })}
                >
                  <option value="list">List</option>
                  <option value="table">Table</option>
                  <option value="day">Day</option>
                  <option value="week">Week Grid</option>
                  <option value="month">Month</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Default view on desktop devices</p>
              </div>
              
              <div>
                <label className="label">Default Schedule View (Mobile)</label>
                <select
                  className="input"
                  value={config.features.mobileDefaultScheduleView || 'list'}
                  onChange={(e) => setConfig({
                    ...config,
                    features: { ...config.features, mobileDefaultScheduleView: e.target.value as 'list' | 'table' | 'day' | 'week' | 'month' }
                  })}
                >
                  <option value="list">List</option>
                  <option value="day">Day</option>
                  <option value="week">Week Grid</option>
                  <option value="month">Month</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Default view on mobile devices (Table not recommended for mobile)</p>
              </div>
              
              <div>
                <label className="label">Organization IDs</label>
                <input
                  type="text"
                  className="input"
                  value={config.organizationIds.join(', ')}
                  onChange={(e) => setConfig({
                    ...config,
                    organizationIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
              </div>
              
              <div>
                <label className="label">Facility IDs (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Leave empty for all facilities"
                  value={config.facilityIds?.join(', ') || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    facilityIds: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : []
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">Restrict to specific facilities</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="label">Excluded Program IDs (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., 12345, 67890"
                  value={config.excludedProgramIds?.join(', ') || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    excludedProgramIds: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list of program IDs to hide from this discovery page. 
                  Find program IDs in Bond Sports admin or from URLs.
                </p>
              </div>
            </div>
            
            <hr className="my-6" />
            
            <h3 className="font-semibold text-gray-900 mb-4">API Configuration</h3>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="label">Bond Sports API Key</label>
                <input
                  type="password"
                  className="input font-mono"
                  placeholder="Enter API key for this organization"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value || undefined })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Each partner can have their own API key. Leave empty to use the global default.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Cache TTL (seconds)</label>
                  <input
                    type="number"
                    className="input"
                    value={config.cacheTtl || 300}
                    onChange={(e) => setConfig({ ...config, cacheTtl: parseInt(e.target.value) || 300 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">How long to cache API data</p>
                </div>
                
                <div>
                  <label className="label">Page Status</label>
                  <button
                    onClick={() => setConfig({ ...config, isActive: !config.isActive })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                      config.isActive !== false
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {config.isActive !== false ? (
                      <>
                        <Eye size={16} />
                        Active (Public)
                      </>
                    ) : (
                      <>
                        <EyeOff size={16} />
                        Draft (Hidden)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <hr className="my-6" />
            
            <h3 className="font-semibold text-gray-900 mb-4">Analytics</h3>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="label">Google Tag Manager ID (Optional)</label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="GTM-XXXXXX"
                  value={config.gtmId || ''}
                  onChange={(e) => setConfig({ ...config, gtmId: e.target.value || undefined })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Page-specific GTM container ID. Leave empty to inherit from partner group.
                </p>
              </div>
            </div>
            
            <hr className="my-6" />
            
            <h3 className="font-semibold text-gray-900 mb-4">Default URL Parameters</h3>
            <p className="text-sm text-gray-600 mb-4">
              Pre-apply filters when users visit this page. These act as default values.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Example URLs:</p>
              <code className="text-sm text-gray-800 block mb-1">
                /{config.slug}?facilityIds=123
              </code>
              <code className="text-sm text-gray-800 block mb-1">
                /{config.slug}?viewMode=schedule
              </code>
              <code className="text-sm text-gray-800 block">
                /{config.slug}?programTypes=camp_clinic
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
