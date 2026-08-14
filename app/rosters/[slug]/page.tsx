import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RosterPage } from '@/components/rosters/RosterPage';
import { canViewRosterPage, resolveViewerMode } from '@/lib/roster-access';
import { getRosterPageBySlug } from '@/lib/rosters-config';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = await getRosterPageBySlug(slug);

  if (!config || !config.isActive) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  return {
    title: config.branding.heroTitle || config.name,
    // Opt-in only. A page carrying participant names stays out of the index
    // unless an operator has deliberately allowed it.
    robots: config.allowIndexing
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export default async function RosterSlugPage({ params }: Props) {
  const { slug } = await params;
  const config = await getRosterPageBySlug(slug);

  // Unpublished reads as missing, so an in-progress page cannot be probed.
  if (!config || !config.isActive) {
    notFound();
  }

  const unlocked = await canViewRosterPage(
    slug,
    config.pageAccess,
    config.hasViewerPassword,
    config.hasStaffPassword
  );
  const mode = await resolveViewerMode(slug, config.hasStaffPassword);

  return (
    <RosterPage
      slug={slug}
      name={config.name}
      branding={config.branding}
      pageAccess={config.pageAccess}
      unlocked={unlocked}
      mode={mode}
      allowPrint={config.allowPrint}
      hasStaffPassword={config.hasStaffPassword}
      isYouth={config.isYouth}
    />
  );
}
