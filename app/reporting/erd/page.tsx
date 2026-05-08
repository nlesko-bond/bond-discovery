import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bond Reporting ERD',
};

export default function ReportingErdPage() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <iframe
        title="Bond Reporting ERD"
        src="/reporting/erd/index.html"
        className="h-full w-full border-0"
      />
    </main>
  );
}
