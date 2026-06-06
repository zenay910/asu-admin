import { ListTableSkeleton } from '@/components/list-table-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function CustomersListLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <ListTableSkeleton rows={6} />
    </div>
  )
}
