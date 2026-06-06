'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createApplianceSaleInvoiceViaApi,
  type ApplianceSaleAccessoryPayload,
  type ApplianceSaleFeePayload,
} from '@/app/dashboard/invoices/actions'
import { CustomerPicker } from '@/components/customer-picker'
import { StatusBadge } from '@/components/status-badge'
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
import { useAppliances } from '@/lib/hooks/use-appliances'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { useParts } from '@/lib/hooks/use-parts'
import { formatMoney } from '@/lib/format'

type FeeRow = {
  key: string
  description: string
  amount: string
}

type AccessoryRow = {
  key: string
  partId: string
  quantity: string
  unitPrice: string
}

function newRowKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function parseFees(rows: FeeRow[]): ApplianceSaleFeePayload[] | string {
  const fees: ApplianceSaleFeePayload[] = []
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

function parseAccessories(
  rows: AccessoryRow[],
  partsById: Map<string, { unit_price: number | null }>,
): ApplianceSaleAccessoryPayload[] | string {
  const accessories: ApplianceSaleAccessoryPayload[] = []
  for (const row of rows) {
    if (!row.partId && !row.quantity.trim() && !row.unitPrice.trim()) {
      continue
    }
    if (!row.partId) {
      return 'Each accessory line needs a part selected.'
    }
    const quantity = Number(row.quantity.trim())
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return 'Each accessory needs a positive whole-number quantity.'
    }
    const line: ApplianceSaleAccessoryPayload = {
      part_id: row.partId,
      quantity,
    }
    const unitRaw = row.unitPrice.trim()
    if (unitRaw) {
      const unit_price = Number(unitRaw)
      if (!Number.isFinite(unit_price)) {
        return 'Accessory unit price must be a number when provided.'
      }
      line.unit_price = unit_price
    } else {
      const part = partsById.get(row.partId)
      if (part?.unit_price != null) {
        line.unit_price = part.unit_price
      }
    }
    accessories.push(line)
  }
  return accessories
}

export function ApplianceSaleInvoiceForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { appliances, loading: appliancesLoading, error: appliancesError } =
    useAppliances({})
  const { parts, loading: partsLoading, error: partsError } = useParts({})

  useFetchErrorToast(appliancesError, 'Appliances catalog')
  useFetchErrorToast(partsError, 'Parts catalog')

  const [applianceId, setApplianceId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [tax, setTax] = useState('0')
  const [fees, setFees] = useState<FeeRow[]>([])
  const [accessories, setAccessories] = useState<AccessoryRow[]>([])

  const sellableAppliances = useMemo(
    () =>
      appliances.filter((row) => row.lifecycle_state !== 'Retired'),
    [appliances],
  )

  const selectedAppliance = useMemo(
    () => sellableAppliances.find((row) => row.id === applianceId) ?? null,
    [sellableAppliances, applianceId],
  )

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

  const previewSubtotal = useMemo(() => {
    let sum = selectedAppliance?.price ?? 0
    for (const row of fees) {
      const amount = Number(row.amount.trim())
      if (row.description.trim() && Number.isFinite(amount)) {
        sum += amount
      }
    }
    for (const row of accessories) {
      if (!row.partId) continue
      const qty = Number(row.quantity.trim())
      if (!Number.isInteger(qty) || qty <= 0) continue
      const unitRaw = row.unitPrice.trim()
      const unit = unitRaw
        ? Number(unitRaw)
        : (partsById.get(row.partId)?.unit_price ?? 0)
      if (Number.isFinite(unit)) {
        sum += qty * unit
      }
    }
    return sum
  }, [selectedAppliance, fees, accessories, partsById])

  const previewTax = useMemo(() => {
    const value = Number(tax.trim())
    return Number.isFinite(value) && value >= 0 ? value : 0
  }, [tax])

  function addFee(description = '', amount = '') {
    setFees((prev) => [
      ...prev,
      { key: newRowKey(), description, amount },
    ])
  }

  function removeFee(key: string) {
    setFees((prev) => prev.filter((row) => row.key !== key))
  }

  function addAccessory() {
    setAccessories((prev) => [
      ...prev,
      { key: newRowKey(), partId: '', quantity: '1', unitPrice: '' },
    ])
  }

  function removeAccessory(key: string) {
    setAccessories((prev) => prev.filter((row) => row.key !== key))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!applianceId) {
      toast.error('Select an appliance to sell.')
      return
    }

    const feesParsed = parseFees(fees)
    if (typeof feesParsed === 'string') {
      toast.error(feesParsed)
      return
    }

    const accessoriesParsed = parseAccessories(accessories, partsById)
    if (typeof accessoriesParsed === 'string') {
      toast.error(accessoriesParsed)
      return
    }

    const taxValue = Number(tax.trim())
    if (!Number.isFinite(taxValue) || taxValue < 0) {
      toast.error('Tax must be a non-negative number.')
      return
    }

    startTransition(async () => {
      const result = await createApplianceSaleInvoiceViaApi({
        appliance_id: applianceId,
        customer_id: customerId.trim() || null,
        tax: taxValue,
        fees: feesParsed,
        accessories: accessoriesParsed,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Appliance sale invoice created')
      router.push(`/dashboard/invoices/${result.invoiceId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Appliance</h2>
        <p className="text-sm text-muted-foreground">
          One appliance line is added at the catalog price. The appliance moves
          to Retired with status Sold when the invoice is created.
        </p>
        <div className="space-y-2">
          <Label id="sale-appliance-label" htmlFor="sale-appliance">
            Appliance
          </Label>
          <Select
            value={applianceId}
            onValueChange={setApplianceId}
            disabled={appliancesLoading || pending}
          >
                <SelectTrigger
                  id="sale-appliance"
                  aria-labelledby="sale-appliance-label"
                  className="w-full min-h-11"
                >
              <SelectValue
                placeholder={
                  appliancesLoading
                    ? 'Loading appliances…'
                    : sellableAppliances.length
                      ? 'Select appliance'
                      : 'No sellable appliances'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sellableAppliances.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {`${row.title || row.model_number} · ${formatMoney(row.price)} · ${row.lifecycle_state}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedAppliance ? (
          <div className="rounded-md border border-border p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">
              {selectedAppliance.title || selectedAppliance.model_number}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                kind="lifecycle-state"
                value={selectedAppliance.lifecycle_state}
              />
              <StatusBadge
                kind="appliance-status"
                value={selectedAppliance.status}
              />
            </div>
            <p className="text-muted-foreground">
              Appliance line: {formatMoney(selectedAppliance.price)}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Fees</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => addFee('Delivery', '')}
            >
              Add delivery
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => addFee('Installation', '')}
            >
              Add installation
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => addFee()}
            >
              Add fee
            </Button>
          </div>
        </div>
        {fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Optional delivery or installation fees (fee line items).
          </p>
        ) : (
          <ul className="space-y-3">
            {fees.map((row) => (
              <li
                key={row.key}
                className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_8rem_auto]"
              >
                <div className="space-y-1">
                  <Label className="sr-only">Description</Label>
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
                </div>
                <div className="space-y-1">
                  <Label className="sr-only">Amount</Label>
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
                </div>
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

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Accessories</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || partsLoading}
            onClick={addAccessory}
          >
            Add part
          </Button>
        </div>
        {accessories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Optional part lines (catalog parts as accessories).
          </p>
        ) : (
          <ul className="space-y-3">
            {accessories.map((row) => (
              <li
                key={row.key}
                className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1fr_6rem_8rem_auto]"
              >
                <div className="space-y-1">
                  <Label className="sr-only">Part</Label>
                  <Select
                    value={row.partId}
                    onValueChange={(value) =>
                      setAccessories((prev) =>
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
                      aria-label="Accessory part"
                      className="w-full min-h-11"
                    >
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedParts.map((part) => (
                        <SelectItem key={part.id} value={part.id}>
                          {`${part.part_number} — ${part.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="sr-only">Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) =>
                      setAccessories((prev) =>
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
                      setAccessories((prev) =>
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
                  disabled={pending}
                  onClick={() => removeAccessory(row.key)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <CustomerPicker
          id="sale-customer"
          value={customerId}
          onChange={setCustomerId}
          disabled={pending}
        />
        <div className="space-y-2">
          <Label htmlFor="sale-tax">Tax</Label>
          <Input
            id="sale-tax"
            type="number"
            min={0}
            step="0.01"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            disabled={pending}
          />
        </div>
      </section>

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
        <Button type="submit" disabled={pending || !applianceId}>
          {pending ? 'Creating…' : 'Create appliance sale invoice'}
        </Button>
        <Button type="button" variant="outline" asChild disabled={pending}>
          <Link href="/dashboard/invoices">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
