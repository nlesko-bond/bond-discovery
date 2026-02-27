'use client';

import { useState, useMemo } from 'react';
import {
  MembershipPageConfig,
  MembershipPageData,
  MembershipCategory,
  TransformedMembership,
} from '@/types/membership';
import { MembershipTopbar } from './MembershipTopbar';
import { MembershipHero } from './MembershipHero';
import { MembershipInfoStrip } from './MembershipInfoStrip';
import { MembershipRow } from './MembershipRow';

interface Props {
  config: MembershipPageConfig;
  initialData: MembershipPageData;
}

export function MembershipDiscoveryPage({ config, initialData }: Props) {
  const [activeFilter, setActiveFilter] = useState<MembershipCategory | 'all'>('all');

  const { branding } = config;

  const filteredMemberships = useMemo(() => {
    if (activeFilter === 'all') return initialData.memberships;
    return initialData.memberships.filter((m) => m.category === activeFilter);
  }, [activeFilter, initialData.memberships]);

  const categoryLabels = initialData.categoryLabels;

  const tabs: (MembershipCategory | 'all')[] = [
    'all',
    ...initialData.categories,
  ];

  const priceRangeText = initialData.priceRange
    ? `${initialData.memberships.length} plans from ${formatCurrency(initialData.priceRange.min)} to ${formatCurrency(initialData.priceRange.max)} — select one to register.`
    : `${initialData.memberships.length} plans available`;

  const cssVars = {
    '--m-black': branding.primaryColor,
    '--m-accent': branding.accentColor,
    '--m-accent-light': branding.accentColorLight || branding.accentColor,
    '--m-accent-bg': hexToRgba(branding.accentColor, 0.08),
    '--m-bg': branding.bgColor,
  } as React.CSSProperties;

  return (
    <div style={cssVars} className="min-h-screen" data-membership-page>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(branding.fontHeading)}&family=${encodeURIComponent(branding.fontBody)}:wght@400;500;600;700;800&display=swap');
            [data-membership-page] {
              font-family: '${branding.fontBody}', Helvetica, Arial, sans-serif;
              background: var(--m-bg);
              color: var(--m-black);
              -webkit-font-smoothing: antialiased;
            }
            [data-membership-page] .font-heading {
              font-family: '${branding.fontHeading}', sans-serif;
            }
          `,
        }}
      />

      <MembershipTopbar config={config} />
      <MembershipHero config={config} data={initialData} />

      <div className="max-w-[800px] mx-auto px-6 py-12 md:py-16">
        <MembershipInfoStrip data={initialData} />

        <h2
          className="font-heading text-[clamp(32px,5vw,44px)] tracking-[2px] mb-2"
          style={{ color: 'var(--m-black)' }}
        >
          CHOOSE YOUR MEMBERSHIP
        </h2>
        <p className="text-[17px] text-gray-500 mb-7">{priceRangeText}</p>

        {/* Filter Tabs */}
        {tabs.length > 2 && (
          <div className="flex gap-1.5 mb-6 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-6 py-3 text-[15px] font-bold uppercase tracking-[1px] rounded-lg border-2 transition-all cursor-pointer select-none ${
                  activeFilter === tab
                    ? 'text-white border-[var(--m-black)]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]'
                }`}
                style={
                  activeFilter === tab
                    ? { background: 'var(--m-black)', borderColor: 'var(--m-black)' }
                    : undefined
                }
              >
                {categoryLabels[tab] || tab}
              </button>
            ))}
          </div>
        )}

        {/* Membership Rows */}
        <div className="flex flex-col gap-3">
          {filteredMemberships.map((membership) => (
            <MembershipRow key={membership.id} membership={membership} />
          ))}
          {filteredMemberships.length === 0 && initialData.totalCount > 0 && (
            <p className="text-center text-gray-500 py-12">
              No memberships available for this category.
            </p>
          )}
          {initialData.totalCount === 0 && (
            <div className="text-center py-16 px-6">
              <p className="text-xl font-semibold text-gray-700 mb-2">
                No active memberships available right now
              </p>
              <p className="text-gray-500">
                Please check back soon — new membership options are on the way.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {config.footer_info && (
        <footer className="text-center py-10 px-6 border-t border-gray-200 mt-4">
          {config.footer_info.address && (
            <p className="text-sm text-gray-500 mb-1">{config.footer_info.address}</p>
          )}
          <p className="text-sm text-gray-500">
            {config.footer_info.email && (
              <a
                href={`mailto:${config.footer_info.email}`}
                className="font-semibold hover:underline"
                style={{ color: 'var(--m-accent)' }}
              >
                {config.footer_info.email}
              </a>
            )}
            {config.footer_info.email && ' · '}
            Powered by{' '}
            <a
              href="https://bondsports.co"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
              style={{ color: 'var(--m-accent)' }}
            >
              Bond Sports
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
