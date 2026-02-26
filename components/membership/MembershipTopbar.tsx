'use client';

import { MembershipPageConfig } from '@/types/membership';

interface Props {
  config: MembershipPageConfig;
}

export function MembershipTopbar({ config }: Props) {
  const { branding, nav_links, organization_name } = config;

  return (
    <div
      className="flex items-center justify-between px-8 py-3.5"
      style={{ background: 'var(--m-black)' }}
    >
      <a
        href="#"
        className="font-heading text-[22px] text-white tracking-[2px] no-underline flex items-center gap-2.5"
      >
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={organization_name || ''}
            className="h-8 w-auto"
          />
        ) : (
          <>
            <span style={{ color: 'var(--m-accent-light)' }}>●</span>{' '}
            {(organization_name || '').toUpperCase()}
          </>
        )}
      </a>

      {nav_links && nav_links.length > 0 && (
        <nav className="hidden md:flex gap-6">
          {nav_links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              className="text-[13px] font-bold text-gray-400 no-underline uppercase tracking-[1.5px] hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
