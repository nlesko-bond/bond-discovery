'use client';

import { TransformedMembership, MembershipCategory } from '@/types/membership';

interface Props {
  membership: TransformedMembership;
}

const DEFAULT_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  family: { bg: 'var(--m-accent-bg)', color: 'var(--m-accent)' },
  individual: { bg: '#FFF8E1', color: '#E88A00' },
};

export function MembershipRow({ membership }: Props) {
  const badge = membership.badgeStyle
    || DEFAULT_BADGE_STYLES[membership.category]
    || DEFAULT_BADGE_STYLES.individual;

  return (
    <a
      href={membership.registrationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-5 bg-white rounded-lg py-6 px-7 no-underline border-2 border-transparent transition-all duration-250 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[var(--m-accent)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] active:scale-[0.995] max-sm:py-[18px] max-sm:px-4 max-sm:gap-3.5"
      style={{ color: 'inherit' }}
    >
      {/* Badge */}
      <div
        className="w-16 h-16 rounded-lg flex flex-col items-center justify-center shrink-0 font-extrabold leading-none max-sm:w-[52px] max-sm:h-[52px]"
        style={{ background: badge.bg, color: badge.color }}
      >
        <span className="font-heading text-[26px] tracking-[1px] max-sm:text-[22px]">
          {membership.memberCount}
        </span>
        <span className="text-[9px] uppercase tracking-[0.5px] mt-px font-extrabold">
          {membership.badgeLabel}
        </span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-xl font-bold leading-tight max-sm:text-lg" style={{ color: 'var(--m-black)' }}>
          {membership.displayName}
        </div>
        <div className="text-[15px] text-gray-500 mt-0.5">
          Ages {membership.minAge}{membership.maxAge < 100 ? `–${membership.maxAge}` : '+'} · {membership.memberCount} member{membership.memberCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <div
          className="font-heading text-[32px] tracking-[1px] leading-none max-sm:text-[26px]"
          style={{ color: 'var(--m-black)' }}
        >
          {membership.priceFormatted}
        </div>
        <div className="text-[13px] text-gray-500 font-medium mt-0.5">
          {membership.pricePerPersonFormatted || 'per season'}
        </div>
      </div>

      {/* Arrow */}
      <div className="shrink-0 w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center transition-all group-hover:bg-[var(--m-black)] max-sm:w-9 max-sm:h-9">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px] stroke-gray-500 transition-colors group-hover:stroke-white max-sm:w-3.5 max-sm:h-3.5"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}
