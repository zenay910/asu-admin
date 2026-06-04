'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createRetailInvoiceViaApi,
  type RetailFeePayload,
  type RetailPartPayload,
} from '@/app/dashboard/invoices/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { useParts } from '@/lib/hooks/use-parts'
import { formatMoney } from '@/lib/format'
import type { Part } from '@/lib/types/inventory'
import { cn } from '@/lib/utils'

type FeeRow = {
  key: string
  description: string
  amount: string
}

type PartRow = {
  key: string
  partId: string
  quantity: string
  unitPrice: string
}

function newRowKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function parseFees(rows: FeeRow[]): RetailFeePayload[] | string {
  const fees: RetailFeePayload[] = []
  for (const row of rows) {
    const description = row.description.trim()
    const amountRaw = row.amount.trim()
    if (!description && !amountRaw) continue
    if (!description) {
      return 'Each fee line needs a description.'
    }
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount)) {
      return 'Each fee line needs a numeric amount.'
    }
    fees.push({ description, amount })
  }
  return fees
}

function parseParts(
  rows: PartRow[],
  partsById: Map<string, Part>,
): RetailPartPayload[] | string {
  const parts: RetailPartPayload[] = []
  for (const row of rows) {
    if (!row.partId && !row.quantity.trim() && !row.unitPrice.trim()) {
      continue
    }
    if (!row.partId) {
      return 'Each part line needs a part selected.'
    }
    const quantity = Number(row.quantity.trim())
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return 'Each part line needs a positive whole-number quantity.'
    }
    const catalog = partsById.get(row.partId)
    if (catalog && catalog.quantity_on_hand < quantity) {
      return `Not enough stock for ${catalog.name} (on hand: ${catalog.quantity_on_hand}).`
    }
    const line: RetailPartPayload = {
      part_id: row.partId,
      quantity,
    }
    const unitRaw = row.unitPrice.trim()
    if (unitRaw) {
      const unit_price = Number(unitRaw)
      if (!Number.isFinite(unit_price)) {
        return 'Unit price must be a number when provided.'
      }
      line.unit_price = unit_price
    } else if (catalog?.unit_price != null) {
      line.unit_price = catalog.unit_price
    }
    parts.push(line)
  }
  if (parts.length === 0) {
    return 'Add at least one part line for a retail sale.'
  }
  return parts
}

