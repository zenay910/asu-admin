'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Customer, CustomerHistory } from '@/lib/types/crm'

export type CustomerListFilters = {
  search?: string
  limit?: number
}

export type UseCustomersOptions = {
  id?: string
  history?: boolean
  filters?: CustomerListFilters
}

export type UseCustomersResult = {
  customers: Customer[]
  customer: Customer | null
  history: CustomerHistory | null
  loading: boolean
  error: string | null
  refetch: () => void
}

type CustomersResponseMode = 'list' | 'single' | 'history'

function buildCustomersUrl(options: UseCustomersOptions): string {
  const params = new URLSearchParams()
  if (options.id) {
    params.set('id', options.id)
    if (options.history) params.set('history', 'true')
    return `/api/customers?${params.toString()}`
  }
  const filters = options.filters ?? {}
  if (filters.search) params.set('search', filters.search)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return qs ? `/api/customers?${qs}` : '/api/customers'
}

function getResponseMode(options: UseCustomersOptions): CustomersResponseMode {
  if (!options.id) return 'list'
  if (options.history) return 'history'
  return 'single'
}

function parseCustomersResponse(
  body: unknown,
  mode: CustomersResponseMode,
): {
  customers: Customer[]
  customer: Customer | null
  history: CustomerHistory | null
  error: string | null
} {
  if (body == null || typeof body !== 'object') {
    return {
      customers: [],
      customer: null,
      history: null,
      error: 'Invalid response from customers API',
    }
  }

  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to load customers'
    return { customers: [], customer: null, history: null, error: message }
  }

  if (mode === 'history') {
    const history = payload.history as CustomerHistory | undefined
    if (!history) {
      return {
        customers: [],
        customer: null,
        history: null,
        error: 'Customer history not found in response',
      }
    }
    return { customers: [], customer: null, history, error: null }
  }

  if (mode === 'single') {
    const customer = payload.customer as Customer | undefined
    if (!customer) {
      return {
        customers: [],
        customer: null,
        history: null,
        error: 'Customer not found in response',
      }
    }
    return { customers: [], customer, history: null, error: null }
  }

  const customers = Array.isArray(payload.customers)
    ? (payload.customers as Customer[])
    : []
  return { customers, customer: null, history: null, error: null }
}

export function useCustomers(
  options: UseCustomersOptions = {},
): UseCustomersResult {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [history, setHistory] = useState<CustomerHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const optionsKey = JSON.stringify(options)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const parsed = JSON.parse(optionsKey) as UseCustomersOptions
      const mode = getResponseMode(parsed)
      const url = buildCustomersUrl(parsed)
      const response = await fetch(url, { cache: 'no-store' })
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const parsedBody = parseCustomersResponse(body, mode)
        setCustomers([])
        setCustomer(null)
        setHistory(null)
        setError(parsedBody.error ?? `Request failed (${response.status})`)
        return
      }

      const result = parseCustomersResponse(body, mode)
      if (result.error) {
        setCustomers([])
        setCustomer(null)
        setHistory(null)
        setError(result.error)
        return
      }

      setCustomers(result.customers)
      setCustomer(result.customer)
      setHistory(result.history)
    } catch (err) {
      setCustomers([])
      setCustomer(null)
      setHistory(null)
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [optionsKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { customers, customer, history, loading, error, refetch }
}
