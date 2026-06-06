'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCustomers } from '@/lib/hooks/use-customers'
import { cn } from '@/lib/utils'

type CustomerPickerProps = {
  id?: string
  label?: string
  name?: string
  value: string
  onChange: (customerId: string) => void
  disabled?: boolean
}

const selectClassName = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
)

function customerOptionLabel(
  fullName: string,
  email: string | null,
): string {
  return email ? `${fullName} (${email})` : fullName
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
  const hookFilters = useMemo(() => {
    const trimmed = search.trim()
    return trimmed ? { search: trimmed } : {}
  }, [search])

  const { customers, loading, error } = useCustomers({ filters: hookFilters })

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
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
        {customers.map((row) => (
          <option key={row.id} value={row.id}>
            {customerOptionLabel(row.full_name, row.email)}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
