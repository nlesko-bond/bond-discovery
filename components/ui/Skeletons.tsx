import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('bg-gray-200 rounded animate-pulse', className)} />
  );
}

export function ProgramCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <Skeleton className="h-32 rounded-none" />
      
      {/* Content */}
      <div className="p-5 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16" />
        
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="space-y-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProgramGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="p-4 md:p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <ProgramCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ScheduleViewSkeleton() {
  return (
    <div className="p-4 md:p-6">
      {/* Week navigation skeleton */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="text-center space-y-2">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      
      {/* Desktop grid skeleton */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-12 rounded-t-lg" />
            <div className="min-h-[200px] p-2 border border-t-0 rounded-b-lg border-gray-200 space-y-2">
              {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, j) => (
                <Skeleton key={j} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Mobile skeleton */}
      <div className="md:hidden space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-10 rounded-t-lg" />
            <div className="border border-t-0 border-gray-200 rounded-b-lg p-3 space-y-2 bg-white">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FilterSidebarSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-14" />
      </div>
      
      {/* Search */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
      
      {/* Filter sections */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 pb-4 border-b border-gray-200">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="p-2 rounded-lg border border-gray-200 border-l-4 border-l-gray-300">
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-2" />
      <div className="flex items-center gap-2 mt-2">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-12 rounded" />
      </div>
    </div>
  );
}
