'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export type GenerateJobInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string }

async function invoicesApiFetch(
  body: Record<string, unknown>,
): Promise<
  | { ok: true; invoiceId: string }
  | { ok: false; error: string }
> {
  const headerStore = await headers()
  const host = headerStore.get('host')
  if (!host) {
    return { ok: false, error: 'Could not resolve request host.' }
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const cookie = headerStore.get('cookie') ?? ''

  const response = await fetch(`${protocol}://${host}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`
    return { ok: false, error: message }
  }

  if (payload?.success !== true) {
    return { ok: false, error: 'Unexpected response from invoices API.' }
  }

  const invoiceId =
    typeof payload.invoiceId === 'string' ? payload.invoiceId : ''
  if (!invoiceId) {
    return { ok: false, error: 'Invoice was created but no ID was returned.' }
  }

  return { ok: true, invoiceId }
}

function revalidateAfterJobInvoice(jobId: string, invoiceId: string) {
  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard/invoices')
  revalidatePath(`/dashboard/invoices/${invoiceId}`)
}

export async function generateJobInvoice(
  jobId: string,
): Promise<GenerateJobInvoiceResult> {
  const trimmed = jobId.trim()
  if (!trimmed) {
    return { ok: false, error: 'Job ID is required.' }
  }

  const result = await invoicesApiFetch({
    invoice_type: 'job',
    job_id: trimmed,
  })

  if (!result.ok) {
    return result
  }

  revalidateAfterJobInvoice(trimmed, result.invoiceId)
  return result
}
