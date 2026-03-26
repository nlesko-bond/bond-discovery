import type { ReactNode } from 'react';

/** Bond onboarding checklist — warm off-white shell (does not affect rest of Discovery). */
export default function OnboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bond-bg font-sans text-bond-text antialiased">
      {children}
    </div>
  );
}
