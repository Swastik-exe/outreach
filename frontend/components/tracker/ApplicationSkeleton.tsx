import { cn } from '@/lib/utils';

function SkeletonRow({ first }: { first?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-0 py-4',
        !first && 'border-t border-inner',
      )}
    >
      <div className="skeleton-shimmer h-3 w-[26%] rounded-md" />
      <div className="skeleton-shimmer h-[22px] w-[88px] rounded-full" />
      <div className="skeleton-shimmer h-3 flex-1 rounded-md" />
      <div className="skeleton-shimmer h-3 w-[70px] rounded-md" />
    </div>
  );
}

export function ApplicationSkeleton() {
  return (
    <div
      className="rounded-[14px] border border-border bg-card px-5 py-1.5"
      aria-hidden="true"
    >
      <SkeletonRow first />
    </div>
  );
}

export function ApplicationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <section
      aria-label="Loading applications"
      className="rounded-[14px] border border-border bg-card px-5 py-1.5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} first={i === 0} />
      ))}
    </section>
  );
}

export function DraftSkeleton() {
  return (
    <div
      className="rounded-[14px] border border-border bg-card p-5"
      aria-hidden="true"
    >
      <div className="skeleton-shimmer mb-2 h-4 w-1/2 rounded-md" />
      <div className="skeleton-shimmer mb-4 h-3 w-1/3 rounded-md" />
      <div className="skeleton-shimmer h-9 w-full rounded-[10px]" />
    </div>
  );
}
