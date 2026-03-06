'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ChevronDown, 
  X, 
  MapPin, 
  Layers, 
  Activity, 
  Users, 
  Calendar,
  Filter,
  Check,
  Tag,
  Search,
  Tent,
  BookOpen,
  Trophy,
  Swords,
  UsersRound,
  DoorOpen,
  Key,
  type LucideIcon,
} from 'lucide-react';
import {
  MdSportsSoccer,
  MdSportsFootball,
  MdSportsBasketball,
  MdSportsVolleyball,
  MdSportsTennis,
  MdSportsBaseball,
  MdSportsHockey,
  MdSportsGolf,
  MdSportsGymnastics,
  MdSportsMartialArts,
  MdSportsKabaddi,
  MdSportsCricket,
  MdSportsHandball,
  MdSportsRugby,
  MdSportsMma,
  MdPool,
  MdIceSkating,
  MdSelfImprovement,
  MdDirectionsRun,
  MdCake,
  MdNightlife,
  MdDownhillSkiing,
  MdSurfing,
  MdKayaking,
  MdHiking,
  MdRowing,
  MdSkateboarding,
} from 'react-icons/md';
import { IconType } from 'react-icons';
import { DiscoveryFilters, DiscoveryConfig } from '@/types';
import { cn, getProgramTypeLabel, getSportLabel } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';

const PROGRAM_TYPE_ICONS: Record<string, LucideIcon> = {
  class: Users,
  clinic: Activity,
  camp: Tent,
  lesson: BookOpen,
  league: Trophy,
  tournament: Swords,
  club_team: UsersRound,
  drop_in: DoorOpen,
  rental: Key,
};

const SPORT_ICONS: Record<string, IconType> = {
  soccer: MdSportsSoccer,
  football: MdSportsFootball,
  basketball: MdSportsBasketball,
  volleyball: MdSportsVolleyball,
  tennis: MdSportsTennis,
  baseball: MdSportsBaseball,
  softball: MdSportsBaseball,
  hockey: MdSportsHockey,
  ice_hockey: MdSportsHockey,
  lacrosse: MdSportsHockey,
  swimming: MdPool,
  pool: MdPool,
  yoga: MdSelfImprovement,
  fitness: MdSportsGymnastics,
  running: MdDirectionsRun,
  track: MdDirectionsRun,
  cycling: MdDirectionsRun,
  golf: MdSportsGolf,
  wrestling: MdSportsKabaddi,
  gymnastics: MdSportsGymnastics,
  skating: MdIceSkating,
  ice_skating: MdIceSkating,
  figure_skating: MdIceSkating,
  roller_skating: MdSkateboarding,
  dance: MdNightlife,
  martial_arts: MdSportsMartialArts,
  karate: MdSportsMartialArts,
  taekwondo: MdSportsMartialArts,
  judo: MdSportsMartialArts,
  mma: MdSportsMma,
  boxing: MdSportsMma,
  cheer: MdSportsGymnastics,
  cheerleading: MdSportsGymnastics,
  birthday: MdCake,
  party: MdCake,
  cricket: MdSportsCricket,
  handball: MdSportsHandball,
  rugby: MdSportsRugby,
  skiing: MdDownhillSkiing,
  snowboarding: MdDownhillSkiing,
  surfing: MdSurfing,
  kayaking: MdKayaking,
  rowing: MdRowing,
  hiking: MdHiking,
};

function getSportIcon(sportId: string): IconType {
  const key = sportId.toLowerCase().replace(/[\s-]+/g, '_');
  if (SPORT_ICONS[key]) return SPORT_ICONS[key];
  const match = Object.keys(SPORT_ICONS).find(k => key.includes(k) || k.includes(key));
  return match ? SPORT_ICONS[match] : MdSportsSoccer;
}

function getProgramTypeIcon(typeId: string): LucideIcon {
  return PROGRAM_TYPE_ICONS[typeId] || Layers;
}

interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

interface SessionOption {
  id: string;
  name: string;
  programId: string;
}

interface ProgramFilterOption extends FilterOption {
  facilityId?: string;
  facilityName?: string;
}

interface FilterOptions {
  facilities: FilterOption[];
  programTypes: FilterOption[];
  sports: FilterOption[];
  programs: ProgramFilterOption[];
  sessions?: SessionOption[]; // Sessions, filtered by selected programs
  ages: { min: number; max: number }[];
  hasMultipleFacilities?: boolean;
}

