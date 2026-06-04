'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DashboardActivityItem } from '@/lib/data/dashboard-activity'

export type UseDashboardActivityResult = {
  activity: DashboardActivityItem[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function parseActivityResponse(body: unknown): {
  activity: DashboardActivityItem[]
  error: string | null
} {
  if (body == null || typeof body !== 'object') {
    return { activity: [], error: 'Invalid response from dashboard activity API' }
  }
  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to load recent activity'
    return { activity: [], error: message }
  }
  const activity = Array.isArray(payload.activity)
    ? (payload.activity as DashboardActivityItem[])
    : []
  return { activity, error: null }
}

export function useDashboardActivity(): UseDashboardActivityResult {
  const [activity, setActivity] = useState<DashboardActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/activity')
      const body: unknown = await response.json().catch(() => null)
      const parsed = parseActivityResponse(body)
      if (!response.ok || parsed.error) {
        setActivity([])
        setError(parsed.error ?? `Request failed (${response.status})`)
        return
      }
      setActivity(parsed.activity)
    } catch (err) {
      setActivity([])
      setError(
        err instanceof Error ? err.message : 'Failed to load recent activity',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { activity, loading, error, refetch }
}
