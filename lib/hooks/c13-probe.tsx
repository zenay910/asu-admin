'use client'

import { useEffect, useRef } from 'react'
import { useInvoices } from '@/lib/hooks/use-invoices'
import { useJobs } from '@/lib/hooks/use-jobs'

/** C13 verify probe — not wired to any page. Mount manually in dev to inspect hook states. */
export function C13HooksProbe() {
  const jobs = useJobs({ filters: { limit: 5 } })
  const invoices = useInvoices({ filters: { limit: 5 } })
  const logged = useRef(false)

  useEffect(() => {
    if (logged.current || jobs.loading || invoices.loading) return
    logged.current = true
    console.log('[C13HooksProbe]', {
      jobCount: jobs.jobs.length,
      invoiceCount: invoices.invoices.length,
      jobError: jobs.error,
      invoiceError: invoices.error,
    })
  }, [
    jobs.loading,
    jobs.error,
    jobs.jobs,
    invoices.loading,
    invoices.error,
    invoices.invoices,
  ])

  return null
}
