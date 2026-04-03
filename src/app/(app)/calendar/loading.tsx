import { Skeleton } from '@/components/ui/skeleton'

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar skeleton */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          {/* Month header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded" />
            ))}
          </div>
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-7 w-20 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
