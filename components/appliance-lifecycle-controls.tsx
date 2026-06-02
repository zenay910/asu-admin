'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getAllowedTransitions } from '@/lib/inventory/lifecycle'
import { transitionApplianceState } from '@/lib/inventory/transition-appliance-state'
import type { ApplianceStatus, LifecycleState } from '@/lib/types/inventory'

type ApplianceLifecycleControlsProps = {
  applianceId: string
  lifecycleState: LifecycleState
  status: ApplianceStatus | null
}

export function ApplianceLifecycleControls({
  applianceId,
  lifecycleState,
  status,
}: ApplianceLifecycleControlsProps) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [publishWhenListing, setPublishWhenListing] = useState(false)
  const [pendingTarget, setPendingTarget] = useState<LifecycleState | null>(null)

  const allowedTransitions = useMemo(
    () => getAllowedTransitions(lifecycleState),
    [lifecycleState],
  )

  const canPublishWhenListing = allowedTransitions.includes('Listed')

  async function handleTransition(toState: LifecycleState) {
    setPendingTarget(toState)

    const options: { reason?: string; status?: ApplianceStatus } = {
      reason: reason.trim() || undefined,
    }

    if (toState === 'Listed' && publishWhenListing) {
      options.status = 'Published'
    }

    const result = await transitionApplianceState(applianceId, toState, options)

    setPendingTarget(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`Lifecycle updated to ${toState}`)
    router.refresh()
  }

  if (allowedTransitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle transitions</CardTitle>
          <CardDescription>
            This appliance is in a terminal state ({lifecycleState}).
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle transitions</CardTitle>
        <CardDescription>
          Current stage:{' '}
          <StatusBadge kind="lifecycle-state" value={lifecycleState} />
          {status ? (
            <>
              {' '}
              · Status <StatusBadge kind="appliance-status" value={status} />
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="transition-reason">Reason (optional)</Label>
          <Textarea
            id="transition-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this transition happening?"
            rows={2}
            disabled={pendingTarget != null}
          />
        </div>

        {canPublishWhenListing ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-input text-primary focus-visible:ring-ring"
              checked={publishWhenListing}
              onChange={(event) => setPublishWhenListing(event.target.checked)}
              disabled={pendingTarget != null}
            />
            <span className="text-foreground">
              Publish to storefront when moving to{' '}
              <strong>Listed</strong> (sets status to Published).
            </span>
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {allowedTransitions.map((toState) => (
            <Button
              key={toState}
              type="button"
              variant={toState === 'Retired' ? 'destructive' : 'default'}
              disabled={pendingTarget != null}
              onClick={() => void handleTransition(toState)}
            >
              {pendingTarget === toState ? 'Updating…' : `Move to ${toState}`}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
