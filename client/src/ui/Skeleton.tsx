// client/src/ui/Skeleton.tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-ink/10 ${className}`} />;
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-20" />)}
    </div>
  );
}
