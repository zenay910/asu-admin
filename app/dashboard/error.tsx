'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { PageErrorAlert } from '@/components/page-error-alert'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <h2 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <PageErrorAlert
        message={error.message || 'An unexpected error occurred in the dashboard.'}
      />
      <Button type="button" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
