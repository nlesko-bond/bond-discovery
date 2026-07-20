import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Full-screen chrome for TV monitor pages and the studio — no site nav,
 * black backdrop so letterboxed ratios look intentional on any screen.
 */
export default function TvMonitorLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-black">{children}</div>;
}
