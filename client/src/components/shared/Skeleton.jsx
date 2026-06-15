export default function Skeleton({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-4">
          <div className="h-4 bg-light-pink rounded flex-1" />
          <div className="h-4 bg-light-pink rounded w-24" />
          <div className="h-4 bg-light-pink rounded w-32" />
        </div>
      ))}
    </div>
  );
}

export function FullScreenSkeleton() {
  return (
    <div className="min-h-screen bg-off-white flex items-center justify-center">
      <div className="w-full max-w-md space-y-4 p-8">
        <div className="h-8 bg-light-pink rounded animate-pulse w-1/2 mx-auto" />
        <div className="h-4 bg-light-pink rounded animate-pulse" />
        <div className="h-4 bg-light-pink rounded animate-pulse w-3/4" />
        <div className="h-12 bg-light-pink rounded animate-pulse mt-6" />
      </div>
    </div>
  );
}
