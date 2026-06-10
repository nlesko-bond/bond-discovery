'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IV2FilterOption {
  id: string;
  label: string;
  /** Live result count if this option were selected (omit to hide counts). */
  count?: number;
}

interface IHostPortalV2OptionListProps {
  label: string;
  options: IV2FilterOption[];
  selectedIds: string[];
  onToggleOption: (id: string) => void;
  onClear: () => void;
  accentColor: string;
  /** 'rows' = desktop panel rows; 'chips' = mobile tappable chips. */
  variant?: 'rows' | 'chips';
  className?: string;
}

/**
 * Multi-select option list rendered inside an inline-expanding panel.
 * Instant apply: toggling an option updates results immediately (no Apply
 * button). role="listbox"/role="option" with aria-selected; options are real
 * <button>s so Tab/Enter/Space work natively; Escape is handled by the panel.
 */
export function HostPortalV2OptionList({
  label,
  options,
  selectedIds,
  onToggleOption,
  onClear,
  accentColor,
  variant = 'rows',
  className,
}: IHostPortalV2OptionListProps) {
  const hasSelection = selectedIds.length > 0;

  return (
    <div className={className}>
      <div
        role="listbox"
        aria-multiselectable="true"
        aria-label={label}
        className={cn(variant === 'chips' ? 'flex flex-wrap gap-2' : 'flex flex-col')}
      >
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          const dimmed = option.count === 0 && !selected;
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={selected}
              data-testid="portal-v2-option"
              data-option-id={option.id}
              onClick={() => onToggleOption(option.id)}
              className={cn(
                'transition-colors duration-150 ease-out motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                variant === 'chips'
                  ? cn(
                      'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border bg-white px-3.5 text-[13px] font-medium',
                      'active:scale-[0.97] motion-reduce:active:scale-100',
                      selected ? 'text-white' : 'text-gray-700',
                      dimmed && 'opacity-50',
                    )
                  : cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm',
                      selected ? 'bg-gray-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50',
                      dimmed && 'opacity-50',
                    ),
              )}
              style={{
                ['--tw-ring-color' as string]: `${accentColor}88`,
                ...(variant === 'chips'
                  ? selected
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : { borderColor: '#e5e7eb' }
                  : undefined),
              }}
            >
              {variant === 'rows' && (
                <span
                  aria-hidden
                  className={cn(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors duration-150 motion-reduce:transition-none',
                    selected ? 'border-transparent text-white' : 'border-gray-300 bg-white',
                  )}
                  style={selected ? { backgroundColor: accentColor } : undefined}
                >
                  {selected && <Check size={12} strokeWidth={3} />}
                </span>
              )}
              <span className={cn(variant === 'rows' && 'flex-1 truncate')}>
                {option.label}
              </span>
              {variant === 'chips' && selected && (
                <Check size={13} strokeWidth={3} aria-hidden />
              )}
              {option.count !== undefined && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    variant === 'chips'
                      ? selected
                        ? 'text-white/80'
                        : 'text-gray-400'
                      : 'text-gray-400',
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {hasSelection && (
        <button
          type="button"
          data-testid="portal-v2-option-clear"
          onClick={onClear}
          className="mt-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ ['--tw-ring-color' as string]: `${accentColor}88` }}
        >
          Clear {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
