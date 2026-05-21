'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IMultiSelectOption {
  id: string;
  label: string;
  count?: number;
}

interface IHostPortalMultiSelectDropdownProps {
  label: string;
  icon?: ReactNode;
  options: IMultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  brandColor: string;
  emptyLabel?: string;
  className?: string;
}

function formatTriggerLabel(
  label: string,
  selectedIds: string[],
  options: IMultiSelectOption[],
): string {
  if (selectedIds.length === 0) {
    return label;
  }
  if (selectedIds.length === 1) {
    const match = options.find((option) => option.id === selectedIds[0]);
    return match?.label ?? label;
  }
  return `${label} (${selectedIds.length})`;
}

export function HostPortalMultiSelectDropdown({
  label,
  icon,
  options,
  selectedIds,
  onChange,
  isOpen,
  onOpenChange,
  brandColor,
  emptyLabel = 'No options',
  className,
}: IHostPortalMultiSelectDropdownProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onOpenChange]);

  const hasSelection = selectedIds.length > 0;
  const triggerLabel = formatTriggerLabel(label, selectedIds, options);

  const toggleOption = (optionId: string) => {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onChange(next);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex min-h-[40px] w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all',
          'hover:border-gray-300 hover:shadow',
          hasSelection ? 'text-gray-900' : 'text-gray-600',
        )}
        style={
          hasSelection
            ? {
                borderColor: `${brandColor}55`,
                backgroundColor: `${brandColor}08`,
              }
            : { borderColor: '#e5e7eb' }
        }
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => onOpenChange(!isOpen)}
      >
        {icon && (
          <span className="flex shrink-0 text-gray-400" style={{ color: hasSelection ? brandColor : undefined }}>
            {icon}
          </span>
        )}
        <span className="flex-1 truncate text-left">{triggerLabel}</span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute left-0 z-50 mt-1.5 min-w-full max-w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">{emptyLabel}</p>
            ) : (
              options.map((option) => {
                const checked = selectedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                      checked ? 'bg-gray-50' : 'hover:bg-gray-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        checked ? 'border-transparent text-white' : 'border-gray-300 bg-white',
                      )}
                      style={checked ? { backgroundColor: brandColor } : undefined}
                    >
                      {checked && <Check size={12} strokeWidth={3} />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleOption(option.id)}
                    />
                    <span className="flex-1 truncate text-gray-800">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-xs tabular-nums text-gray-400">{option.count}</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          {hasSelection && (
            <div className="border-t border-gray-100 px-2 py-1.5">
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                onClick={() => onChange([])}
              >
                Clear {label.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
