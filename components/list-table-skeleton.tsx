import { Skeleton } from '@/components/ui/skeleton'

type ListTableSkeletonProps = {
  rows?: number
}

export function ListTableSkeleton({ rows = 8 }: ListTableSkeletonProps) {
  return (
    <div
      className="space-y-2 rounded-md border border-border p-4"
      aria-busy="true"
      aria-label="Loading table"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
