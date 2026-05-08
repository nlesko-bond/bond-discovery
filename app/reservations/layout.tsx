import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rental schedules',
  robots: { index: false, follow: false },
};

export default function ReservationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
