import { Metadata } from 'next';

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Add X-Frame-Options header to allow embedding */}
      {children}
    </>
  );
}
