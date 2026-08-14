import type { Metadata } from 'next';

/**
 * Default for the whole /rosters tree. The per-page route overrides this to
 * `index` only when a page explicitly sets `allow_indexing`.
 *
 * Search indexing is opt-in because these pages can carry participant names,
 * and de-indexing after the fact does not reliably work.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RostersLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
