'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, SlidersHorizontal, ToggleLeft, ToggleRight } from 'lucide-react';

interface FeaturesState {
  showPricing: boolean;
  showAvailability: boolean;
  showMembershipBadges: boolean;
  showAgeGender: boolean;
  enableFilters: string[];
  defaultView: 'programs' | 'schedule';
  allowViewToggle: boolean;
}

const ALL_FILTERS = [
  { id: 'search', label: 'Search', description: 'Text search for programs' },
  { id: 'facility', label: 'Facility/Location', description: 'Filter by facility location' },
  { id: 'program', label: 'Program', description: 'Filter by specific program name' },
  { id: 'sport', label: 'Sport/Activity', description: 'Filter by sport type' },
  { id: 'programType', label: 'Program Type', description: 'Filter by class, camp, league, etc.' },
  { id: 'dateRange', label: 'Date Range', description: 'Filter by date range' },
  { id: 'age', label: 'Age Range', description: 'Filter by age requirements' },
  { id: 'availability', label: 'Availability', description: 'Filter by spots remaining' },
  { id: 'membership', label: 'Membership', description: 'Filter by membership requirements' },
];

export default function FiltersPage() {
  const [features, setFeatures] = useState<FeaturesState>({
    showPricing: true,
    showAvailability: true,
    showMembershipBadges: true,
    showAgeGender: true,
    enableFilters: ['search', 'facility', 'sport', 'programType', 'dateRange', 'age', 'availability'],
    defaultView: 'programs',
    allowViewToggle: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.data?.features) {
          setFeatures(data.data.features);
        }
      })
      .catch(err => console.error('Error loading config:', err));
  }, []);

  const toggleFilter = (filterId: string) => {
    setFeatures(prev => ({
      ...prev,
      enableFilters: prev.enableFilters.includes(filterId)
        ? prev.enableFilters.filter(f => f !== filterId)
        : [...prev.enableFilters, filterId],
    }));
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/config?id=default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Filters & Features</h1>
        <p className="text-gray-600 mt-1">
          Configure which filters and features are available
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Display Features */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Display Features</h2>
        <p className="text-sm text-gray-600 mb-6">
          Control what information is shown on program cards
        </p>
        
        <div className="space-y-4">
          <ToggleItem
            label="Show Pricing"
            description="Display prices on program cards"
            enabled={features.showPricing}
            onChange={() => setFeatures({ ...features, showPricing: !features.showPricing })}
          />
          <ToggleItem
            label="Show Availability"
            description="Display spots remaining and capacity"
            enabled={features.showAvailability}
            onChange={() => setFeatures({ ...features, showAvailability: !features.showAvailability })}
          />
          <ToggleItem
            label="Show Membership Badges"
            description="Display badges for membership-required programs"
            enabled={features.showMembershipBadges}
            onChange={() => setFeatures({ ...features, showMembershipBadges: !features.showMembershipBadges })}
          />
          <ToggleItem
            label="Show Age/Gender Info"
            description="Display age range and gender restrictions"
            enabled={features.showAgeGender}
            onChange={() => setFeatures({ ...features, showAgeGender: !features.showAgeGender })}
          />
        </div>
      </div>

      {/* View Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">View Settings</h2>
        
        <div className="space-y-4">
          <div>
            <label className="label">Default View</label>
            <div className="flex gap-3">
              <button
                onClick={() => setFeatures({ ...features, defaultView: 'programs' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  features.defaultView === 'programs'
                    ? 'bg-toca-purple text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Programs Grid
              </button>
              <button
                onClick={() => setFeatures({ ...features, defaultView: 'schedule' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  features.defaultView === 'schedule'
                    ? 'bg-toca-purple text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Schedule Calendar
              </button>
            </div>
          </div>

          <ToggleItem
            label="Allow View Toggle"
            description="Let users switch between Programs and Schedule views"
            enabled={features.allowViewToggle}
            onChange={() => setFeatures({ ...features, allowViewToggle: !features.allowViewToggle })}
          />
        </div>
      </div>

      {/* Enabled Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <SlidersHorizontal className="text-gray-400" size={24} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Enabled Filters</h2>
            <p className="text-sm text-gray-600">Choose which filters are available to users</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALL_FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => toggleFilter(filter.id)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                features.enableFilters.includes(filter.id)
                  ? 'border-toca-purple bg-toca-purple/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{filter.label}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  features.enableFilters.includes(filter.id)
                    ? 'border-toca-purple bg-toca-purple'
                    : 'border-gray-300'
                }`}>
                  {features.enableFilters.includes(filter.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{filter.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 py-3"
        >
          {saving ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button onClick={onChange} className="flex-shrink-0">
        {enabled ? (
          <ToggleRight size={32} className="text-toca-purple" />
        ) : (
          <ToggleLeft size={32} className="text-gray-300" />
        )}
      </button>
    </div>
  );
}
