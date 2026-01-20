import { Program } from '../types/bond';
import { ProgramCard } from './ProgramCard';
import { Loader, AlertCircle } from 'lucide-react';

interface DiscoveryGridProps {
  programs: Program[];
  loading: boolean;
  error: string | null;
  orgId: string;
}

export function DiscoveryGrid({
  programs,
  loading,
  error,
  orgId,
}: DiscoveryGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 text-bond-gold animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading programs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600 text-lg">No programs found</p>
          <p className="text-gray-500 text-sm mt-1">
            Try adjusting your filters
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-gray-600 text-sm">
          Showing <span className="font-semibold text-gray-900">{programs.length}</span> program{programs.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