export function RetailInvoiceForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { parts, loading: partsLoading, error: partsError } = useParts({})

  useFetchErrorToast(partsError, 'Parts catalog')

  const [partLines, setPartLines] = useState<PartRow[]>([
    { key: newRowKey(), partId: '', quantity: '1', unitPrice: '' },
  ])
  const [fees, setFees] = useState<FeeRow[]>([])
  const [tax, setTax] = useState('0')

  const partsById = useMemo(
    () => new Map(parts.map((row) => [row.id, row])),
    [parts],
  )

  const sortedParts = useMemo(
    () =>
      [...parts].sort((a, b) =>
        a.part_number.localeCompare(b.part_number, undefined, {
          sensitivity: 'base',
        }),
      ),
    [parts],
  )

  const hasOversell = useMemo(() => {
    for (const row of partLines) {
      if (!row.partId) continue
      const qty = Number(row.quantity.trim())
      if (!Number.isInteger(qty) || qty <= 0) continue
      const part = partsById.get(row.partId)
      if (part && qty > part.quantity_on_hand) return true
    }
    return false
  }, [partLines, partsById])

  const previewSubtotal = useMemo(() => {
    let sum = 0
    for (const row of partLines) {
      if (!row.partId) continue
      const qty = Number(row.quantity.trim())
      if (!Number.isInteger(qty) || qty <= 0) continue
      const unitRaw = row.unitPrice.trim()
      const unit = unitRaw
        ? Number(unitRaw)
        : (partsById.get(row.partId)?.unit_price ?? 0)
      if (Number.isFinite(unit)) sum += qty * unit
    }
    for (const row of fees) {
      const amount = Number(row.amount.trim())
      if (row.description.trim() && Number.isFinite(amount)) {
        sum += amount
      }
    }
    return sum
  }, [partLines, fees, partsById])

  const previewTax = useMemo(() => {
    const value = Number(tax.trim())
    return Number.isFinite(value) && value >= 0 ? value : 0
  }, [tax])

  function addPartLine() {
    setPartLines((prev) => [
      ...prev,
      { key: newRowKey(), partId: '', quantity: '1', unitPrice: '' },
    ])
  }

  function removePartLine(key: string) {
    setPartLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.key !== key),
    )
  }

  function addFee() {
    setFees((prev) => [...prev, { key: newRowKey(), description: '', amount: '' }])
  }

  function removeFee(key: string) {
    setFees((prev) => prev.filter((row) => row.key !== key))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const partsParsed = parseParts(partLines, partsById)
    if (typeof partsParsed === 'string') {
      toast.error(partsParsed)
      return
    }

    const feesParsed = parseFees(fees)
    if (typeof feesParsed === 'string') {
      toast.error(feesParsed)
      return
    }

    const taxValue = Number(tax.trim())
    if (!Number.isFinite(taxValue) || taxValue < 0) {
      toast.error('Tax must be a non-negative number.')
      return
    }

    startTransition(async () => {
      const result = await createRetailInvoiceViaApi({
        parts: partsParsed,
        fees: feesParsed,
        tax: taxValue,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Retail invoice created')
      router.push(`/dashboard/invoices/${result.invoiceId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Parts</h2>
            <p className="text-sm text-muted-foreground">
              Counter-sale part lines; stock is drawn down when the invoice is
              created (no job_part).
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || partsLoading}
            onClick={addPartLine}
          >
            Add part line
          </Button>
        </div>

        <ul className="space-y-3">
          {partLines.map((row) => {
            const catalog = row.partId ? partsById.get(row.partId) : null
            const qty = Number(row.quantity.trim())
            const oversell =
              catalog != null &&
              Number.isInteger(qty) &&
              qty > 0 &&
              qty > catalog.quantity_on_hand

            return (
              <li
                key={row.key}
                className={cn(
                  'grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_6rem_8rem_auto]',
                  oversell
                    ? 'border-destructive/50 bg-destructive/5'
                    : 'border-border',
                )}
              >
                <div className="space-y-1">
                  <Label className="sr-only">Part</Label>
                  <Select
                    value={row.partId}
                    onValueChange={(value) =>
                      setPartLines((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? { ...item, partId: value }
                            : item,
                        ),
                      )
                    }
                    disabled={partsLoading || pending}
                  >
                    <SelectTrigger
                      aria-label="Part line item"
                      className="w-full min-h-11"
                    >
                      <SelectValue
                        placeholder={
                          partsLoading ? 'Loading parts…' : 'Select part'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedParts.map((part) => (
                        <SelectItem key={part.id} value={part.id}>
                          {`${part.part_number} — ${part.name} (${part.quantity_on_hand} on hand)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {catalog ? (
                    <p
                      className={
                        oversell
                          ? 'text-xs text-destructive'
                          : 'text-xs text-muted-foreground'
                      }
                    >
                      {oversell
                        ? `Exceeds on hand (${catalog.quantity_on_hand}).`
                        : `${catalog.quantity_on_hand} on hand`}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="sr-only">Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) =>
                      setPartLines((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? { ...item, quantity: e.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="sr-only">Unit price override</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unit price"
                    value={row.unitPrice}
                    onChange={(e) =>
                      setPartLines((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? { ...item, unitPrice: e.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={pending}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || partLines.length <= 1}
                  onClick={() => removePartLine(row.key)}
                >
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Fees</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={addFee}
          >
            Add fee
          </Button>
        </div>
        {fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Optional fee line items (e.g. handling).
          </p>
        ) : (
          <ul className="space-y-3">
            {fees.map((row) => (
              <li
                key={row.key}
                className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_8rem_auto]"
              >
                <Input
                  placeholder="Description"
                  value={row.description}
                  onChange={(e) =>
                    setFees((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? { ...item, description: e.target.value }
                          : item,
                      ),
                    )
                  }
                  disabled={pending}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount"
                  value={row.amount}
                  onChange={(e) =>
                    setFees((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? { ...item, amount: e.target.value }
                          : item,
                      ),
                    )
                  }
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => removeFee(row.key)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor="retail-tax">Tax</Label>
        <Input
          id="retail-tax"
          type="number"
          min={0}
          step="0.01"
          value={tax}
          onChange={(e) => setTax(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
        <p className="text-muted-foreground">
          Estimated subtotal:{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatMoney(previewSubtotal)}
          </span>
        </p>
        <p className="text-muted-foreground">
          Estimated total:{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatMoney(previewSubtotal + previewTax)}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || hasOversell}>
          {pending ? 'Creating…' : 'Create retail invoice'}
        </Button>
        <Button type="button" variant="outline" asChild disabled={pending}>
          <Link href="/dashboard/invoices">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
