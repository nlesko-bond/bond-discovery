import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { DiscoveryFilters, Program } from '../types/bond';

interface FilterSidebarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  programs: Program[];
  show_filters?: string;
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  programs,
  show_filters = 'facility,program_type,date_range,activity',
}: FilterSidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const visibleFilters = show_filters.split(',').map(f => f.trim());

  // Extract unique values from programs
  const facilities = Array.from(
    new Set(programs.map(p => p.facility_id).filter(Boolean))
  );

  const programTypes = Array.from(
    new Set(programs.map(p => p.type).filter(Boolean))
  );

  const sports = Array.from(
    new Set(programs.map(p => p.sport).filter(Boolean))
  );

  const handleClearAll = () => {
    onFiltersChange({
      facility_ids: [],
      program_types: [],
      sports: [],
      start_date: '',
      end_date: '',
      program_name: '',
    });
  };

  const hasActiveFilters =
    (filters.facility_ids?.length || 0) > 0 ||
    (filters.program_types?.length || 0) > 0 ||
    (filters.sports?.length || 0) > 0 ||
    !!filters.program_name ||
    !!filters.start_date ||
    !!filters.end_date;

  return (
    <div className="bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-xs font-medium text-bond-gold hover:text-bond-gold-dark"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Program Name Search */}
        {visibleFilters.includes('program') && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Program Name
            </label>
            <input
              type="text"
              placeholder="Search programs..."
              value={filters.program_name || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, program_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bond-gold"
            />
          </div>
        )}

        {/* Facility Filter */}
        {visibleFilters.includes('facility') && facilities.length > 0 && (
          <FilterSection
            title="Facility"
            expanded={expanded === 'facility'}
            onToggle={() =>
              setExpanded(expanded === 'facility' ? null : 'facility')
            }
            count={filters.facility_ids?.length || 0}
          >
            <div className="space-y-2">
              {facilities.map((facility) => (
                <label key={facility} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.facility_ids?.includes(facility) || false}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...(filters.facility_ids || []), facility]
                        : (filters.facility_ids || []).filter(f => f !== facility);
                      onFiltersChange({ ...filters, facility_ids: updated });
                    }}
                    className="w-4 h-4 accent-bond-gold"
                  />
                  <span className="text-sm text-gray-700">{facility}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Program Type Filter */}
        {visibleFilters.includes('program_type') && programTypes.length > 0 && (
          <FilterSection
            title="Program Type"
            expanded={expanded === 'program_type'}
            onToggle={() =>
              setExpanded(expanded === 'program_type' ? null : 'program_type')
            }
            count={filters.program_types?.length || 0}
          >
            <div className="space-y-2">
              {programTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.program_types?.includes(type) || false}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...(filters.program_types || []), type]
                        : (filters.program_types || []).filter(t => t !== type);
                      onFiltersChange({ ...filters, program_types: updated });
                    }}
                    className="w-4 h-4 accent-bond-gold"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Sport Filter */}
        {visibleFilters.includes('activity') && sports.length > 0 && (
          <FilterSection
            title="Activity / Sport"
            expanded={expanded === 'sport'}
            onToggle={() =>
              setExpanded(expanded === 'sport' ? null : 'sport')
            }
            count={filters.sports?.length || 0}
          >
            <div className="space-y-2">
              {sports.map((sport) => (
                <label key={sport} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sports?.includes(sport) || false}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...(filters.sports || []), sport]
                        : (filters.sports || []).filter(s => s !== sport);
                      onFiltersChange({ ...filters, sports: updated });
                    }}
                    className="w-4 h-4 accent-bond-gold"
                  />
                  <span className="text-sm text-gray-700 capitalize">{sport}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Date Range Filter */}
        {visibleFilters.includes('date_range') && (
          <FilterSection
            title="Date Range"
            expanded={expanded === 'date'}
            onToggle={() =>
              setExpanded(expanded === 'date' ? null : 'date')
            }
            count={filters.start_date || filters.end_date ? 1 : 0}
          >
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-gray-700">From</label>
                <input
                  type="date"
                  value={filters.start_date || ''}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, start_date: e.target.value })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">To</label>
                <input
                  type="date"
                  value={filters.end_date || ''}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, end_date: e.target.value })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </FilterSection>
        )}
      </div>
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}

function FilterSection({
  title,
  expanded,
  onToggle,
  count,
  children,
}: FilterSectionProps) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 hover:text-bond-gold transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 bg-bond-gold text-white rounded-full">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}
