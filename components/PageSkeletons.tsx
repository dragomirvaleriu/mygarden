import React from 'react';
import { Skeleton } from './ui/Skeleton';

export const ClientsPageSkeleton = () => (
  <div className="p-6 space-y-6">
    <div className="flex justify-between items-center">
      <Skeleton className="h-10 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="p-4 rounded-lg bg-bg-card border border-border-color space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  </div>
);

export const SchedulePageSkeleton = () => (
  <div className="p-6 space-y-6">
    <Skeleton className="h-10 w-1/4" />
    <div className="grid grid-cols-7 gap-2">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  </div>
);
