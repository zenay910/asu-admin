'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { adjustPartStock } from '@/app/dashboard/parts/actions'
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
import { Textarea } from '@/components/ui/textarea'

type AdjustPartStockDialogProps = {
  partId: string
  quantityOnHand: number
  label?: string
}

export function AdjustPartStockDialog({
  partId,
  quantityOnHand,
  label = 'Adjust stock',
}: AdjustPartStockDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deltaInput, setDeltaInput] = useState('')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const delta = useMemo(() => {
    const trimmed = deltaInput.trim()
    if (!trimmed) return null
    const value = Number(trimmed)
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null
    return value
  }, [deltaInput])

  const projectedQuantity =
    delta != null ? quantityOnHand + delta : null

  const projectedInvalid =
    projectedQuantity != null && projectedQuantity < 0

  const resetForm = () => {
    setDeltaInput('')
    setReason('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (delta == null || delta === 0) {
      toast.error('Enter a non-zero whole-number adjustment.')
      return
    }
    if (projectedInvalid) {
      toast.error('That adjustment would bring quantity below zero.')
      return
    }

    startTransition(async () => {
      const result = await adjustPartStock(partId, delta, reason)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Stock updated: ${result.quantityOnHand} on hand`)
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
        <Button type="button" variant="secondary">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              Current quantity on hand:{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {quantityOnHand}
              </span>
              . Positive adds stock; negative removes it. A movement row is
              recorded for every adjustment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stock-delta">Delta</Label>
              <Input
                id="stock-delta"
                type="number"
                step="1"
                required
                placeholder="e.g. 5 or -2"
                value={deltaInput}
                onChange={(e) => setDeltaInput(e.target.value)}
                disabled={pending}
              />
              {projectedQuantity != null ? (
                <p
                  className={
                    projectedInvalid
                      ? 'text-sm text-destructive'
                      : 'text-sm text-muted-foreground'
                  }
                >
                  {projectedInvalid
                    ? 'Would result in negative quantity — not allowed.'
                    : `New quantity on hand: ${projectedQuantity}`}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-reason">Reason</Label>
              <Textarea
                id="stock-reason"
                rows={3}
                placeholder="e.g. Cycle count correction, received shipment"
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
              disabled={pending || projectedInvalid || delta == null || delta === 0}
            >
              {pending ? 'Saving…' : 'Apply adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
