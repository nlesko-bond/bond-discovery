'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 rounded',
        className
      )}
    />
  );
}

// Program Card Skeleton
export function ProgramCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Image placeholder */}
      <Skeleton className="h-40 rounded-none" />
      
      <div className="p-5 space-y-3">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Location */}
        <Skeleton className="h-4 w-1/2" />
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        
        {/* Stats row */}
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        {/* Price and button */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-7 w-16" />
          </div>
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Program Grid Skeleton
export function ProgramGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProgramCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Event Card Skeleton for List View
export function EventCardSkeleton() {
  return (
    <div className="p-4 flex items-start gap-3">
      <Skeleton className="w-1.5 h-16 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-4 pt-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

// Day Section Skeleton
export function DaySectionSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      
      {/* Events */}
      <div className="divide-y divide-gray-100">
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    </div>
  );
}

// Schedule View Skeleton
export function ScheduleViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
      
      {/* Navigation */}
      <Skeleton className="h-16 w-full rounded-xl" />
      
      {/* Content */}
      <div className="space-y-4 mt-6">
        <DaySectionSkeleton />
        <DaySectionSkeleton />
      </div>
    </div>
  );
}

export default Skeleton;
