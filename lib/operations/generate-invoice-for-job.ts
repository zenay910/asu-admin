'use server'

import { revalidatePath } from 'next/cache'
import { createAppliance } from '@/lib/data/appliances'
import { createJob, getJobById } from '@/lib/data/jobs'
import {
  addLineItem,
  createInvoice,
  recomputeInvoiceTotals,
  type InvoiceWithLineItems,
} from '@/lib/data/invoices'
import { createPart } from '@/lib/data/parts'
import { consumePartsForJob } from '@/lib/operations/consume-parts'
import { transitionJobState } from '@/lib/operations/transition-job-state'
import { createClient } from '@/lib/supabase/server'
import type { JobState } from '@/lib/types/operations'

const BILLABLE_JOB_STATES: readonly JobState[] = ['Completed', 'Closed']

export type GenerateInvoiceForJobResult =
  | { success: true; invoiceId: string; invoice: InvoiceWithLineItems }
  | { success: false; error: string }

function invoiceError(message: string): GenerateInvoiceForJobResult {
  return { success: false, error: message }
}

async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('invoices').delete().eq('id', invoiceId)
}

export async function generateInvoiceForJob(
  jobId: string,
  options?: { tax?: number },
): Promise<GenerateInvoiceForJobResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return invoiceError('You must be signed in to generate an invoice for a job.')
  }

  const job = await getJobById(jobId)
  if (!job) {
    return invoiceError('Job not found.')
  }

  if (job.job_class !== 'Customer') {
    return invoiceError('Only customer-facing jobs can be invoiced.')
  }

  if (!BILLABLE_JOB_STATES.includes(job.state)) {
    return invoiceError(
      `Job must be Completed or Closed to invoice (current state: ${job.state}).`,
    )
  }

  const { data: jobParts, error: jobPartsError } = await supabase
    .from('job_parts')
    .select('id, part_id, quantity, unit_price')
    .eq('job_id', jobId)

  if (jobPartsError) {
    return invoiceError(
      `Could not load parts consumed on job: ${jobPartsError.message}`,
    )
  }

  let invoiceId: string | null = null

  try {
    const invoice = await createInvoice({
      invoice_type: 'job',
      job_id: jobId,
      customer_id: job.customer_id,
      tax: options?.tax ?? 0,
    })
    invoiceId = invoice.id

    await addLineItem(invoice.id, {
      kind: 'labor',
      description: 'Labor',
      quantity: 1,
      unit_price: job.labor_cost,
    })

    for (const row of jobParts ?? []) {
      await addLineItem(invoice.id, {
        kind: 'part',
        part_id: String(row.part_id),
        description: 'Parts consumed on job',
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
      })
    }

    const updated = await recomputeInvoiceTotals(invoice.id)
    revalidatePath('/dashboard')

    return {
      success: true,
      invoiceId: invoice.id,
      invoice: updated,
    }
  } catch (error) {
    if (invoiceId) {
      await deleteInvoice(invoiceId)
    }
    const message =
      error instanceof Error ? error.message : 'Failed to generate invoice for job.'
    return invoiceError(message)
  }
}

/** Dev smoke test: Customer job with labor + 2 parts → job invoice; ineligible jobs rejected. */
export async function runGenerateInvoiceForJobSmokeTest(): Promise<{
  invoiceId: string
  lineItemCount: number
  total: number
}> {
  const suffix = Date.now()
  const partA = await createPart({
    part_number: `C8-SMOKE-A-${suffix}`,
    name: 'C8 smoke part A',
    quantity_on_hand: 10,
    unit_price: 15,
  })
  const partB = await createPart({
    part_number: `C8-SMOKE-B-${suffix}`,
    name: 'C8 smoke part B',
    quantity_on_hand: 10,
    unit_price: 20,
  })

  const appliance = await createAppliance({
    title: 'C8 internal smoke appliance',
    price: 1,
    lifecycle_state: 'Intake',
    status: 'Draft',
  })

  const internalJob = await createJob({
    job_class: 'Internal',
    job_type: 'Repair',
    appliance_id: appliance.id,
    summary: 'C8 internal smoke',
  })
  const internalReject = await generateInvoiceForJob(internalJob.id)
  if (internalReject.success) {
    throw new Error('Expected Internal job invoice generation to be rejected')
  }

  const customerJob = await createJob({
    job_class: 'Customer',
    job_type: 'Repair',
    summary: 'C8 customer smoke',
    labor_cost: 75,
  })

  const openReject = await generateInvoiceForJob(customerJob.id)
  if (openReject.success) {
    throw new Error('Expected Open-state job invoice generation to be rejected')
  }

  const consumedA = await consumePartsForJob(customerJob.id, partA.id, 2)
  if (!consumedA.success) {
    throw new Error(`Failed to consume part A: ${consumedA.error}`)
  }
  const consumedB = await consumePartsForJob(customerJob.id, partB.id, 1)
  if (!consumedB.success) {
    throw new Error(`Failed to consume part B: ${consumedB.error}`)
  }

  const toProgress = await transitionJobState(customerJob.id, 'In Progress')
  if (!toProgress.success) {
    throw new Error(`Transition failed: ${toProgress.error}`)
  }
  const toCompleted = await transitionJobState(customerJob.id, 'Completed')
  if (!toCompleted.success) {
    throw new Error(`Transition failed: ${toCompleted.error}`)
  }

  const generated = await generateInvoiceForJob(customerJob.id)
  if (!generated.success) {
    throw new Error(`Expected invoice generation: ${generated.error}`)
  }

  const invoice = generated.invoice
  if (invoice.line_items.length !== 3) {
    throw new Error(
      `Expected 3 line items, got ${invoice.line_items.length}`,
    )
  }

  const laborLine = invoice.line_items.find((line) => line.kind === 'labor')
  const partLines = invoice.line_items.filter((line) => line.kind === 'part')
  if (!laborLine || partLines.length !== 2) {
    throw new Error('Expected 1 labor line and 2 part lines')
  }

  const expectedSubtotal = 75 + 2 * 15 + 1 * 20
  if (invoice.subtotal !== expectedSubtotal) {
    throw new Error(
      `Expected subtotal ${expectedSubtotal}, got ${invoice.subtotal}`,
    )
  }
  if (invoice.total !== expectedSubtotal) {
    throw new Error(`Expected total ${expectedSubtotal}, got ${invoice.total}`)
  }

  const supabase = await createClient()
  const { error: deleteInvoiceError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoice.id)
  if (deleteInvoiceError) {
    throw new Error(`Cleanup invoice failed: ${deleteInvoiceError.message}`)
  }

  const { error: deleteJobError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', customerJob.id)
  if (deleteJobError) {
    throw new Error(`Cleanup job failed: ${deleteJobError.message}`)
  }

  const { error: deleteInternalJobError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', internalJob.id)
  if (deleteInternalJobError) {
    throw new Error(`Cleanup internal job failed: ${deleteInternalJobError.message}`)
  }

  for (const partId of [partA.id, partB.id]) {
    const { error: deletePartError } = await supabase
      .from('parts')
      .delete()
      .eq('id', partId)
    if (deletePartError) {
      throw new Error(`Cleanup part failed: ${deletePartError.message}`)
    }
  }

  const { error: deleteApplianceError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', appliance.id)
  if (deleteApplianceError) {
    throw new Error(`Cleanup appliance failed: ${deleteApplianceError.message}`)
  }

  return {
    invoiceId: generated.invoiceId,
    lineItemCount: invoice.line_items.length,
    total: invoice.total,
  }
}
