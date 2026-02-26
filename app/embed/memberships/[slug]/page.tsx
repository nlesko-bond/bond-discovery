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

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

export async function generateStaticParams() {
  try {
    const configs = await getActiveMembershipConfigs();
    return configs.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export default async function EmbedMembershipPage({ params }: PageProps) {
  const { slug } = await params;
  const config = await getMembershipConfigBySlug(slug);

  if (!config || !config.is_active) {
    notFound();
  }

  const cacheKey = membershipsCacheKey(slug);
  let pageData = await cacheGet<MembershipPageData>(cacheKey);

  if (!pageData) {
    try {
      const apiResponse = await getAllMemberships(config.organization_id);
      pageData = transformMemberships(apiResponse.data, config);
      await cacheSet(cacheKey, pageData, { ttl: config.cache_ttl });
      await markMembershipsRefreshed(slug);
    } catch (error) {
      console.error(`[EmbedMembership] Error for ${slug}:`, error);
      notFound();
    }
  }

  return <MembershipDiscoveryPage config={config} initialData={pageData} />;
}
