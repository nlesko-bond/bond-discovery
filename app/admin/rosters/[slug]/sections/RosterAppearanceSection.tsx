'use client';

import { AlertTriangle } from 'lucide-react';
import type { RosterBranding } from '@/types/rosters';
import type { IRosterEditorSectionProps } from '../roster-editor-types';

const COLORS: Array<{ key: keyof RosterBranding; label: string; hint: string }> = [
  { key: 'primaryColor', label: 'Primary', hint: 'Buttons and the active view control' },
  { key: 'accentColor', label: 'Accent', hint: 'Team avatars — white text sits on this' },
  { key: 'accentColorLight', label: 'Accent light', hint: 'Tints and hover states' },
  { key: 'bgColor', label: 'Page background', hint: 'Behind the whole page' },
];

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** WCAG relative luminance, for the contrast warning below. */
function luminance(hex: string): number | null {
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex.slice(0, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(full)) return null;
  const channels = [1, 3, 5]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastWithWhite(hex: string): number | null {
  const l = luminance(hex);
  return l === null ? null : (1.05) / (l + 0.05);
}

export function RosterAppearanceSection({ config, patch }: IRosterEditorSectionProps) {
  const branding = config.branding;

  function setBranding(key: keyof RosterBranding, value: string | null) {
    patch({ branding: { ...branding, [key]: value } as RosterBranding });
  }

  const accentContrast = contrastWithWhite(branding.accentColor);
  const primaryContrast = contrastWithWhite(branding.primaryColor);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-medium text-gray-900">Colours</h2>

        <div className="space-y-3">
          {COLORS.map(({ key, label, hint }) => {
            const value = String(branding[key] ?? '');
            const valid = HEX.test(value);
            return (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label={`${label} colour picker`}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-gray-300"
                  value={valid && value.length === 7 ? value : '#000000'}
                  onChange={(e) => setBranding(key, e.target.value)}
                />
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor={`color-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`color-${key}`}
                    className="input font-mono text-sm"
                    value={value}
                    onChange={(e) => setBranding(key, e.target.value)}
                    placeholder="#1A1A1A"
                  />
                  <p className="mt-0.5 text-xs text-gray-500">
                    {hint}
                    {!valid && value ? ' · not a valid hex colour, the default will be used' : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {(accentContrast !== null && accentContrast < 4.5) ||
        (primaryContrast !== null && primaryContrast < 4.5) ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              White text sits on these colours. Anything below 4.5:1 fails WCAG AA for normal text —
              accent is {accentContrast?.toFixed(2) ?? '—'}:1, primary is{' '}
              {primaryContrast?.toFixed(2) ?? '—'}:1. Darkening the colour raises the ratio.
            </span>
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Type</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="fontHeading">
              Heading font
            </label>
            <input
              id="fontHeading"
              className="input"
              value={branding.fontHeading}
              onChange={(e) => setBranding('fontHeading', e.target.value)}
              placeholder="Bebas Neue"
            />
          </div>
          <div>
            <label className="label" htmlFor="fontBody">
              Body font
            </label>
            <input
              id="fontBody"
              className="input"
              value={branding.fontBody}
              onChange={(e) => setBranding('fontBody', e.target.value)}
              placeholder="Open Sans"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">Google Fonts family names.</p>
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Header</h2>

        <label className="label" htmlFor="logoUrl">
          Logo URL
        </label>
        <input
          id="logoUrl"
          className="input mb-1"
          value={branding.logoUrl ?? ''}
          onChange={(e) => setBranding('logoUrl', e.target.value || null)}
          placeholder="https://…"
        />
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="mb-3 h-8 w-auto rounded border border-gray-200 bg-white p-1"
          />
        )}

        <label className="label" htmlFor="heroTitle">
          Title
        </label>
        <input
          id="heroTitle"
          className="input mb-3"
          value={branding.heroTitle ?? ''}
          onChange={(e) => setBranding('heroTitle', e.target.value || null)}
          placeholder={config.name}
        />

        <label className="label" htmlFor="heroSubtitle">
          Subtitle
        </label>
        <input
          id="heroSubtitle"
          className="input"
          value={branding.heroSubtitle ?? ''}
          onChange={(e) => setBranding('heroSubtitle', e.target.value || null)}
          placeholder="Optional line under the title"
        />
        <p className="mt-1 text-xs text-gray-500">
          The title also becomes the browser tab name. Leaving it blank uses the page name.
        </p>
      </section>
    </div>
  );
}
