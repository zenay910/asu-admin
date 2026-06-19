'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useParts } from '@/lib/hooks/use-parts'
import { consumePartsForRefurbishment } from '@/lib/operations/consume-parts-for-refurbishment'

type ConsumePartForRefurbishmentDialogProps = {
  refurbishmentId: string
  label?: string
}

export function ConsumePartForRefurbishmentDialog({
  refurbishmentId,
  label = 'Add part',
}: ConsumePartForRefurbishmentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [partId, setPartId] = useState('')
  const [quantityInput, setQuantityInput] = useState('1')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const { parts, loading } = useParts({})

  const sortedParts = useMemo(
    () =>
      [...parts].sort((a, b) =>
        a.part_number.localeCompare(b.part_number, undefined, {
          sensitivity: 'base',
        }),
      ),
    [parts],
  )

  const selectedPart = useMemo(
    () => sortedParts.find((row) => row.id === partId) ?? null,
    [sortedParts, partId],
  )

  const quantity = useMemo(() => {
    const trimmed = quantityInput.trim()
    if (!trimmed) return null
    const value = Number(trimmed)
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null
    return value
  }, [quantityInput])

  const exceedsStock =
    selectedPart != null &&
    quantity != null &&
    quantity > selectedPart.quantity_on_hand

  const quantityInvalid = quantity == null || quantity <= 0

  const resetForm = () => {
    setPartId('')
    setQuantityInput('1')
    setReason('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!partId) {
      toast.error('Select a part to consume.')
      return
    }
    if (quantityInvalid) {
      toast.error('Enter a positive whole-number quantity.')
      return
    }
    if (exceedsStock && selectedPart) {
      toast.error(
        `Not enough stock (on hand: ${selectedPart.quantity_on_hand}).`,
      )
      return
    }

    startTransition(async () => {
      const result = await consumePartsForRefurbishment(
        refurbishmentId,
        partId,
        quantity!,
        { reason: reason.trim() || undefined },
      )
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        `Consumed ${quantity} unit${quantity === 1 ? '' : 's'} (${result.quantityOnHand} on hand remaining)`,
      )
      setOpen(false)
      resetForm()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Consume part</DialogTitle>
            <DialogDescription>
              Record parts used on this refurbishment. Stock decreases and an
              audit movement is written.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label id="refurb-consume-part-label" htmlFor="refurb-consume-part">
                Part
              </Label>
              <Select
                value={partId}
                onValueChange={setPartId}
                disabled={loading || pending}
              >
                <SelectTrigger
                  id="refurb-consume-part"
                  aria-labelledby="refurb-consume-part-label"
                  className="w-full min-h-11"
                >
                  <SelectValue
                    placeholder={
                      loading
                        ? 'Loading parts…'
                        : sortedParts.length
                          ? 'Select part'
                          : 'No parts in catalog'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sortedParts.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {`${row.part_number} — ${row.name} (${row.quantity_on_hand} on hand)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refurb-consume-quantity">Quantity</Label>
              <Input
                id="refurb-consume-quantity"
                type="number"
                min={1}
                step={1}
                required
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                disabled={pending}
              />
              {selectedPart != null && quantity != null ? (
                <p
                  className={
                    exceedsStock
                      ? 'text-sm text-destructive'
                      : 'text-sm text-muted-foreground'
                  }
                >
                  {exceedsStock
                    ? `Exceeds on-hand stock (${selectedPart.quantity_on_hand}).`
                    : `${selectedPart.quantity_on_hand} on hand after consumption: ${selectedPart.quantity_on_hand - quantity}`}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="refurb-consume-reason">Reason (optional)</Label>
              <Textarea
                id="refurb-consume-reason"
                rows={2}
                placeholder="e.g. Replaced belt"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                !partId ||
                quantityInvalid ||
                exceedsStock ||
                sortedParts.length === 0
              }
            >
              {pending ? 'Consuming…' : 'Consume'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
