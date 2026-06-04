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
import { getAllowedInvoiceTransitions } from '@/lib/operations/invoice-lifecycle'
import { transitionInvoiceStatus } from '@/lib/operations/transition-invoice-status'
import type { InvoiceStatus } from '@/lib/types/operations'

type InvoiceStatusControlsProps = {
  invoiceId: string
  status: InvoiceStatus
}

export function InvoiceStatusControls({
  invoiceId,
  status,
}: InvoiceStatusControlsProps) {
  const router = useRouter()
  const [pendingTarget, setPendingTarget] = useState<InvoiceStatus | null>(null)

  const allowedTransitions = useMemo(
    () => getAllowedInvoiceTransitions(status),
    [status],
  )

  async function handleTransition(toStatus: InvoiceStatus) {
    setPendingTarget(toStatus)

    const result = await transitionInvoiceStatus(invoiceId, toStatus)

    setPendingTarget(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`Invoice status updated to ${toStatus}`)
    router.refresh()
  }

  if (allowedTransitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            This invoice is in a terminal status ({status}). No further changes
            are allowed.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status transitions</CardTitle>
        <CardDescription>
          Current status: <StatusBadge kind="invoice-status" value={status} />
          {status === 'Draft' ? (
            <>
              {' '}
              · Issuing sets <span className="font-medium">issued_at</span> to
              now.
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {allowedTransitions.map((toStatus) => (
            <Button
              key={toStatus}
              type="button"
              variant={toStatus === 'Void' ? 'destructive' : 'default'}
              disabled={pendingTarget != null}
              onClick={() => void handleTransition(toStatus)}
            >
              {pendingTarget === toStatus ? 'Updating…' : `Mark ${toStatus}`}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
