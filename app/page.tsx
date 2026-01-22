import { redirect } from 'next/navigation';

// Main page redirects to admin dashboard
export default function Home() {
  redirect('/admin');
}
