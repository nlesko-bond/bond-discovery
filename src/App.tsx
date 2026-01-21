import { useState, useEffect, useCallback } from 'react';
import { usePrograms, useFilteredPrograms, useSchedule } from './hooks/usePrograms';
import { parseUrlParams, getOrgIds, buildUrlWithParams } from './utils/formatters';
import { DiscoveryFilters, ViewMode } from './types/bond';
import { FilterSidebar } from './components/FilterSidebar';
import { DiscoveryGrid } from './components/DiscoveryGrid';
import { ScheduleView } from './components/ScheduleView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  SlidersHorizontal, 
  LayoutGrid, 
  Calendar,
  X
} from 'lucide-react';

function App() {
  const urlParams = parseUrlParams();
  const orgIds = getOrgIds(urlParams.org_ids || '516_512_513_519_518_521_514_515_510_520_522_511');

  const [filters, setFilters] = useState<DiscoveryFilters>({
    facility_ids: urlParams.facility_ids || [],
    program_types: urlParams.program_types || [],
    sports: urlParams.sports || [],
    program_name: urlParams.program_name || '',
    start_date: urlParams.start_date || '',
    end_date: urlParams.end_date || '',
  });

  const [viewMode, setViewMode] = useState<ViewMode>(
    (urlParams.view_mode as ViewMode) || 'programs'
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const { programs, loading, error } = usePrograms(orgIds);
  const filtered = useFilteredPrograms(programs, filters);
  const { schedule } = useSchedule(programs, filters, 8);

  // Sync URL with filters and view mode
  useEffect(() => {
    const newUrl = buildUrlWithParams({
      org_ids: orgIds.join('_'),
      ...filters,
      show_filters: urlParams.show_filters,
      view_mode: viewMode,
    });
    window.history.replaceState({}, '', newUrl);
  }, [filters, orgIds, viewMode]);

  const handleFiltersChange = useCallback((newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
  }, []);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Count active filters
  const activeFilterCount = 
    (filters.facility_ids?.length || 0) +
    (filters.program_types?.length || 0) +
    (filters.sports?.length || 0) +
    (filters.program_name ? 1 : 0) +
    (filters.start_date || filters.end_date ? 1 : 0);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              {/* Logo & Title */}
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    <span className="text-bond-gold">Bond</span> Discovery
                  </h1>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    Find programs at your local sports facilities
                  </p>
                </div>
              </div>

              {/* View Toggle & Mobile Filter */}
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('programs')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'programs'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid size={16} />
                    Programs
                  </button>
                  <button
                    onClick={() => setViewMode('schedule')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'schedule'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Calendar size={16} />
                    Schedule
                  </button>
                </div>

                {/* Mobile Filter Button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="md:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors relative"
                >
                  <SlidersHorizontal size={18} />
                  <span className="hidden xs:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-bond-gold text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile View Toggle */}
            <div className="sm:hidden mt-3 flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('programs')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'programs'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                <LayoutGrid size={16} />
                Programs
              </button>
              <button
                onClick={() => setViewMode('schedule')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                <Calendar size={16} />
                Schedule
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className="flex">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block w-64 lg:w-72 flex-shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto border-r border-gray-200 bg-white">
              <FilterSidebar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                programs={programs}
                show_filters={urlParams.show_filters}
              />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0">
              {viewMode === 'programs' ? (
                <DiscoveryGrid
                  programs={filtered}
                  loading={loading}
                  error={error}
                  orgId={orgIds[0] || ''}
                  onRetry={handleRetry}
                />
              ) : (
                <ScheduleView schedule={schedule} />
              )}
            </main>
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileFilters(false)}
            />
            
            {/* Drawer */}
            <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <FilterSidebar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                programs={programs}
                show_filters={urlParams.show_filters}
              />
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="w-full py-3 bg-bond-gold text-white font-medium rounded-lg hover:bg-bond-gold-dark transition-colors"
                >
                  Show {filtered.length} Results
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-600">
                © 2025 Bond Sports. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Powered by Bond Sports API</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
