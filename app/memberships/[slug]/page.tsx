import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMembershipConfigBySlug, getActiveMembershipConfigs } from '@/lib/membership-config';
import { getAllMemberships } from '@/lib/membership-client';
import { transformMemberships } from '@/lib/membership-transformer';
import { cacheGet, cacheSet, membershipsCacheKey, markMembershipsRefreshed } from '@/lib/cache';
import { MembershipPageData } from '@/types/membership';
import { MembershipDiscoveryPage } from '@/components/membership/MembershipDiscoveryPage';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getMembershipData(slug: string): Promise<{
  config: NonNullable<Awaited<ReturnType<typeof getMembershipConfigBySlug>>>;
  pageData: MembershipPageData;
} | null> {
  const config = await getMembershipConfigBySlug(slug);
  if (!config || !config.is_active) return null;

  const cacheKey = membershipsCacheKey(slug);
  const cached = await cacheGet<MembershipPageData>(cacheKey);

  if (cached) {
    return { config, pageData: cached };
  }

  try {
    const apiResponse = await getAllMemberships(config.organization_id);
    const pageData = transformMemberships(apiResponse.data, config);

    await cacheSet(cacheKey, pageData, { ttl: config.cache_ttl });
    await markMembershipsRefreshed(slug);

    return { config, pageData };
  } catch (error) {
    console.error(`[MembershipPage] Error fetching for ${slug}:`, error);
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const configs = await getActiveMembershipConfigs();
    return configs.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = await getMembershipConfigBySlug(slug);

  if (!config) {
    return { title: 'Membership Not Found' };
  }

  const title = config.branding.heroTitle
    ? `${config.branding.heroTitle} — Memberships`
    : config.name;

  return {
    title,
    description: config.branding.heroSubtitle || `Membership plans for ${config.organization_name || config.name}`,
  };
}

export default async function MembershipPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getMembershipData(slug);

  if (!result) {
    notFound();
  }

  return (
    <MembershipDiscoveryPage
      config={result.config}
      initialData={result.pageData}
    />
  );
}
