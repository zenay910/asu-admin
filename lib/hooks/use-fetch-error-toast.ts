'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * Surfaces hook/API fetch errors as a sonner toast (once per distinct message).
 * Keep an inline `PageErrorAlert` on the page for accessibility.
 */
export function useFetchErrorToast(
  error: string | null,
  context = 'Could not load data',
) {
  const lastShown = useRef<string | null>(null)

  useEffect(() => {
    if (error && error !== lastShown.current) {
      lastShown.current = error
      toast.error(context, { description: error })
    }
    if (!error) {
      lastShown.current = null
    }
  }, [error, context])
}
