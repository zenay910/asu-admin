'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { generateJobInvoice } from '@/app/dashboard/jobs/invoice-actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { JobClass, JobState } from '@/lib/types/operations'

const BILLABLE_STATES: readonly JobState[] = ['Completed', 'Closed']

type GenerateJobInvoiceButtonProps = {
  jobId: string
  jobClass: JobClass
  jobState: JobState
}

export function GenerateJobInvoiceButton({
  jobId,
  jobClass,
  jobState,
}: GenerateJobInvoiceButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const isCustomer = jobClass === 'Customer'
  const isBillable = BILLABLE_STATES.includes(jobState)
  const canGenerate = isCustomer && isBillable

  function description(): string {
    if (!isCustomer) {
      return 'Only customer-facing jobs can be invoiced. Internal jobs are not billable.'
    }
    if (!isBillable) {
      return `Move this job to Completed or Closed before generating an invoice (current state: ${jobState}).`
    }
    return 'Creates a job invoice with a labor line and one part line per consumed part (POST /api/invoices).'
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateJobInvoice(jobId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Invoice generated')
      router.push(`/dashboard/invoices/${result.invoiceId}`)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice</CardTitle>
        <CardDescription>{description()}</CardDescription>
      </CardHeader>
      {isCustomer ? (
        <CardContent>
          <Button
            type="button"
            disabled={!canGenerate || pending}
            onClick={() => void handleGenerate()}
          >
            {pending ? 'Generating…' : 'Generate invoice'}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  )
}
