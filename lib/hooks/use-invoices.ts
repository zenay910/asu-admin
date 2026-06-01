'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InvoiceWithLineItems } from '@/lib/data/invoices'
import type { Invoice, InvoiceStatus, InvoiceType } from '@/lib/types/operations'

export type InvoiceListFilters = {
  invoice_type?: InvoiceType
  status?: InvoiceStatus
  limit?: number
}

export type UseInvoicesOptions = {
  id?: string
  filters?: InvoiceListFilters
}

export type UseInvoicesResult = {
  invoices: Invoice[]
  invoice: InvoiceWithLineItems | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function buildInvoicesUrl(options: UseInvoicesOptions): string {
  const params = new URLSearchParams()
  if (options.id) {
    params.set('id', options.id)
    return `/api/invoices?${params.toString()}`
  }
  const filters = options.filters ?? {}
  if (filters.invoice_type) params.set('invoice_type', filters.invoice_type)
  if (filters.status) params.set('status', filters.status)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return qs ? `/api/invoices?${qs}` : '/api/invoices'
}

function parseInvoicesResponse(
  body: unknown,
  byId: boolean,
): {
  invoices: Invoice[]
  invoice: InvoiceWithLineItems | null
  error: string | null
} {
  if (body == null || typeof body !== 'object') {
    return {
      invoices: [],
      invoice: null,
      error: 'Invalid response from invoices API',
    }
  }

  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to load invoices'
    return { invoices: [], invoice: null, error: message }
  }

  if (byId) {
    const invoice = payload.invoice as InvoiceWithLineItems | undefined
    if (!invoice) {
      return {
        invoices: [],
        invoice: null,
        error: 'Invoice not found in response',
      }
    }
    return { invoices: [], invoice, error: null }
  }

  const invoices = Array.isArray(payload.invoices)
    ? (payload.invoices as Invoice[])
    : []
  return { invoices, invoice: null, error: null }
}

export function useInvoices(
  options: UseInvoicesOptions = {},
): UseInvoicesResult {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoice, setInvoice] = useState<InvoiceWithLineItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const optionsKey = JSON.stringify(options)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const parsed = JSON.parse(optionsKey) as UseInvoicesOptions
      const url = buildInvoicesUrl(parsed)
      const response = await fetch(url)
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const parsedBody = parseInvoicesResponse(body, !!parsed.id)
        setInvoices([])
        setInvoice(null)
        setError(parsedBody.error ?? `Request failed (${response.status})`)
        return
      }

      const result = parseInvoicesResponse(body, !!parsed.id)
      if (result.error) {
        setInvoices([])
        setInvoice(null)
        setError(result.error)
        return
      }

      setInvoices(result.invoices)
      setInvoice(result.invoice)
    } catch (err) {
      setInvoices([])
      setInvoice(null)
      setError(
        err instanceof Error ? err.message : 'Failed to load invoices',
      )
    } finally {
      setLoading(false)
    }
  }, [optionsKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { invoices, invoice, loading, error, refetch }
}
