import type { MembershipBranding } from '@/types/membership';

export type ReservationPageBranding = MembershipBranding;

export interface IReservationPageConfig {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  organization_ids: number[];
  branding: ReservationPageBranding;
  page_title: string | null;
  page_subtitle: string | null;
  created_at: string;
  updated_at: string;
}
