'use client';

import { MembershipPageData } from '@/types/membership';

interface Props {
  data: MembershipPageData;
}

export function MembershipInfoStrip({ data }: Props) {
  const cells: { label: string; value: string }[] = [];

  if (data.seasonDateRange) {
    cells.push({
      value: `${formatShortDate(data.seasonDateRange.start)} – ${formatShortDate(data.seasonDateRange.end)}`,
      label: 'Season Dates',
    });
  }

  if (data.registrationDeadline) {
    const deadline = new Date(data.registrationDeadline);
    const now = new Date();
    cells.push({
      value: `Register by ${formatShortDate(data.registrationDeadline)}`,
      label: now <= deadline ? 'Open Now' : 'Registration Closed',
    });
  }

  if (data.ageRange) {
    cells.push({
      value: `Ages ${data.ageRange.min} – ${data.ageRange.max}`,
      label: data.ageRange.max >= 100 ? 'All Ages Welcome' : `Ages ${data.ageRange.min}+`,
    });
  }

  if (data.isTaxInclusive) {
    cells.push({
      value: 'Tax Inclusive',
      label: 'No Hidden Fees',
    });
  }

  if (cells.length === 0) return null;

  return (
    <div
      className="grid gap-px rounded-lg overflow-hidden mb-12 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))`,
        background: '#E5E5E3',
      }}
    >
      {cells.map((cell, i) => (
        <div key={i} className="bg-white py-6 px-5 text-center">
          <strong className="block text-[19px] font-extrabold mb-0.5" style={{ color: 'var(--m-black)' }}>
            {cell.value}
          </strong>
          <span className="text-sm text-gray-500 font-medium">{cell.label}</span>
        </div>
      ))}
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
