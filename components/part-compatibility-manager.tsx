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
import { useAppliances } from '@/lib/hooks/use-appliances'
import type { Appliance } from '@/lib/types/inventory'

type PartCompatibilityManagerProps = {
  partId: string
  linkedAppliances: Appliance[]
}

export function PartCompatibilityManager({
  partId,
  linkedAppliances: initialLinked,
}: PartCompatibilityManagerProps) {
  const router = useRouter()
  const [linked, setLinked] = useState(initialLinked)
  const [open, setOpen] = useState(false)
  const [applianceId, setApplianceId] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  useEffect(() => {
    setLinked(initialLinked)
  }, [initialLinked])

  const { appliances, loading } = useAppliances({})

  const linkedIds = useMemo(
    () => new Set(linked.map((row) => row.id)),
    [linked],
  )

  const availableAppliances = useMemo(
    () => appliances.filter((row) => !linkedIds.has(row.id)),
    [appliances, linkedIds],
  )

  const resetLinkForm = () => {
    setApplianceId('')
    setNotes('')
  }

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault()
    if (!applianceId) {
      toast.error('Select an appliance to link.')
      return
    }

    startTransition(async () => {
      const result = await linkPartCompatibility(partId, applianceId, notes)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Appliance linked')
      setOpen(false)
      resetLinkForm()
      router.refresh()
    })
  }

  const handleUnlink = (applianceIdToRemove: string) => {
    setUnlinkingId(applianceIdToRemove)
    startTransition(async () => {
      const result = await unlinkPartCompatibility(partId, applianceIdToRemove)
      if (!result.ok) {
        toast.error(result.error)
        setUnlinkingId(null)
        return
      }
      setLinked((prev) => prev.filter((row) => row.id !== applianceIdToRemove))
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
            ? `${linked.length} linked appliance${linked.length === 1 ? '' : 's'}`
            : 'No compatibility links yet'}
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
              Link appliance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleLink}>
              <DialogHeader>
                <DialogTitle>Link appliance</DialogTitle>
                <DialogDescription>
                  Associate this part with an appliance model for compatibility
                  lookup.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label id="link-appliance-label" htmlFor="link-appliance">
                    Appliance
                  </Label>
                  <Select
                    value={applianceId}
                    onValueChange={setApplianceId}
                    disabled={loading || pending}
                  >
                    <SelectTrigger
                      id="link-appliance"
                      aria-labelledby="link-appliance-label"
                      className="w-full min-h-11"
                    >
                      <SelectValue
                        placeholder={
                          loading
                            ? 'Loading appliances…'
                            : availableAppliances.length
                              ? 'Select appliance'
                              : 'No appliances available'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAppliances.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {[row.title || row.model_number, row.brand]
                            .filter(Boolean)
                            .join(' · ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-notes">Notes (optional)</Label>
                  <Textarea
                    id="link-notes"
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
                  disabled={
                    pending || !applianceId || availableAppliances.length === 0
                  }
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
          {linked.map((appliance) => (
            <li
              key={appliance.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <Link
                  href={`/dashboard/inventory/${appliance.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {appliance.title || appliance.model_number || 'Appliance'}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[appliance.brand, appliance.model_number]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  kind="lifecycle-state"
                  value={appliance.lifecycle_state}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending && unlinkingId === appliance.id}
                  onClick={() => handleUnlink(appliance.id)}
                >
                  {unlinkingId === appliance.id ? 'Removing…' : 'Unlink'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
