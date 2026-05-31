'use client'

import { useEffect, useRef } from 'react'
import { useAppliances } from '@/lib/hooks/use-appliances'
import { useParts } from '@/lib/hooks/use-parts'

/** C8 verify probe — not wired to any page. Mount manually in dev to inspect hook states. */
export function C8HooksProbe() {
  const appliances = useAppliances({ limit: 5 })
  const parts = useParts({ filters: { limit: 5 } })
  const logged = useRef(false)

  useEffect(() => {
    if (logged.current || appliances.loading || parts.loading) return
    logged.current = true
    console.log('[C8HooksProbe]', {
      applianceCount: appliances.appliances.length,
      partCount: parts.parts.length,
      applianceError: appliances.error,
      partError: parts.error,
    })
  }, [
    appliances.loading,
    appliances.error,
    appliances.appliances,
    parts.loading,
    parts.error,
    parts.parts,
  ])

  return null
}
