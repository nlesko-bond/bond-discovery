'use client';

import { forwardRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IHostPortalV2FilterPillProps {
  label: string;
  icon?: ReactNode;
  /** Number of active selections — rendered as an accent badge ("Age · 2"). */
  activeCount: number;
  isOpen: boolean;
  /** id of the in-flow panel this pill controls (aria-controls). */
  panelId: string;
  accentColor: string;
  onToggle: () => void;
  className?: string;
  testId?: string;
  filterId?: string;
}

/**
 * Pill trigger for one filter dimension. A real <button> with
 * aria-expanded/aria-controls pointing at the inline-expanding panel
 * (see HostPortalV2Collapse for why panels are in-flow, never floating).
 */
export const HostPortalV2FilterPill = forwardRef<
  HTMLButtonElement,
  IHostPortalV2FilterPillProps
>(function HostPortalV2FilterPill(
  {
    label,
    icon,
    activeCount,
    isOpen,
    panelId,
    accentColor,
    onToggle,
    className,
    testId = 'portal-v2-filter-pill',
    filterId,
  },
  ref,
) {
  const isActive = activeCount > 0;
  return (
    <button
      ref={ref}
      type="button"
      data-testid={testId}
      data-filter-id={filterId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 text-[13px] font-medium',
        'transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none',
        'active:scale-[0.97] motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isActive ? 'text-gray-900' : 'text-gray-600 hover:border-gray-300',
        isOpen && 'shadow-sm',
        className,
      )}
      style={{
        borderColor: isActive || isOpen ? `${accentColor}66` : '#e5e7eb',
        backgroundColor: isActive ? `${accentColor}0d` : undefined,
        ['--tw-ring-color' as string]: `${accentColor}88`,
      }}
    >
      {icon && (
        <span
          className="flex shrink-0 text-gray-400"
          style={isActive ? { color: accentColor } : undefined}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span>{label}</span>
      {isActive && (
        <span
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
          style={{ backgroundColor: accentColor }}
        >
          {activeCount}
        </span>
      )}
      <ChevronDown
        size={15}
        aria-hidden
        className={cn(
          'shrink-0 text-gray-400 transition-transform duration-150 motion-reduce:transition-none',
          isOpen && 'rotate-180',
        )}
      />
    </button>
  );
});
