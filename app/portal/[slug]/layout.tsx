import type { Metadata } from 'next';
import { HostShellPortalBridge } from '@/components/host-shell/HostShellPortalBridge';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HostShellPortalBridge />
      {children}
    </>
  );
}
