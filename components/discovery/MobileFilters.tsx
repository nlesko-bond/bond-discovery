'use client';

import { useEffect, useRef } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';
import { DiscoveryFilters, FilterType, FilterOption } from '@/types';
import { getProgramTypeLabel, getSportLabel, cn } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';

interface MobileFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: {
    facilities: { id: string; name: string; count: number }[];
    sports: FilterOption[];
    programTypes: FilterOption[];
  };
  enabledFilters: FilterType[];
  resultCount: number;
}

export function MobileFilters({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  options,
  enabledFilters,
  resultCount,
}: MobileFiltersProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClearAll = () => {
    onFiltersChange({
      search: '',
      facilityIds: [],
      programTypes: [],
      sports: [],
      dateRange: {},
      ageRange: {},
      gender: 'all',
      availability: 'all',
      membershipRequired: null,
    });
  };

  const isEnabled = (filter: FilterType) => enabledFilters.includes(filter);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 w-full h-full bg-white m-0 p-0 max-w-full max-h-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Filters</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filters Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Search */}
          {isEnabled('search') && (
            <div>
              <label className="label text-base">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search programs..."
                  value={filters.search || ''}
                  onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                  className="input pl-10 py-3 text-base"
                />
                {filters.search && (
                  <button
                    onClick={() => onFiltersChange({ ...filters, search: '' })}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Facility Filter */}
          {isEnabled('facility') && options.facilities.length > 0 && (
            <div>
              <label className="label text-base mb-3">Facility</label>
              <div className="space-y-3">
                {options.facilities.map((facility) => (
                  <label key={facility.id} className="flex items-center gap-3 cursor-pointer touch-manipulation">
                    <input
                      type="checkbox"
                      checked={filters.facilityIds?.includes(facility.id) || false}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...(filters.facilityIds || []), facility.id]
                          : (filters.facilityIds || []).filter(f => f !== facility.id);
                        onFiltersChange({ ...filters, facilityIds: updated });
                        if (e.target.checked) {
                          gtmEvent.filterApplied('facility', facility.name);
                        }
                      }}
                      className="w-5 h-5 accent-toca-purple rounded"
                    />
                    <span className="text-base text-gray-700 flex-1">{facility.name}</span>
                    <span className="text-sm text-gray-400">({facility.count})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Program Type Filter */}
          {isEnabled('programType') && options.programTypes.length > 0 && (
            <div>
              <label className="label text-base mb-3">Program Type</label>
              <div className="flex flex-wrap gap-2">
                {options.programTypes.map((type) => {
                  const isSelected = filters.programTypes?.includes(type.id as any);
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        const updated = isSelected
                          ? (filters.programTypes || []).filter(t => t !== type.id)
                          : [...(filters.programTypes || []), type.id as any];
                        onFiltersChange({ ...filters, programTypes: updated });
                        if (!isSelected) {
                          gtmEvent.filterApplied('programType', getProgramTypeLabel(type.id));
                        }
                      }}
                      className={cn(
                        'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-toca-purple text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {getProgramTypeLabel(type.id)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sport Filter */}
          {isEnabled('sport') && options.sports.length > 0 && (
            <div>
              <label className="label text-base mb-3">Activity / Sport</label>
              <div className="flex flex-wrap gap-2">
                {options.sports.map((sport) => {
                  const isSelected = filters.sports?.includes(sport.id);
                  return (
                    <button
                      key={sport.id}
                      onClick={() => {
                        const updated = isSelected
                          ? (filters.sports || []).filter(s => s !== sport.id)
                          : [...(filters.sports || []), sport.id];
                        onFiltersChange({ ...filters, sports: updated });
                        if (!isSelected) {
                          gtmEvent.filterApplied('sport', getSportLabel(sport.id));
                        }
                      }}
                      className={cn(
                        'px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize',
                        isSelected
                          ? 'bg-toca-purple text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {getSportLabel(sport.id)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Age Range */}
          {isEnabled('age') && (
            <div>
              <label className="label text-base mb-3">Age Range</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={99}
                  value={filters.ageRange?.min ?? ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    ageRange: {
                      ...filters.ageRange,
                      min: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })}
                  className="input w-24 text-center py-3"
                />
                <span className="text-gray-400 text-lg">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={99}
                  value={filters.ageRange?.max ?? ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    ageRange: {
                      ...filters.ageRange,
                      max: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })}
                  className="input w-24 text-center py-3"
                />
              </div>
            </div>
          )}

          {/* Date Range */}
          {isEnabled('dateRange') && (
            <div>
              <label className="label text-base mb-3">Date Range</label>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">From</label>
                  <input
                    type="date"
                    value={filters.dateRange?.start || ''}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      dateRange: { ...filters.dateRange, start: e.target.value },
                    })}
                    className="input py-3"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">To</label>
                  <input
                    type="date"
                    value={filters.dateRange?.end || ''}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      dateRange: { ...filters.dateRange, end: e.target.value },
                    })}
                    className="input py-3"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Availability */}
          {isEnabled('availability') && (
            <div>
              <label className="label text-base mb-3">Availability</label>
              <div className="space-y-3">
                {[
                  { id: 'all', label: 'All Programs' },
                  { id: 'available', label: 'Has Open Spots' },
                  { id: 'almost_full', label: 'Almost Full (< 5 spots)' },
                ].map((option) => (
                  <label key={option.id} className="flex items-center gap-3 cursor-pointer touch-manipulation">
                    <input
                      type="radio"
                      name="availability"
                      checked={filters.availability === option.id || (!filters.availability && option.id === 'all')}
                      onChange={() => {
                        onFiltersChange({ ...filters, availability: option.id as any });
                        if (option.id !== 'all') {
                          gtmEvent.filterApplied('availability', option.label);
                        }
                      }}
                      className="w-5 h-5 accent-toca-purple"
                    />
                    <span className="text-base text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 px-4 py-4 space-y-3">
          <button
            onClick={onClose}
            className="w-full py-4 bg-toca-purple text-white font-semibold rounded-xl hover:bg-toca-purple-dark transition-colors text-lg"
          >
            Show {resultCount} Result{resultCount !== 1 ? 's' : ''}
          </button>
          <button
            onClick={handleClearAll}
            className="w-full py-3 text-toca-purple font-medium hover:bg-gray-50 rounded-xl transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </dialog>
  );
}
