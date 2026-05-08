import { redirect } from 'next/navigation';

export default function LegacyRentalSchedulesRedirect() {
  redirect('/admin/reservation-pages');
}
