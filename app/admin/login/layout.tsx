export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page renders directly - parent layout handles SessionProvider
  // The AdminAuthGuard in parent layout skips auth check for /admin/login
  return <>{children}</>;
}
