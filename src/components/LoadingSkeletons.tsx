// Loading skeleton components for better UX

export function ProgramCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      {/* Image placeholder */}
      <div className="h-48 bg-gray-200" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Badges */}
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-gray-200 rounded" />
          <div className="h-6 w-20 bg-gray-200 rounded" />
        </div>
        
        {/* Title */}
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        
        {/* Description */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
        
        {/* Price */}
        <div className="pt-3 border-t border-gray-200">
          <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
          <div className="h-7 bg-gray-200 rounded w-20" />
        </div>
        
        {/* Sessions */}
        <div className="h-4 bg-gray-200 rounded w-28" />
        
        {/* Button */}
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export function ProgramGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <ProgramCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ScheduleViewSkeleton() {
  return (
    <div className="p-4 md:p-6 animate-pulse">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-10 w-24 bg-gray-200 rounded-lg" />
        <div className="text-center">
          <div className="h-6 w-48 bg-gray-200 rounded mx-auto" />
        </div>
        <div className="h-10 w-24 bg-gray-200 rounded-lg" />
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* Day Headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`header-${i}`} className="text-center py-2 bg-gray-100 rounded-t-lg">
            <div className="h-3 w-8 bg-gray-200 rounded mx-auto mb-1" />
            <div className="h-6 w-6 bg-gray-200 rounded mx-auto" />
          </div>
        ))}
        
        {/* Day Content */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`content-${i}`} className="min-h-[120px] md:min-h-[200px] p-1 border border-gray-200 rounded-b-lg bg-white">
            <div className="space-y-1">
              {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, j) => (
                <div key={j} className="h-10 bg-gray-100 rounded" />
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
    <div className="bg-white border-r border-gray-200 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-16 bg-gray-200 rounded" />
      </div>
      
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-gray-200 pb-4">
            <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-gray-200 rounded" />
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
