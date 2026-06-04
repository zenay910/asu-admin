import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type DataTableColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  headerClassName?: string
  cellClassName?: string
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowKey: (row: T) => string
  getRowClassName?: (row: T) => string | undefined
  caption?: string
  emptyMessage?: string
  /** Accessible name when no visible caption is provided */
  ariaLabel?: string
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  getRowClassName,
  caption,
  emptyMessage = 'No rows to display.',
  ariaLabel = 'Data table',
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-md border', className)}>
      <Table aria-label={caption ? undefined : ariaLabel}>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                scope="col"
                className={column.headerClassName}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={getRowKey(row)}
                className={getRowClassName?.(row)}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={column.cellClassName}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
