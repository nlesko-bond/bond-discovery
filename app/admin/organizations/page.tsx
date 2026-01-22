'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RefreshCw, Building2 } from 'lucide-react';

interface ConfigState {
  organizationIds: string[];
  facilityIds: string[];
}

export default function OrganizationsPage() {
  const [config, setConfig] = useState<ConfigState>({
    organizationIds: [],
    facilityIds: [],
  });
  const [newOrgId, setNewOrgId] = useState('');
  const [newFacilityId, setNewFacilityId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Load current config
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setConfig({
            organizationIds: data.data.organizationIds || [],
            facilityIds: data.data.facilityIds || [],
          });
        }
      })
      .catch(err => console.error('Error loading config:', err));
  }, []);

  const addOrgId = () => {
    if (newOrgId && !config.organizationIds.includes(newOrgId)) {
      setConfig({
        ...config,
        organizationIds: [...config.organizationIds, newOrgId],
      });
      setNewOrgId('');
    }
  };

  const removeOrgId = (id: string) => {
    setConfig({
      ...config,
      organizationIds: config.organizationIds.filter(o => o !== id),
    });
  };

  const addFacilityId = () => {
    if (newFacilityId && !config.facilityIds.includes(newFacilityId)) {
      setConfig({
        ...config,
        facilityIds: [...config.facilityIds, newFacilityId],
      });
      setNewFacilityId('');
    }
  };

  const removeFacilityId = (id: string) => {
    setConfig({
      ...config,
      facilityIds: config.facilityIds.filter(f => f !== id),
    });
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/config?id=default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Organizations & Facilities</h1>
        <p className="text-gray-600 mt-1">
          Configure which organizations and facilities to display
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Organization IDs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="text-gray-400" size={24} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Organization IDs</h2>
            <p className="text-sm text-gray-600">Programs from these organizations will be displayed</p>
          </div>
        </div>

        {/* Add new org ID */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter organization ID"
            value={newOrgId}
            onChange={(e) => setNewOrgId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addOrgId()}
            className="input flex-1"
          />
          <button
            onClick={addOrgId}
            disabled={!newOrgId}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Add
          </button>
        </div>

        {/* List of org IDs */}
        <div className="flex flex-wrap gap-2">
          {config.organizationIds.map(id => (
            <div
              key={id}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg border border-blue-200"
            >
              <span className="font-mono text-sm">{id}</span>
              <button
                onClick={() => removeOrgId(id)}
                className="text-blue-600 hover:text-red-600 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {config.organizationIds.length === 0 && (
            <p className="text-gray-500 text-sm">No organizations configured</p>
          )}
        </div>
      </div>

      {/* Facility IDs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="text-gray-400" size={24} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Facility IDs (Optional)</h2>
            <p className="text-sm text-gray-600">Filter to specific facilities. Leave empty to show all.</p>
          </div>
        </div>

        {/* Add new facility ID */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter facility ID"
            value={newFacilityId}
            onChange={(e) => setNewFacilityId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFacilityId()}
            className="input flex-1"
          />
          <button
            onClick={addFacilityId}
            disabled={!newFacilityId}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Add
          </button>
        </div>

        {/* List of facility IDs */}
        <div className="flex flex-wrap gap-2">
          {config.facilityIds.map(id => (
            <div
              key={id}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-800 rounded-lg border border-green-200"
            >
              <span className="font-mono text-sm">{id}</span>
              <button
                onClick={() => removeFacilityId(id)}
                className="text-green-600 hover:text-red-600 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {config.facilityIds.length === 0 && (
            <p className="text-gray-500 text-sm italic">Showing all facilities</p>
          )}
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
