'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FinancialSummary } from '@/lib/data/financial-summary'

export type UseFinancialSummaryResult = {
  summary: FinancialSummary | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function parseSummaryResponse(body: unknown): {
  summary: FinancialSummary | null
  error: string | null
} {
  if (body == null || typeof body !== 'object') {
    return { summary: null, error: 'Invalid response from financial summary API' }
  }
  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to load financial summary'
    return { summary: null, error: message }
  }
  if (payload.summary == null || typeof payload.summary !== 'object') {
    return { summary: null, error: 'Summary missing from API response' }
  }
  return { summary: payload.summary as FinancialSummary, error: null }
}

export function useFinancialSummary(): UseFinancialSummaryResult {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/financial')
      const body: unknown = await response.json().catch(() => null)
      const parsed = parseSummaryResponse(body)
      if (!response.ok || parsed.error) {
        setSummary(null)
        setError(parsed.error ?? `Request failed (${response.status})`)
        return
      }
      setSummary(parsed.summary)
    } catch (err) {
      setSummary(null)
      setError(
        err instanceof Error ? err.message : 'Failed to load financial summary',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { summary, loading, error, refetch }
}
