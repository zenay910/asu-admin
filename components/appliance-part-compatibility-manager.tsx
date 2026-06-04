'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  linkPartCompatibility,
  unlinkPartCompatibility,
} from '@/app/dashboard/parts/compatibility-actions'
import { StatusBadge } from '@/components/status-badge'
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
import type { Part } from '@/lib/types/inventory'

type AppliancePartCompatibilityManagerProps = {
  applianceId: string
  linkedParts: Part[]
}

export function AppliancePartCompatibilityManager({
  applianceId,
  linkedParts: initialLinked,
}: AppliancePartCompatibilityManagerProps) {
  const router = useRouter()
  const [linked, setLinked] = useState(initialLinked)
  const [open, setOpen] = useState(false)
  const [partId, setPartId] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  useEffect(() => {
    setLinked(initialLinked)
  }, [initialLinked])

  const { parts, loading } = useParts({})

  const linkedIds = useMemo(() => new Set(linked.map((row) => row.id)), [linked])

  const availableParts = useMemo(
    () => parts.filter((row) => !linkedIds.has(row.id)),
    [parts, linkedIds],
  )

  const resetLinkForm = () => {
    setPartId('')
    setNotes('')
  }

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault()
    if (!partId) {
      toast.error('Select a part to link.')
      return
    }

    startTransition(async () => {
      const result = await linkPartCompatibility(partId, applianceId, notes)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Part linked')
      setOpen(false)
      resetLinkForm()
      router.refresh()
    })
  }

  const handleUnlink = (partIdToRemove: string) => {
    setUnlinkingId(partIdToRemove)
    startTransition(async () => {
      const result = await unlinkPartCompatibility(partIdToRemove, applianceId)
      if (!result.ok) {
        toast.error(result.error)
        setUnlinkingId(null)
        return
      }
      setLinked((prev) => prev.filter((row) => row.id !== partIdToRemove))
      toast.success('Link removed')
      setUnlinkingId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {linked.length
            ? `${linked.length} compatible part${linked.length === 1 ? '' : 's'}`
            : 'No compatible parts linked yet'}
        </p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) resetLinkForm()
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="secondary">
              Link part
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleLink}>
              <DialogHeader>
                <DialogTitle>Link part</DialogTitle>
                <DialogDescription>
                  Mark a parts catalog item as compatible with this appliance.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label id="link-part-label" htmlFor="link-part">
                    Part
                  </Label>
                  <Select
                    value={partId}
                    onValueChange={setPartId}
                    disabled={loading || pending}
                  >
                    <SelectTrigger
                      id="link-part"
                      aria-labelledby="link-part-label"
                      className="w-full min-h-11"
                    >
                      <SelectValue
                        placeholder={
                          loading
                            ? 'Loading parts…'
                            : availableParts.length
                              ? 'Select part'
                              : 'No parts available'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableParts.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {`${row.part_number} — ${row.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-part-notes">Notes (optional)</Label>
                  <Textarea
                    id="link-part-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
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
                  disabled={pending || !partId || availableParts.length === 0}
                >
                  {pending ? 'Linking…' : 'Link'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {linked.map((part) => (
            <li
              key={part.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <Link
                  href={`/dashboard/parts/${part.id}`}
                  className="font-mono text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {part.part_number}
                </Link>
                <p className="text-foreground">{part.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[part.brand, part.category].filter(Boolean).join(' · ') ||
                    '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="part-status" value={part.status} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending && unlinkingId === part.id}
                  onClick={() => handleUnlink(part.id)}
                >
                  {unlinkingId === part.id ? 'Removing…' : 'Unlink'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
