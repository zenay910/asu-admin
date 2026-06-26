'use client'

import { useMemo, useState } from 'react'
import { QuickAddCustomerDialog } from '@/components/quick-add-customer-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCustomers } from '@/lib/hooks/use-customers'
import type { CustomerAddress } from '@/lib/types/crm'
import { cn } from '@/lib/utils'

type CustomerPickerProps = {
  id?: string
  label?: string
  name?: string
  value: string
  onChange: (customerId: string) => void
  disabled?: boolean
}

type PinnedCustomer = {
  id: string
  full_name: string
  addressLabel: string | null
}

const selectClassName = cn(
  'flex h-9 w-full rounded-md border surface-field px-3 py-1 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
)

function formatAddressLabel(address: CustomerAddress | null): string | null {
  if (!address) return null
  const street = address.street?.trim()
  if (street) return street
  const parts = [address.city, address.state, address.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function customerOptionLabel(
  fullName: string,
  addressLabel: string | null,
): string {
  return addressLabel ? `${fullName} — ${addressLabel}` : fullName
}

export function CustomerPicker({
  id = 'customer_id',
  label = 'Customer (optional)',
  name,
  value,
  onChange,
  disabled = false,
}: CustomerPickerProps) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pinnedCustomers, setPinnedCustomers] = useState<PinnedCustomer[]>([])
  const hookFilters = useMemo(() => {
    const trimmed = search.trim()
    return trimmed ? { search: trimmed } : {}
  }, [search])

  const { customers, loading, error, refetch } = useCustomers({ filters: hookFilters })

  const selectableCustomers = useMemo((): PinnedCustomer[] => {
    const byId = new Map<string, PinnedCustomer>()
    for (const row of customers) {
      byId.set(row.id, {
        id: row.id,
        full_name: row.full_name,
        addressLabel: formatAddressLabel(row.address),
      })
    }
    for (const pinned of pinnedCustomers) {
      byId.set(pinned.id, pinned)
    }
    return [...byId.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }),
    )
  }, [customers, pinnedCustomers])

  function handleCustomerCreated(
    customerId: string,
    fullName: string,
    address: string | null,
  ) {
    setPinnedCustomers((prev) => {
      if (prev.some((row) => row.id === customerId)) return prev
      return [
        ...prev,
        { id: customerId, full_name: fullName, addressLabel: address },
      ]
    })
    onChange(customerId)
    void refetch()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <QuickAddCustomerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleCustomerCreated}
          disabled={disabled}
        />
      </div>
      <Input
        type="search"
        placeholder="Search name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
        aria-label="Search customers"
        autoComplete="off"
      />
      <select
        id={id}
        name={name}
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? 'Loading customers…' : 'No customer linked'}
        </option>
        {selectableCustomers.map((row) => (
          <option key={row.id} value={row.id}>
            {customerOptionLabel(row.full_name, row.addressLabel)}
          </option>
        ))}
      </select>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