interface HorizontalFilterBarProps {
  filters: DiscoveryFilters;
  onFilterChange: (filters: DiscoveryFilters) => void;
  filterOptions: FilterOptions;
  config: DiscoveryConfig;
  isScheduleView?: boolean; // When true, hides age filter (not applicable to events)
  hideMobileFilterGroups?: Array<'programType' | 'gender'>;
  hideMobileActiveChipsFor?: Array<'programType' | 'gender'>;
}

export function HorizontalFilterBar({
  filters,
  onFilterChange,
  filterOptions,
  config,
  isScheduleView = false,
  hideMobileFilterGroups = [],
  hideMobileActiveChipsFor = [],
}: HorizontalFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const hideProgramTypeDropdownOnMobile = hideMobileFilterGroups.includes('programType');
  const hideGenderDropdownOnMobile = hideMobileFilterGroups.includes('gender');
  const hideProgramTypeActiveChipOnMobile = hideMobileActiveChipsFor.includes('programType');
  const hideGenderActiveChipOnMobile = hideMobileActiveChipsFor.includes('gender');
  
  // Dynamic colors from config
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
  // Use ref to avoid stale closure in debounce effect
  const filtersRef = useRef(filters);
  const onFilterChangeRef = useRef(onFilterChange);
  
  useEffect(() => {
    filtersRef.current = filters;
    onFilterChangeRef.current = onFilterChange;
  }, [filters, onFilterChange]);
  
  // Debounce search to filter results as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filtersRef.current.search) {
        onFilterChangeRef.current({ ...filtersRef.current, search: searchQuery });
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Sync local state if filters.search changes externally (e.g., from URL)
  useEffect(() => {
    if (filters.search !== undefined && filters.search !== searchQuery) {
      setSearchQuery(filters.search);
    }
  }, [filters.search]);
  
  // Get enabled filters from config
  // Exclude 'age' filter on schedule view since age data isn't on events
  const configFilters = config.features.enableFilters || ['search', 'facility', 'programType', 'sport', 'age', 'dateRange', 'program'];
  const enabledFilters = isScheduleView 
    ? configFilters.filter(f => f !== 'age')
    : configFilters;
  
  // Search suggestions based on query
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions: { type: 'program' | 'facility' | 'sport'; id: string; name: string }[] = [];
    
    // Match programs
    filterOptions.programs.forEach(p => {
      if (p.name.toLowerCase().includes(query)) {
        suggestions.push({ type: 'program', id: p.id, name: p.name });
      }
    });
    
    // Match facilities
    filterOptions.facilities.forEach(f => {
      if (f.name.toLowerCase().includes(query)) {
        suggestions.push({ type: 'facility', id: f.id, name: f.name });
      }
    });
    
    // Match sports
    filterOptions.sports.forEach(s => {
      if (s.name.toLowerCase().includes(query)) {
        suggestions.push({ type: 'sport', id: s.id, name: s.name });
      }
    });
    
    return suggestions.slice(0, 8); // Limit to 8 suggestions
  }, [searchQuery, filterOptions]);

  // Count active filters (exclude age on schedule view since it doesn't apply to events)
  const activeFilterCount = [
    filters.facilityIds?.length || 0,
    filters.programIds?.length || 0,
    filters.programTypes?.length || 0,
    filters.sports?.length || 0,
    (!isScheduleView && (filters.ageRange?.min || filters.ageRange?.max)) ? 1 : 0,
    (filters.gender && filters.gender !== 'all') ? 1 : 0,
    filters.dateRange?.start || filters.dateRange?.end ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle selecting a search suggestion
  const handleSearchSuggestionClick = (suggestion: { type: 'program' | 'facility' | 'sport'; id: string; name: string }) => {
    if (suggestion.type === 'program') {
      handleMultiSelect('programIds', suggestion.id);
    } else if (suggestion.type === 'facility') {
      handleMultiSelect('facilityIds', suggestion.id);
    } else if (suggestion.type === 'sport') {
      handleMultiSelect('sports', suggestion.id);
    }
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleMultiSelect = (
    key: 'facilityIds' | 'programIds' | 'programTypes' | 'sports' | 'sessionIds',
    value: string
  ) => {
    const current = (filters[key] || []) as string[];
    const isAdding = !current.includes(value);
    const newValues = isAdding
      ? [...current, value]
      : current.filter(v => v !== value);
    
    // Track filter applied events when adding a filter
    if (isAdding) {
      let filterType: string = key;
      let filterValue: string = value;
      
      if (key === 'facilityIds') {
        const facility = filterOptions.facilities.find(f => f.id === value);
        filterType = 'facility';
        filterValue = facility?.name || value;
      } else if (key === 'programIds') {
        const program = filterOptions.programs.find(p => p.id === value);
        filterType = 'program';
        filterValue = program?.name || value;
      } else if (key === 'programTypes') {
        filterType = 'programType';
        filterValue = getProgramTypeLabel(value as any);
      } else if (key === 'sports') {
        filterType = 'sport';
        filterValue = getSportLabel(value);
      } else if (key === 'sessionIds') {
        const session = filterOptions.sessions?.find(s => s.id === value);
        filterType = 'session';
        filterValue = session?.name || value;
      }
      
      gtmEvent.filterApplied(filterType, filterValue);
    }
    
    // If clearing program selection, also clear session selection
    const extraUpdates: Partial<DiscoveryFilters> = {};
    if (key === 'programIds' && newValues.length === 0) {
      extraUpdates.sessionIds = undefined;
    }
    
    onFilterChange({
      ...filters,
      ...extraUpdates,
      [key]: newValues.length > 0 ? newValues : undefined,
    } as DiscoveryFilters);
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    if (key === 'facilityIds') newFilters.facilityIds = undefined;
    if (key === 'programIds') {
      newFilters.programIds = undefined;
      newFilters.sessionIds = undefined; // Clear sessions when clearing programs
    }
    if (key === 'sessionIds') newFilters.sessionIds = undefined;
    if (key === 'programTypes') newFilters.programTypes = undefined;
    if (key === 'sports') newFilters.sports = undefined;
    if (key === 'age') {
      newFilters.ageRange = undefined;
    }
    if (key === 'gender') {
      newFilters.gender = undefined;
    }
    if (key === 'date') {
      newFilters.dateRange = undefined;
    }
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange({
      search: filters.search,
    });
  };

  return (
    <div ref={dropdownRef} className="space-y-3">
      {/* Filter Buttons Row - with CSS variables for colors */}
      <div 
        className="flex flex-wrap items-center gap-2"
        style={{ 
          '--brand-primary': primaryColor,
          '--brand-secondary': secondaryColor,
        } as React.CSSProperties}
      >
        {/* Search Input with Autocomplete */}
        {enabledFilters.includes('search') && config.features.showSearch !== false && (
          <div ref={searchRef} className="relative">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full hover:border-gray-300 transition-colors">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Immediately apply search on Enter
                    onFilterChange({ ...filters, search: searchQuery });
                    setShowSearchResults(false);
                  }
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search events..."
                className="w-32 sm:w-48 text-sm bg-transparent border-none outline-none placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    onFilterChange({ ...filters, search: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            {/* Search Suggestions Dropdown */}
            {showSearchResults && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-64 overflow-y-auto">
                <div className="p-1">
                  {searchSuggestions.map((suggestion, idx) => (
                    <button
                      key={`${suggestion.type}-${suggestion.id}-${idx}`}
                      onClick={() => handleSearchSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      {suggestion.type === 'program' && <Tag size={12} style={{ color: secondaryColor }} />}
                      {suggestion.type === 'facility' && <MapPin size={12} style={{ color: secondaryColor }} />}
                      {suggestion.type === 'sport' && <Activity size={12} style={{ color: secondaryColor }} />}
                      <span className="truncate">{suggestion.name}</span>
                      <span className="text-xs text-gray-400 capitalize ml-auto">{suggestion.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Facility Filter - only show if enabled */}
        {enabledFilters.includes('facility') && filterOptions.facilities.length > 0 && (
          <FilterDropdown
            label="Location"
            icon={<MapPin size={14} />}
            isOpen={openDropdown === 'facility'}
            onToggle={() => setOpenDropdown(openDropdown === 'facility' ? null : 'facility')}
            hasSelection={(filters.facilityIds?.length || 0) > 0}
            selectionCount={filters.facilityIds?.length}
            brandColor={secondaryColor}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {filterOptions.facilities.map(facility => {
                const isSelected = filters.facilityIds?.includes(facility.id);
                return (
                  <button
                    key={facility.id}
                    onClick={() => handleMultiSelect('facilityIds', facility.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
                      !isSelected && 'hover:bg-gray-50'
                    )}
                    style={isSelected ? { backgroundColor: `${secondaryColor}15`, color: secondaryColor } : undefined}
                  >
                    <span className="truncate">{facility.name}</span>
                    <div className="flex items-center gap-2">
                      {facility.count !== undefined && (
                        <span className="text-xs text-gray-400">{facility.count}</span>
                      )}
                      {isSelected && (
                        <Check size={14} style={{ color: secondaryColor }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

        {/* Program Filter - only show if enabled */}
        {enabledFilters.includes('program') && filterOptions.programs.length > 0 && (
          <FilterDropdown
            label="Program"
            icon={<Tag size={14} />}
            isOpen={openDropdown === 'program'}
            onToggle={() => setOpenDropdown(openDropdown === 'program' ? null : 'program')}
            hasSelection={(filters.programIds?.length || 0) > 0}
            selectionCount={filters.programIds?.length}
            brandColor={secondaryColor}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {filterOptions.programs
                // Filter by selected facility if any
                .filter(program => {
                  if (!filters.facilityIds?.length) return true;
                  return program.facilityId && filters.facilityIds.includes(program.facilityId);
                })
                .map(program => {
                const isSelected = filters.programIds?.includes(program.id);
                return (
                  <button
                    key={program.id}
                    onClick={() => handleMultiSelect('programIds', program.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      !isSelected && 'hover:bg-gray-50'
                    )}
                    style={isSelected ? { backgroundColor: `${secondaryColor}15`, color: secondaryColor } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1" suppressHydrationWarning>
                        <span className="block truncate">{program.name}</span>
                        {/* Show facility name when multiple facilities exist */}
                        {filterOptions.hasMultipleFacilities && program.facilityName && (
                          <span className="block text-xs text-gray-400 truncate">{program.facilityName}</span>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={14} className="flex-shrink-0" style={{ color: secondaryColor }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

        {/* Session Filter - only show when a program is selected */}
        {filters.programIds && filters.programIds.length > 0 && filterOptions.sessions && filterOptions.sessions.length > 0 && (
          <FilterDropdown
            label="Session"
            icon={<Calendar size={14} />}
            isOpen={openDropdown === 'session'}
            onToggle={() => setOpenDropdown(openDropdown === 'session' ? null : 'session')}
            hasSelection={(filters.sessionIds?.length || 0) > 0}
            selectionCount={filters.sessionIds?.length}
            brandColor={secondaryColor}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {filterOptions.sessions
                .filter(session => filters.programIds?.includes(session.programId))
                .map(session => {
                  const isSelected = filters.sessionIds?.includes(session.id);
                  return (
                    <button
                      key={session.id}
                      onClick={() => handleMultiSelect('sessionIds', session.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
                        !isSelected && 'hover:bg-gray-50'
                      )}
                      style={isSelected ? { backgroundColor: `${secondaryColor}15`, color: secondaryColor } : undefined}
                    >
                      <span className="truncate">{session.name}</span>
                      {isSelected && (
                        <Check size={14} style={{ color: secondaryColor }} />
                      )}
                    </button>
                  );
                })}
            </div>
          </FilterDropdown>
        )}

        {/* Program Type Filter - chip toggle */}
        {enabledFilters.includes('programType') && filterOptions.programTypes.length > 0 && (
          <div className={cn(hideProgramTypeDropdownOnMobile && 'hidden sm:block')}>
            <ChipToggleButton
              label="Type"
              icon={<Layers size={14} />}
              isOpen={openDropdown === 'type'}
              onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
              hasSelection={(filters.programTypes?.length || 0) > 0}
              brandColor={secondaryColor}
            />
          </div>
        )}

        {/* Sport Filter - chip toggle */}
        {enabledFilters.includes('sport') && filterOptions.sports.length > 0 && (
          <ChipToggleButton
            label="Activity"
            icon={<Activity size={14} />}
            isOpen={openDropdown === 'sport'}
            onToggle={() => setOpenDropdown(openDropdown === 'sport' ? null : 'sport')}
            hasSelection={(filters.sports?.length || 0) > 0}
            brandColor={secondaryColor}
          />
        )}

        {/* Age Filter - only show if enabled */}
        {enabledFilters.includes('age') && (
          <FilterDropdown
            label="Age"
            icon={<Users size={14} />}
            isOpen={openDropdown === 'age'}
            onToggle={() => setOpenDropdown(openDropdown === 'age' ? null : 'age')}
            hasSelection={!!(filters.ageRange?.min || filters.ageRange?.max)}
            brandColor={secondaryColor}
          >
            <div className="p-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Min Age</label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={filters.ageRange?.min || ''}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    ageRange: {
                      ...filters.ageRange,
                      min: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })}
                  placeholder="Any"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': secondaryColor } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Max Age</label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={filters.ageRange?.max || ''}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    ageRange: {
                      ...filters.ageRange,
                      max: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })}
                  placeholder="Any"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': secondaryColor } as React.CSSProperties}
                />
              </div>
            </div>
          </FilterDropdown>
        )}

        {/* Gender Filter - chip toggle */}
        {enabledFilters.includes('gender') && (
          <div className={cn(hideGenderDropdownOnMobile && 'hidden sm:block')}>
            <ChipToggleButton
              label="Gender"
              icon={<Users size={14} />}
              isOpen={openDropdown === 'gender'}
              onToggle={() => setOpenDropdown(openDropdown === 'gender' ? null : 'gender')}
              hasSelection={!!(filters.gender && filters.gender !== 'all')}
              brandColor={secondaryColor}
            />
          </div>
        )}

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={14} />
            Clear all
          </button>
        )}
      </div>

      {/* Chip Panels - expand below filter bar when toggled */}
      {openDropdown === 'type' && enabledFilters.includes('programType') && filterOptions.programTypes.length > 0 && (
        <ChipPanel label="Type" brandColor={secondaryColor}>
          {filterOptions.programTypes.map(type => {
            const isSelected = (filters.programTypes as string[] | undefined)?.includes(type.id);
            const TypeIcon = getProgramTypeIcon(type.id);
            return (
              <ChipOption
                key={type.id}
                label={getProgramTypeLabel(type.id as any)}
                icon={<TypeIcon size={14} />}
                isSelected={isSelected}
                onClick={() => handleMultiSelect('programTypes', type.id)}
                brandColor={secondaryColor}
              />
            );
          })}
        </ChipPanel>
      )}

      {openDropdown === 'sport' && enabledFilters.includes('sport') && filterOptions.sports.length > 0 && (
        <ChipPanel label="Activity" brandColor={secondaryColor}>
          {filterOptions.sports.map(sport => {
            const isSelected = filters.sports?.includes(sport.id);
            const SportIcon = getSportIcon(sport.id);
            return (
              <ChipOption
                key={sport.id}
                label={getSportLabel(sport.id)}
                icon={<SportIcon size={14} />}
                isSelected={isSelected}
                onClick={() => handleMultiSelect('sports', sport.id)}
                brandColor={secondaryColor}
              />
            );
          })}
        </ChipPanel>
      )}

      {openDropdown === 'gender' && enabledFilters.includes('gender') && (
        <ChipPanel label="Gender" brandColor={secondaryColor}>
          {[
            { value: 'coed', label: 'Co-Ed', icon: UsersRound },
            { value: 'male', label: 'Boys', icon: Users },
            { value: 'female', label: 'Girls', icon: Users },
          ].map(option => {
            const isSelected = filters.gender === option.value;
            return (
              <ChipOption
                key={option.value}
                label={option.label}
                icon={<option.icon size={14} />}
                isSelected={isSelected}
                onClick={() => {
                  onFilterChange({
                    ...filters,
                    gender: isSelected ? undefined : option.value as any,
                  });
                  if (!isSelected) {
                    gtmEvent.filterApplied('gender', option.label);
                  }
                }}
                brandColor={secondaryColor}
              />
            );
          })}
        </ChipPanel>
      )}

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Facility Chips */}
          {filters.facilityIds?.map(id => {
            const facility = filterOptions.facilities.find(f => f.id === id);
            return facility ? (
              <FilterChip
                key={`facility-${id}`}
                label={facility.name}
                onRemove={() => handleMultiSelect('facilityIds', id)}
                brandColor={secondaryColor}
              />
            ) : null;
          })}

          {/* Program Chips */}
          {filters.programIds?.map(id => {
            const program = filterOptions.programs.find(p => p.id === id);
            return program ? (
              <FilterChip
                key={`program-${id}`}
                label={program.name}
                onRemove={() => handleMultiSelect('programIds', id)}
                brandColor={secondaryColor}
              />
            ) : null;
          })}

          {/* Type Chips */}
          {filters.programTypes?.map(type => (
            <span
              key={`type-${type}`}
              className={cn(hideProgramTypeActiveChipOnMobile && 'hidden sm:inline-flex')}
            >
              <FilterChip
                label={getProgramTypeLabel(type as any)}
                onRemove={() => handleMultiSelect('programTypes', type)}
                brandColor={secondaryColor}
              />
            </span>
          ))}

          {/* Sport Chips */}
          {filters.sports?.map(sport => (
            <FilterChip
              key={`sport-${sport}`}
              label={getSportLabel(sport)}
              onRemove={() => handleMultiSelect('sports', sport)}
              brandColor={secondaryColor}
            />
          ))}

          {/* Age Chip - hide on schedule view since age doesn't apply to events */}
          {!isScheduleView && (filters.ageRange?.min || filters.ageRange?.max) && (
            <FilterChip
              label={`Ages ${filters.ageRange?.min || 0}-${filters.ageRange?.max || '∞'}`}
              onRemove={() => clearFilter('age')}
              brandColor={secondaryColor}
            />
          )}

          {/* Gender Chip */}
          {filters.gender && filters.gender !== 'all' && (
            <span className={cn(hideGenderActiveChipOnMobile && 'hidden sm:inline-flex')}>
              <FilterChip
                label={filters.gender === 'coed' ? 'Co-ed' : filters.gender === 'male' ? 'Male' : 'Female'}
                onRemove={() => clearFilter('gender')}
                brandColor={secondaryColor}
              />
            </span>
          )}

          {/* Date Chip */}
          {(filters.dateRange?.start || filters.dateRange?.end) && (
            <FilterChip
              label="Date Range"
              onRemove={() => clearFilter('date')}
              brandColor={secondaryColor}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Filter Dropdown Component
function FilterDropdown({
  label,
  icon,
  isOpen,
  onToggle,
  hasSelection,
  selectionCount,
  children,
  brandColor = '#6366F1',
}: {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  hasSelection?: boolean;
  selectionCount?: number;
  children: React.ReactNode;
  brandColor?: string;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-all',
          !hasSelection && !isOpen && 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
        )}
        style={(hasSelection || isOpen) ? { 
          backgroundColor: isOpen ? 'white' : `${brandColor}10`, 
          borderColor: brandColor, 
          color: brandColor 
        } : undefined}
      >
        {icon}
        <span>{label}</span>
        {selectionCount != null && selectionCount > 0 && (
          <span 
            className="text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
            style={{ backgroundColor: brandColor }}
          >
            {selectionCount}
          </span>
        )}
        <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="fixed sm:absolute top-auto sm:top-full left-0 right-0 sm:right-auto sm:left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 min-w-[200px] z-[100] animate-fade-in max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// Toggle button for chip panel filters (Type, Activity, Gender)
function ChipToggleButton({
  label,
  icon,
  isOpen,
  onToggle,
  hasSelection,
  brandColor = '#6366F1',
}: {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  hasSelection?: boolean;
  brandColor?: string;
}) {
  const isActive = isOpen || hasSelection;
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-all',
        !isActive && 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
      )}
      style={isActive ? {
        backgroundColor: isOpen ? 'white' : `${brandColor}10`,
        borderColor: brandColor,
        color: brandColor,
      } : undefined}
    >
      {icon}
      <span>{label}</span>
      <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
    </button>
  );
}

// Chip panel that expands below the filter bar
function ChipPanel({
  label,
  children,
  brandColor = '#6366F1',
}: {
  label: string;
  children: React.ReactNode;
  brandColor?: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 animate-fade-in"
      style={{ borderColor: `${brandColor}20` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">
        {label}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {children}
      </div>
    </div>
  );
}

// Individual chip option inside a ChipPanel
function ChipOption({
  label,
  icon,
  isSelected,
  onClick,
  brandColor = '#6366F1',
}: {
  label: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  onClick: () => void;
  brandColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition-all',
        !isSelected && 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
      )}
      style={isSelected ? {
        backgroundColor: `${brandColor}12`,
        borderColor: brandColor,
        color: brandColor,
      } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

// Filter Chip Component
function FilterChip({ label, onRemove, brandColor = '#6366F1' }: { label: string; onRemove: () => void; brandColor?: string }) {
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full"
      style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
    >
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 transition-colors hover:opacity-70"
      >
        <X size={12} />
      </button>
    </span>
  );
}

export default HorizontalFilterBar;
