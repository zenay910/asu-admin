'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Part, PartStatus } from '@/lib/types/inventory'

export type PartListFilters = {
  status?: PartStatus
  category?: string
  brand?: string
  limit?: number
}

export type UsePartsOptions = {
  id?: string
  filters?: PartListFilters
}

export type UsePartsResult = {
  parts: Part[]
  part: Part | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function buildPartsUrl(options: UsePartsOptions): string {
  const params = new URLSearchParams()
  if (options.id) {
    params.set('id', options.id)
    return `/api/parts?${params.toString()}`
  }
  const filters = options.filters ?? {}
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.brand) params.set('brand', filters.brand)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return qs ? `/api/parts?${qs}` : '/api/parts'
}

function parsePartsResponse(
  body: unknown,
  byId: boolean,
): { parts: Part[]; part: Part | null; error: string | null } {
  if (body == null || typeof body !== 'object') {
    return { parts: [], part: null, error: 'Invalid response from parts API' }
  }

  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string' ? payload.error : 'Failed to load parts'
    return { parts: [], part: null, error: message }
  }

  if (byId) {
    const part = payload.part as Part | undefined
    if (!part) {
      return { parts: [], part: null, error: 'Part not found in response' }
    }
    return { parts: [], part, error: null }
  }

  const parts = Array.isArray(payload.parts) ? (payload.parts as Part[]) : []
  return { parts, part: null, error: null }
}

export function useParts(options: UsePartsOptions = {}): UsePartsResult {
  const [parts, setParts] = useState<Part[]>([])
  const [part, setPart] = useState<Part | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const optionsKey = JSON.stringify(options)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const parsed = JSON.parse(optionsKey) as UsePartsOptions
      const url = buildPartsUrl(parsed)
      const response = await fetch(url)
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const parsedBody = parsePartsResponse(body, !!parsed.id)
        setParts([])
        setPart(null)
        setError(parsedBody.error ?? `Request failed (${response.status})`)
        return
      }

      const result = parsePartsResponse(body, !!parsed.id)
      if (result.error) {
        setParts([])
        setPart(null)
        setError(result.error)
        return
      }

      setParts(result.parts)
      setPart(result.part)
    } catch (err) {
      setParts([])
      setPart(null)
      setError(err instanceof Error ? err.message : 'Failed to load parts')
    } finally {
      setLoading(false)
    }
  }, [optionsKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { parts, part, loading, error, refetch }
}
