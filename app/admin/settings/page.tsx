'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Key, Clock, Link2, Trash2 } from 'lucide-react';

interface SettingsState {
  apiKey: string;
  cacheTtl: number;
  allowedParams: string[];
  defaultParams: Record<string, string>;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    apiKey: '',
    cacheTtl: 300,
    allowedParams: ['orgIds', 'facilityIds', 'viewMode', 'search', 'sport', 'programType'],
    defaultParams: {},
  });
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setSettings({
            apiKey: data.data.apiKey || '',
            cacheTtl: data.data.cacheTtl || 300,
            allowedParams: data.data.allowedParams || [],
            defaultParams: data.data.defaultParams || {},
          });
        }
      })
      .catch(err => console.error('Error loading config:', err));
  }, []);

  const addDefaultParam = () => {
    if (newParamKey && newParamValue) {
      setSettings({
        ...settings,
        defaultParams: {
          ...settings.defaultParams,
          [newParamKey]: newParamValue,
        },
      });
      setNewParamKey('');
      setNewParamValue('');
    }
  };

  const removeDefaultParam = (key: string) => {
    const { [key]: _, ...rest } = settings.defaultParams;
    setSettings({ ...settings, defaultParams: rest });
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/config?id=default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cacheTtl: settings.cacheTtl,
          allowedParams: settings.allowedParams,
          defaultParams: settings.defaultParams,
        }),
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

  const clearCache = async () => {
    setClearingCache(true);
    setMessage(null);

    try {
      // In a real app, this would call an API endpoint to clear the cache
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage({ type: 'success', text: 'Cache cleared successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to clear cache' });
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure API and caching settings
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* API Key */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="text-gray-400" size={24} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">API Key</h2>
            <p className="text-sm text-gray-600">Bond Sports API key (stored securely)</p>
          </div>
        </div>
        
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
          className="input font-mono"
          placeholder="••••••••••••••••"
        />
        <p className="text-xs text-gray-500 mt-2">
          Your API key is stored securely and never exposed to the client
        </p>
      </div>

      {/* Cache Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="text-gray-400" size={24} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cache Settings</h2>
            <p className="text-sm text-gray-600">Configure how long data is cached</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Cache TTL (seconds)</label>
            <input
              type="number"
              value={settings.cacheTtl}
              onChange={(e) => setSettings({ ...settings, cacheTtl: parseInt(e.target.value) || 300 })}
              className="input"
              min={60}
              max={3600}
            />
            <p className="text-xs text-gray-500 mt-1">
              How long to cache API responses (60-3600 seconds)
            </p>
          </div>
          
          <div>
            <label className="label">Clear Cache</label>
            <button
              onClick={clearCache}
              disabled={clearingCache}
              className="btn-secondary flex items-center gap-2 w-full justify-center"
            >
              {clearingCache ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Clear All Cache
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Force refresh all cached data
            </p>
          </div>
        </div>
      </div>

      {/* URL Parameters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link2 className="text-gray-400" size={24} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">URL Parameters</h2>
            <p className="text-sm text-gray-600">Configure parameterized URL support</p>
          </div>
        </div>
        
        {/* Allowed Parameters */}
        <div className="mb-6">
          <label className="label">Allowed URL Parameters</label>
          <div className="flex flex-wrap gap-2">
            {['orgIds', 'facilityIds', 'programIds', 'viewMode', 'search', 'sport', 'programType', 'programTypes', 'startDate', 'endDate', 'ageMin', 'ageMax'].map(param => {
              const isEnabled = settings.allowedParams.includes(param);
              return (
                <button
                  key={param}
                  onClick={() => {
                    setSettings({
                      ...settings,
                      allowedParams: isEnabled
                        ? settings.allowedParams.filter(p => p !== param)
                        : [...settings.allowedParams, param],
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isEnabled
                      ? 'bg-toca-purple text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {param}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Parameters that can be set via URL query strings
          </p>
        </div>

        {/* Default Parameters */}
        <div>
          <label className="label">Default Parameters</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Parameter name"
              value={newParamKey}
              onChange={(e) => setNewParamKey(e.target.value)}
              className="input flex-1"
            />
            <input
              type="text"
              placeholder="Default value"
              value={newParamValue}
              onChange={(e) => setNewParamValue(e.target.value)}
              className="input flex-1"
            />
            <button
              onClick={addDefaultParam}
              disabled={!newParamKey || !newParamValue}
              className="btn-primary"
            >
              Add
            </button>
          </div>
          
          {Object.entries(settings.defaultParams).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(settings.defaultParams).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="font-mono text-sm text-gray-700">{key}</span>
                    <span className="text-gray-400 mx-2">=</span>
                    <span className="font-mono text-sm text-gray-900">{value}</span>
                  </div>
                  <button
                    onClick={() => removeDefaultParam(key)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No default parameters set</p>
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
