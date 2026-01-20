import { useState, useEffect } from 'react';
import { usePrograms, useFilteredPrograms } from './hooks/usePrograms';
import { parseUrlParams, getOrgIds, buildUrlWithParams } from './utils/formatters';
import { DiscoveryFilters } from './types/bond';
import { FilterSidebar } from './components/FilterSidebar';
import { DiscoveryGrid } from './components/DiscoveryGrid';
import { Settings } from 'lucide-react';

function App() {
  const urlParams = parseUrlParams();
  const orgIds = getOrgIds(urlParams.org_ids);

  const [filters, setFilters] = useState<DiscoveryFilters>({
    facility_ids: urlParams.facility_ids || [],
    program_types: urlParams.program_types || [],
    sports: urlParams.sports || [],
    program_name: urlParams.program_name || '',
    start_date: urlParams.start_date || '',
    end_date: urlParams.end_date || '',
  });

  const [showFilters, setShowFilters] = useState(true);

  const { programs, loading, error } = usePrograms(orgIds);
  const filtered = useFilteredPrograms(programs, filters);

  // Sync URL with filters
  useEffect(() => {
    const newUrl = buildUrlWithParams({
      org_ids: orgIds.join('_'),
      ...filters,
      show_filters: urlParams.show_filters,
      view_mode: urlParams.view_mode,
    });
    window.history.replaceState({}, '', newUrl);
  }, [filters, orgIds]);

  const handleFiltersChange = (newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              <span className="text-bond-gold">Bond</span> Discovery
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Find and explore programs at your local sports facilities
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 px-4 py-2 bg-bond-gold text-white rounded-lg font-medium hover:bg-bond-gold-dark transition-colors"
          >
            <Settings size={18} />
            Filters
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-0">
          {/* Sidebar - Hidden on mobile unless showFilters is true */}
          <div
            className={`${
              showFilters ? 'block' : 'hidden'
            } md:block md:w-64 lg:w-72 border-r border-gray-200`}
          >
            <FilterSidebar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              programs={programs}
              show_filters={urlParams.show_filters}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <DiscoveryGrid
              programs={filtered}
              loading={loading}
              error={error}
              orgId={orgIds[0] || ''}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center text-sm text-gray-600">
          <p>© 2025 Bond Sports. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
