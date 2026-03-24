import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Form responses',
  robots: { index: false, follow: false },
};

export default function FormResponsesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
