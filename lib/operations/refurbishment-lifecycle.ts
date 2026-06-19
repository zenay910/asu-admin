import type { RefurbishmentStatus } from '@/lib/types/refurbishment'

export const REFURB_STATES: readonly RefurbishmentStatus[] = [
  'staging',
  'diagnostic',
  'repair',
  'testing',
  'completed',
]

export function nextStatus(
  from: RefurbishmentStatus,
): RefurbishmentStatus | null {
  const index = REFURB_STATES.indexOf(from)
  if (index < 0 || index >= REFURB_STATES.length - 1) {
    return null
  }
  return REFURB_STATES[index + 1]
}

export function previousStatus(
  from: RefurbishmentStatus,
): RefurbishmentStatus | null {
  const index = REFURB_STATES.indexOf(from)
  if (index <= 0) {
    return null
  }
  return REFURB_STATES[index - 1]
}

export function canAdvance(
  from: RefurbishmentStatus,
  to: RefurbishmentStatus,
): boolean {
  return nextStatus(from) === to
}

/** Modal stepper stages (staging maps to diagnostic). */
export const REPAIR_WORKFLOW_STATUSES: readonly RefurbishmentStatus[] = [
  'diagnostic',
  'repair',
  'testing',
]

export function repairWorkflowStepIndex(status: RefurbishmentStatus): number {
  if (status === 'staging') return 0
  const index = REPAIR_WORKFLOW_STATUSES.indexOf(status)
  if (index >= 0) return index
  return REPAIR_WORKFLOW_STATUSES.length - 1
}
