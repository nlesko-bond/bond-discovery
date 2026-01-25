'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Palette, Type, Image, Sparkles, RotateCcw } from 'lucide-react';

interface BrandingState {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyName: string;
  tagline: string;
  logo: string;
  buttonStyle: 'rounded' | 'pill' | 'square';
  cardStyle: 'shadow' | 'border' | 'flat';
}

// Preset themes
const presets = {
  toca: {
    name: 'TOCA Soccer',
    primaryColor: '#1E2761', // Deep navy blue
    secondaryColor: '#6366F1', // Purple/indigo
    accentColor: '#A5B4FC', // Light purple
    companyName: 'TOCA Soccer',
    tagline: 'Find soccer programs at your local TOCA centers',
  },
  bond: {
    name: 'Bond Sports',
    primaryColor: '#c4ad7d',
    secondaryColor: '#1f2937',
    accentColor: '#3B82F6',
    companyName: 'Bond Sports',
    tagline: 'Find programs at your local sports facilities',
  },
  modern: {
    name: 'Modern Blue',
    primaryColor: '#3B82F6',
    secondaryColor: '#111827',
    accentColor: '#10B981',
    companyName: 'Sports Discovery',
    tagline: 'Find your next activity',
  },
  sport: {
    name: 'Sports Orange',
    primaryColor: '#F97316',
    secondaryColor: '#1E293B',
    accentColor: '#22C55E',
    companyName: 'Active Sports',
    tagline: 'Get active today',
  },
};

