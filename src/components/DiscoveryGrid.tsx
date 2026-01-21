import { Program } from '../types/bond';
import { ProgramCard } from './ProgramCard';
import { ProgramGridSkeleton } from './LoadingSkeletons';
import { ErrorDisplay } from './ErrorBoundary';
import { Search, SlidersHorizontal } from 'lucide-react';

interface DiscoveryGridProps {
  programs: Program[];
  loading: boolean;
  error: string | null;
  orgId: string;
  onRetry?: () => void;
}

export function DiscoveryGrid({
  programs,
  loading,
  error,
  orgId,
  onRetry,
}: DiscoveryGridProps) {
  if (loading) {
    return <ProgramGridSkeleton count={6} />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={onRetry} />;
  }

  if (programs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No programs found</h3>
          <p className="text-gray-600 text-sm mb-4">
            We couldn't find any programs matching your criteria. Try adjusting your filters or search terms.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <SlidersHorizontal size={16} />
            <span>Tip: Clear filters to see all programs</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-bold text-gray-900">{programs.length}</span>{' '}
            program{programs.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Future: Add sort dropdown here */}
      </div>

      {/* Program Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            orgId={orgId}
          />
        ))}
      </div>
    </div>
  );
}
