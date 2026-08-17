import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RosterStaffApp } from '@/components/rosters/RosterStaffApp';
import { resolveViewerMode } from '@/lib/roster-access';
import { getRosterPageBySlug } from '@/lib/rosters-config';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

/** A staff tool is never indexed, whatever the page's own indexing setting. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = await getRosterPageBySlug(slug);
  return {
    title: config ? `${config.name} — Staff` : 'Not found',
    robots: { index: false, follow: false },
  };
}

export default async function RosterStaffPage({ params }: Props) {
  const { slug } = await params;
  const config = await getRosterPageBySlug(slug);

  // Unpublished reads as missing, same as the consumer page.
  if (!config || !config.isActive) {
    notFound();
  }

  // Without a staff password there is nothing this surface can ever unlock.
  if (!config.hasStaffPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Staff access is not set up</h1>
          <p className="mt-2 text-sm text-slate-600">
            This roster page has no staff password, so the staff tools are unavailable. An
            administrator can set one in the page&rsquo;s Access &amp; Export settings.
          </p>
        </div>
      </div>
    );
  }

  const mode = await resolveViewerMode(slug, config.hasStaffPassword);

  return <RosterStaffApp slug={slug} name={config.name} staffUnlocked={mode === 'staff'} />;
}