export default function BrandingPage() {
  const [branding, setBranding] = useState<BrandingState>({
    primaryColor: '#1E2761',
    secondaryColor: '#6366F1',
    accentColor: '#A5B4FC',
    companyName: 'TOCA Soccer',
    tagline: 'Find soccer programs at your local TOCA centers',
    logo: '',
    buttonStyle: 'rounded',
    cardStyle: 'shadow',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.data?.branding) {
          setBranding(prev => ({
            ...prev,
            primaryColor: data.data.branding.primaryColor || prev.primaryColor,
            secondaryColor: data.data.branding.secondaryColor || prev.secondaryColor,
            accentColor: data.data.branding.accentColor || prev.accentColor,
            companyName: data.data.branding.companyName || prev.companyName,
            tagline: data.data.branding.tagline || prev.tagline,
            logo: data.data.branding.logoUrl || data.data.branding.logo || '',
            buttonStyle: data.data.branding.buttonStyle || 'rounded',
            cardStyle: data.data.branding.cardStyle || 'shadow',
          }));
        }
      })
      .catch(err => console.error('Error loading config:', err));
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/config?id=default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          branding: {
            primaryColor: branding.primaryColor,
            secondaryColor: branding.secondaryColor,
            accentColor: branding.accentColor,
            companyName: branding.companyName,
            tagline: branding.tagline,
            logoUrl: branding.logo,
            buttonStyle: branding.buttonStyle,
            cardStyle: branding.cardStyle,
          }
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Branding saved successfully!' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save branding' });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    setBranding(prev => ({
      ...prev,
      ...preset,
      logo: prev.logo, // Keep existing logo
      buttonStyle: prev.buttonStyle,
      cardStyle: prev.cardStyle,
    }));
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Branding</h1>
        <p className="text-gray-600 mt-1">
          Customize the look and feel of your discovery page
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Preset Themes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="text-gray-400" size={24} />
          <h2 className="text-lg font-bold text-gray-900">Quick Presets</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key as keyof typeof presets)}
              className="p-3 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition-colors text-left"
            >
              <div className="flex gap-1 mb-2">
                <div 
                  className="w-6 h-6 rounded-full" 
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <div 
                  className="w-6 h-6 rounded-full" 
                  style={{ backgroundColor: preset.secondaryColor }}
                />
              </div>
              <p className="font-semibold text-sm text-gray-900">{preset.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Company Name */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Type className="text-gray-400" size={24} />
              <h2 className="text-lg font-bold text-gray-900">Brand Identity</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company/Brand Name</label>
                <input
                  type="text"
                  value={branding.companyName}
                  onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-toca-green focus:border-transparent"
                  placeholder="Your Company Name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  First word will be highlighted with primary color
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={branding.tagline}
                  onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-toca-green focus:border-transparent"
                  placeholder="Your tagline or description"
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="text-gray-400" size={24} />
              <h2 className="text-lg font-bold text-gray-900">Color Palette</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="#00D632"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Buttons, links, accents</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="#1a1a1a"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Text, headers, badges</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.accentColor}
                    onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                    className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.accentColor}
                    onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="#FFB800"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Member badges, highlights, alerts</p>
              </div>
            </div>
          </div>

          {/* Logo URL */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Image className="text-gray-400" size={24} />
              <h2 className="text-lg font-bold text-gray-900">Logo</h2>
            </div>
            <input
              type="url"
              value={branding.logo}
              onChange={(e) => setBranding({ ...branding, logo: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-toca-green focus:border-transparent"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-gray-500 mt-2">
              Enter a URL to your logo image. Recommended size: 200x50px. Leave blank to use text.
            </p>
            {branding.logo && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <img src={branding.logo} alt="Logo preview" className="h-10 object-contain" />
              </div>
            )}
          </div>

          {/* Style Options */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Style Options</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Button Style</label>
                <div className="flex gap-2">
                  {(['rounded', 'pill', 'square'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => setBranding({ ...branding, buttonStyle: style })}
                      className={`px-4 py-2 border-2 transition-colors ${
                        branding.buttonStyle === style
                          ? 'border-toca-green bg-toca-green/10'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${
                        style === 'rounded' ? 'rounded-lg' :
                        style === 'pill' ? 'rounded-full' :
                        'rounded-none'
                      }`}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card Style</label>
                <div className="flex gap-2">
                  {(['shadow', 'border', 'flat'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => setBranding({ ...branding, cardStyle: style })}
                      className={`px-4 py-2 border-2 rounded-lg transition-colors ${
                        branding.cardStyle === style
                          ? 'border-toca-green bg-toca-green/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Live Preview</h3>
              <button
                onClick={() => applyPreset('toca')}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
            
            {/* Preview Header */}
            <div 
              className="p-4 border-b"
              style={{ borderColor: branding.primaryColor + '30' }}
            >
              <div className="flex items-center gap-3">
                {branding.logo ? (
                  <img src={branding.logo} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <div 
                    className="text-xl font-bold"
                    style={{ color: branding.secondaryColor }}
                  >
                    <span style={{ color: branding.primaryColor }}>
                      {branding.companyName.split(' ')[0]}
                    </span>{' '}
                    {branding.companyName.split(' ').slice(1).join(' ')}
                  </div>
                )}
              </div>
              {branding.tagline && (
                <p className="text-xs text-gray-500 mt-1">{branding.tagline}</p>
              )}
            </div>

            {/* Preview Content */}
            <div className="p-4 space-y-4">
              {/* Sample Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  className={`px-4 py-2 text-white font-medium transition-colors ${
                    branding.buttonStyle === 'pill' ? 'rounded-full' :
                    branding.buttonStyle === 'square' ? 'rounded-none' :
                    'rounded-lg'
                  }`}
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className={`px-4 py-2 text-white font-medium ${
                    branding.buttonStyle === 'pill' ? 'rounded-full' :
                    branding.buttonStyle === 'square' ? 'rounded-none' :
                    'rounded-lg'
                  }`}
                  style={{ backgroundColor: branding.secondaryColor }}
                >
                  Secondary
                </button>
              </div>

              {/* Sample Badges */}
              <div className="flex flex-wrap gap-2">
                <span 
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ 
                    backgroundColor: branding.primaryColor + '20',
                    color: branding.primaryColor
                  }}
                >
                  Soccer
                </span>
                <span 
                  className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: branding.accentColor }}
                >
                  Member Pricing
                </span>
                <span 
                  className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: branding.secondaryColor }}
                >
                  League
                </span>
              </div>

              {/* Sample Card */}
              <div 
                className={`p-4 rounded-xl ${
                  branding.cardStyle === 'shadow' ? 'shadow-lg border border-gray-100' :
                  branding.cardStyle === 'border' ? 'border-2 border-gray-200' :
                  'bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-16 h-16 rounded-lg flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.primaryColor}88)`
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold" style={{ color: branding.secondaryColor }}>
                      Adult Pickup Soccer
                    </p>
                    <p className="text-sm text-gray-500">TOCA - Evanston, IL</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-lg font-bold" style={{ color: branding.secondaryColor }}>
                        $20
                      </span>
                      <span className="text-sm" style={{ color: branding.primaryColor }}>
                        Members: FREE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mt-6 gap-3">
        <button
          onClick={() => applyPreset('toca')}
          className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RotateCcw size={18} />
          Reset to TOCA
        </button>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-3 bg-toca-green text-white rounded-xl font-semibold hover:bg-toca-green-dark transition-colors flex items-center gap-2"
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
