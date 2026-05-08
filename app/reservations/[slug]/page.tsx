import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReservationPageConfigBySlug, getActiveReservationPageConfigs } from '@/lib/reservation-pages-config';
import { ReservationSchedulePage } from '@/components/reservations/ReservationSchedulePage';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const configs = await getActiveReservationPageConfigs();
    return configs.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = await getReservationPageConfigBySlug(slug);
  if (!config || !config.is_active) {
    return { title: 'Rental schedules' };
  }
  return {
    title: config.page_title?.trim() || config.name,
    robots: { index: false, follow: false },
  };
}

export default async function ReservationPage({ params }: PageProps) {
  const { slug } = await params;
  const config = await getReservationPageConfigBySlug(slug);
  if (!config || !config.is_active) {
    notFound();
  }
  if (!config.organization_ids.length) {
    notFound();
  }

  return <ReservationSchedulePage config={config} />;
}
