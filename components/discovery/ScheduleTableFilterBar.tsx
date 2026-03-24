'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarRange, ChevronDown, X } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import { cn } from '@/lib/utils';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

const TABLE_DOW_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

interface ScheduleTableFilterBarProps {
  config: DiscoveryConfig;
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
}

/**
 * Compact table-only controls: one “Date range” button (popover with presets + inputs) and weekday chips.
 */
export function ScheduleTableFilterBar({ config, filters, onChange }: ScheduleTableFilterBarProps) {
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const dr = filters.dateRange || {};
  const dows = filters.daysOfWeek || [];
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rangeOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (rangeWrapRef.current && !rangeWrapRef.current.contains(e.target as Node)) {
        setRangeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [rangeOpen]);

  const setDateRange = (patch: { start?: string; end?: string }) => {
    const nextRange = { ...dr, ...patch };
    const next: { start?: string; end?: string } = {};
    if (nextRange.start) next.start = nextRange.start;
    if (nextRange.end) next.end = nextRange.end;
    onChange({
      ...filters,
      dateRange: next.start || next.end ? next : {},
    });
  };

  const toggleDow = (value: number) => {
    const next = dows.includes(value)
      ? dows.filter((d) => d !== value)
      : [...dows, value].sort((a, b) => a - b);
    onChange({ ...filters, daysOfWeek: next.length ? next : undefined });
  };

  const clearAll = () => onChange({ ...filters, dateRange: {}, daysOfWeek: undefined });

  const hasActive = Boolean(dr.start || dr.end || dows.length > 0);
  const hasRange = Boolean(dr.start || dr.end);
  const today = format(new Date(), 'yyyy-MM-dd');

  const applyPresetNext7 = () => {
    onChange({
      ...filters,
      dateRange: { start: today, end: format(addDays(new Date(), 7), 'yyyy-MM-dd') },
    });
  };

  const applyPresetThisWeek = () => {
    const now = new Date();
    onChange({
      ...filters,
      dateRange: {
        start: format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      },
    });
  };

  const applyPresetThisMonth = () => {
    const now = new Date();
    onChange({
      ...filters,
      dateRange: {
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd'),
      },
    });
  };

  const chip =
    'text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 text-slate-600 shadow-sm ' +
    'transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-slate-300 hover:from-slate-50 hover:to-slate-100 hover:text-slate-800 hover:shadow ' +
    'active:scale-[0.98]';

  const dateInputClass =
    'w-full rounded-lg border border-slate-200/90 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-800 shadow-inner ' +
    'transition-[border-color,box-shadow,background-color] duration-150 ' +
    'hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/25 focus:ring-offset-0';

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200/90 bg-white/90 px-2.5 py-2 shadow-sm print:hidden">
      <div ref={rangeWrapRef} className="relative">
        <button
          type="button"
          onClick={() => setRangeOpen((o) => !o)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-[background-color,border-color,box-shadow,color] duration-150',
            hasRange
              ? 'border-transparent text-white shadow-sm'
              : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 text-slate-700 shadow-sm hover:border-slate-300 hover:from-slate-50 hover:to-slate-100 hover:text-slate-900 hover:shadow',
          )}
          style={hasRange ? { backgroundColor: secondaryColor } : undefined}
        >
          <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          Date range
          {hasRange && (
            <span className="max-w-[120px] truncate font-normal opacity-90 sm:max-w-[160px]">
              {dr.start || '…'} – {dr.end || '…'}
            </span>
          )}
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', rangeOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        {rangeOpen && (
          <div
            className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(100vw-2rem,20rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
            role="dialog"
            aria-label="Choose date range"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Quick ranges</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <button type="button" className={chip} onClick={applyPresetNext7}>
                Next 7 days
              </button>
              <button type="button" className={chip} onClick={applyPresetThisWeek}>
                This week
              </button>
              <button type="button" className={chip} onClick={applyPresetThisMonth}>
                This month
              </button>
              <button
                type="button"
                className={chip}
                onClick={() => onChange({ ...filters, daysOfWeek: [1, 2, 3, 4, 5] })}
              >
                Weekdays
              </button>
              <button
                type="button"
                className={chip}
                onClick={() => onChange({ ...filters, daysOfWeek: [0, 6] })}
              >
                Weekend
              </button>
            </div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Custom</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="sr-only" htmlFor="stf-start">
                  From date
                </label>
                <input
                  id="stf-start"
                  type="date"
                  value={dr.start || ''}
                  onChange={(e) => setDateRange({ start: e.target.value || undefined })}
                  className={dateInputClass}
                />
              </div>
              <div>
                <label className="sr-only" htmlFor="stf-end">
                  To date
                </label>
                <input
                  id="stf-end"
                  type="date"
                  value={dr.end || ''}
                  min={dr.start || undefined}
                  onChange={(e) => setDateRange({ end: e.target.value || undefined })}
                  className={dateInputClass}
                />
              </div>
            </div>
            {hasRange && (
              <button
                type="button"
                className="mt-2 w-full text-center text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => onChange({ ...filters, dateRange: {} })}
              >
                Clear date range
              </button>
            )}
          </div>
        )}
      </div>

      <span className="hidden h-4 w-px shrink-0 bg-gray-200 sm:inline" aria-hidden />

      <div className="flex flex-wrap items-center gap-1">
        {TABLE_DOW_OPTIONS.map(({ value, label }) => {
          const on = dows.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleDow(value)}
              className={cn(
                'min-w-[2.25rem] rounded-lg border px-2 py-1 text-[11px] font-bold shadow-sm transition-[background-color,border-color,box-shadow,color,transform] duration-150',
                on
                  ? 'border-transparent text-white shadow-md'
                  : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 text-slate-600 hover:border-slate-300 hover:from-slate-50 hover:to-slate-100 hover:text-slate-800 hover:shadow active:scale-[0.97]',
              )}
              style={on ? { backgroundColor: secondaryColor, borderColor: secondaryColor } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900"
        >
          <X className="h-3 w-3" aria-hidden />
          Reset all
        </button>
      )}
    </div>
  );
}
