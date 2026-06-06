'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { ListTableSkeleton } from '@/components/list-table-skeleton'
import { PageErrorAlert } from '@/components/page-error-alert'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCustomers, type CustomerListFilters } from '@/lib/hooks/use-customers'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'

function buildHookFilters(search: string): CustomerListFilters {
  const trimmed = search.trim()
  return trimmed ? { search: trimmed } : {}
}

export default function CustomersListPage() {
  const [search, setSearch] = useState('')

  const hookFilters = useMemo(() => buildHookFilters(search), [search])
  const { customers, loading, error } = useCustomers({ filters: hookFilters })

  useFetchErrorToast(error, 'Customers list')

  const hasSearch = search.trim().length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer contacts from the customers table (via /api/customers)."
        actions={
          <Button asChild>
            <Link href="/dashboard/customers/new">Add customer</Link>
          </Button>
        }
      />

      <div className="grid max-w-md gap-2">
        <Label htmlFor="customer-search">Search name or email</Label>
        <Input
          id="customer-search"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading customers…'
            : `Showing ${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        </p>
        {hasSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSearch('')}
          >
            Clear search
          </Button>
        ) : null}
      </div>

      {error ? <PageErrorAlert message={error} /> : null}

      {loading ? (
        <ListTableSkeleton />
      ) : (
        <DataTable
          ariaLabel="Customers"
          data={customers}
          getRowKey={(row) => row.id}
          emptyMessage={
            hasSearch
              ? 'No customers match your search.'
              : 'No customers yet. Add one to get started.'
          }
          columns={[
            {
              id: 'full_name',
              header: 'Name',
              cell: (row) => (
                <Link
                  href={`/dashboard/customers/${row.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {row.full_name}
                </Link>
              ),
            },
            {
              id: 'email',
              header: 'Email',
              cell: (row) => row.email || '—',
            },
            {
              id: 'phone',
              header: 'Phone',
              cell: (row) => row.phone || '—',
            },
          ]}
        />
      )}
    </div>
  )
}
