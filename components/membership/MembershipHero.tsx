'use client';

import { MembershipPageConfig, MembershipPageData } from '@/types/membership';

interface Props {
  config: MembershipPageConfig;
  data: MembershipPageData;
}

export function MembershipHero({ config, data }: Props) {
  const { branding } = config;
  const hasOpenRegistration = data.memberships.some((m) => m.registrationOpen);

  const title = branding.heroTitle || config.name;
  const titleParts = title.split(/\n|<br\s*\/?>/i);

  return (
    <section
      className="relative overflow-hidden text-center px-8 py-20 md:py-[80px]"
      style={{ background: 'var(--m-black)' }}
    >
      {/* Radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${hexToRgba(config.branding.accentColor, 0.12)} 0%, transparent 70%)`,
        }}
      />

      {hasOpenRegistration && (
        <div
          className="inline-flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[2.5px] mb-5 relative z-10"
          style={{ color: 'var(--m-accent-light)' }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Registration Open Now
        </div>
      )}

      <h1 className="font-heading text-[clamp(56px,10vw,96px)] text-white leading-[0.95] tracking-[3px] relative z-10 mb-4">
        {titleParts.map((part, i) => (
          <span key={i}>
            {i === 0 ? (
              part
            ) : (
              <>
                <br />
                <span style={{ color: 'var(--m-accent-light)' }}>{part}</span>
              </>
            )}
          </span>
        ))}
      </h1>

      {branding.heroSubtitle && (
        <p className="text-[clamp(18px,3vw,22px)] text-gray-500 relative z-10 max-w-[480px] mx-auto">
          {branding.heroSubtitle}
        </p>
      )}
    </section>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
