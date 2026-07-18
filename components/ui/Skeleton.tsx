import React from 'react';

export const Skeleton = ({ className }: { className?: string }) => {
  return (
    <div className={`animate-pulse bg-border-color/50 rounded-md ${className}`} />
  );
};

const CardSkeleton = () => (
  <div className="p-4 rounded-lg bg-bg-card border border-border-color space-y-3">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

const TableRowSkeleton = () => (
  <div className="flex items-center space-x-4 py-3 border-b border-border-color">
    <Skeleton className="h-4 w-1/4" />
    <Skeleton className="h-4 w-1/4" />
    <Skeleton className="h-4 w-1/4" />
    <Skeleton className="h-4 w-1/4" />
  </div>
);

export const PageSkeleton = () => (
  <div className="p-6 space-y-6">
    <Skeleton className="h-8 w-1/4 mb-6" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <div className="mt-8 space-y-4">
      <TableRowSkeleton />
      <TableRowSkeleton />
      <TableRowSkeleton />
      <TableRowSkeleton />
      <TableRowSkeleton />
    </div>
  </div>
);
