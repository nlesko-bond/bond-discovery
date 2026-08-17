import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RosterPage } from '@/components/rosters/RosterPage';
import { canViewRosterPage } from '@/lib/roster-access';
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

  // A staff-only page has no consumer audience at all — its one surface is the
  // staff tool, so send visitors straight there.
  if (config.pageAccess === 'staff') {
    redirect(`/rosters/${slug}/staff`);
  }

  const unlocked = await canViewRosterPage(
    slug,
    config.pageAccess,
    config.hasViewerPassword,
    config.hasStaffPassword
  );

  return (
    <RosterPage
      slug={slug}
      name={config.name}
      branding={config.branding}
      pageAccess={config.pageAccess}
      unlocked={unlocked}
      allowPrint={config.allowPrint}
    />
  );
}
