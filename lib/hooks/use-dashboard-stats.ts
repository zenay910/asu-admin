'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DashboardStats } from '@/lib/data/dashboard-stats'

export type UseDashboardStatsResult = {
  stats: DashboardStats | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function parseStatsResponse(body: unknown): {
  stats: DashboardStats | null
  error: string | null
} {
  if (body == null || typeof body !== 'object') {
    return { stats: null, error: 'Invalid response from dashboard stats API' }
  }
  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to load dashboard stats'
    return { stats: null, error: message }
  }
  if (payload.stats == null || typeof payload.stats !== 'object') {
    return { stats: null, error: 'Stats missing from API response' }
  }
  return { stats: payload.stats as DashboardStats, error: null }
}

export function useDashboardStats(): UseDashboardStatsResult {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/stats')
      const body: unknown = await response.json().catch(() => null)
      const parsed = parseStatsResponse(body)
      if (!response.ok || parsed.error) {
        setStats(null)
        setError(parsed.error ?? `Request failed (${response.status})`)
        return
      }
      setStats(parsed.stats)
    } catch (err) {
      setStats(null)
      setError(
        err instanceof Error ? err.message : 'Failed to load dashboard stats',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { stats, loading, error, refetch }
}
