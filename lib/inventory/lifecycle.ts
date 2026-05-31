import type { LifecycleState } from '@/lib/types/inventory'

/** Allowed `lifecycle_state` transitions per project.md §4.2 */
export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<
  LifecycleState,
  readonly LifecycleState[]
> = {
  Intake: ['Refurbishment', 'Retired'],
  Refurbishment: ['Listed', 'Retired'],
  Listed: ['Refurbishment', 'Retired'],
  Retired: [],
}

export const LIFECYCLE_STATES: readonly LifecycleState[] = [
  'Intake',
  'Refurbishment',
  'Listed',
  'Retired',
]

export function getAllowedTransitions(
  from: LifecycleState,
): readonly LifecycleState[] {
  return ALLOWED_LIFECYCLE_TRANSITIONS[from]
}

export function canTransition(
  from: LifecycleState,
  to: LifecycleState,
): boolean {
  return getAllowedTransitions(from).includes(to)
}
