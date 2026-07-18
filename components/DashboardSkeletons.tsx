import React from 'react';
import { Skeleton } from './ui/Skeleton';

export const MisiunePrioritaraSkeleton = () => (
  <div className="space-y-6">
    <div>
      <Skeleton className="h-10 w-3/4 mb-2" />
      <div className="flex gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <Skeleton className="h-6 w-full" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-10 w-40 rounded-md" />
  </div>
);

export const EchipeTerenSkeleton = () => (
  <div className="space-y-3">
    {[1, 2].map((i) => (
      <div key={i} className="flex flex-col bg-bg-main p-2 rounded-md border border-border-color space-y-1">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);
