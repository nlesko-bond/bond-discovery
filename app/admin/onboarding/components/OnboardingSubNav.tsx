'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';

const links = [
  { href: `${ONBOARDING_BASE}/dashboard`, label: 'Dashboard' },
  { href: `${ONBOARDING_BASE}/orgs`, label: 'Organizations' },
  { href: `${ONBOARDING_BASE}/templates`, label: 'Templates' },
  { href: `${ONBOARDING_BASE}/team`, label: 'Team' },
  { href: `${ONBOARDING_BASE}/settings`, label: 'Settings' },
];

export function OnboardingSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
