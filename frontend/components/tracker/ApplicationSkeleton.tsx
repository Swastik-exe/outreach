export function ApplicationSkeleton() {
  return (
    <div
      className="bg-surface rounded-xl border border-border p-4 sm:p-5 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface2 rounded w-2/5" />
          <div className="h-3 bg-surface2 rounded w-1/3" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 bg-surface2 rounded-full" />
          <div className="h-3 w-16 bg-surface2 rounded" />
        </div>
      </div>
    </div>
  );
}

export function ApplicationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading applications">
      {Array.from({ length: count }).map((_, i) => (
        <ApplicationSkeleton key={i} />
      ))}
    </div>
  );
}

export function DraftSkeleton() {
  return (
    <div
      className="bg-surface rounded-xl border border-border p-4 animate-pulse"
      aria-hidden="true"
    >
      <div className="space-y-2">
        <div className="h-4 bg-surface2 rounded w-1/2" />
        <div className="h-3 bg-surface2 rounded w-1/3" />
        <div className="h-9 bg-surface2 rounded w-full mt-3" />
      </div>
    </div>
  );
}
