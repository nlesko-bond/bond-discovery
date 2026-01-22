import { AdminProviders } from '../AdminProviders';

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page has its own simple layout - no sidebar
  return (
    <AdminProviders>
      {children}
    </AdminProviders>
  );
}
