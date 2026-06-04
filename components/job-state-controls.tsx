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
import { getAllowedJobTransitions } from '@/lib/operations/job-lifecycle'
import { transitionJobState } from '@/lib/operations/transition-job-state'
import type { JobState } from '@/lib/types/operations'

type JobStateControlsProps = {
  jobId: string
  state: JobState
}

export function JobStateControls({ jobId, state }: JobStateControlsProps) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [pendingTarget, setPendingTarget] = useState<JobState | null>(null)

  const allowedTransitions = useMemo(
    () => getAllowedJobTransitions(state),
    [state],
  )

  async function handleTransition(toState: JobState) {
    setPendingTarget(toState)

    const result = await transitionJobState(jobId, toState, {
      reason: reason.trim() || undefined,
    })

    setPendingTarget(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`Job state updated to ${toState}`)
    router.refresh()
  }

  if (allowedTransitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>State transitions</CardTitle>
          <CardDescription>
            This job is in a terminal state ({state}). No further transitions
            are allowed.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>State transitions</CardTitle>
        <CardDescription>
          Current state: <StatusBadge kind="job-state" value={state} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="job-transition-reason">Reason (optional)</Label>
          <Textarea
            id="job-transition-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this state change happening?"
            rows={2}
            disabled={pendingTarget != null}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {allowedTransitions.map((toState) => (
            <Button
              key={toState}
              type="button"
              variant={toState === 'Closed' ? 'destructive' : 'default'}
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
