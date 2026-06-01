'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Job, JobClass, JobState, JobType } from '@/lib/types/operations'

export type JobListFilters = {
  job_class?: JobClass
  state?: JobState
  job_type?: JobType
  limit?: number
}

export type UseJobsOptions = {
  id?: string
  filters?: JobListFilters
}

export type UseJobsResult = {
  jobs: Job[]
  job: Job | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function buildJobsUrl(options: UseJobsOptions): string {
  const params = new URLSearchParams()
  if (options.id) {
    params.set('id', options.id)
    return `/api/jobs?${params.toString()}`
  }
  const filters = options.filters ?? {}
  if (filters.job_class) params.set('job_class', filters.job_class)
  if (filters.state) params.set('state', filters.state)
  if (filters.job_type) params.set('job_type', filters.job_type)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return qs ? `/api/jobs?${qs}` : '/api/jobs'
}

function parseJobsResponse(
  body: unknown,
  byId: boolean,
): { jobs: Job[]; job: Job | null; error: string | null } {
  if (body == null || typeof body !== 'object') {
    return { jobs: [], job: null, error: 'Invalid response from jobs API' }
  }

  const payload = body as Record<string, unknown>
  if (payload.success !== true) {
    const message =
      typeof payload.error === 'string' ? payload.error : 'Failed to load jobs'
    return { jobs: [], job: null, error: message }
  }

  if (byId) {
    const job = payload.job as Job | undefined
    if (!job) {
      return { jobs: [], job: null, error: 'Job not found in response' }
    }
    return { jobs: [], job, error: null }
  }

  const jobs = Array.isArray(payload.jobs) ? (payload.jobs as Job[]) : []
  return { jobs, job: null, error: null }
}

export function useJobs(options: UseJobsOptions = {}): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const optionsKey = JSON.stringify(options)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const parsed = JSON.parse(optionsKey) as UseJobsOptions
      const url = buildJobsUrl(parsed)
      const response = await fetch(url)
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const parsedBody = parseJobsResponse(body, !!parsed.id)
        setJobs([])
        setJob(null)
        setError(parsedBody.error ?? `Request failed (${response.status})`)
        return
      }

      const result = parseJobsResponse(body, !!parsed.id)
      if (result.error) {
        setJobs([])
        setJob(null)
        setError(result.error)
        return
      }

      setJobs(result.jobs)
      setJob(result.job)
    } catch (err) {
      setJobs([])
      setJob(null)
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [optionsKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { jobs, job, loading, error, refetch }
}
