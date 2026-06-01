import type { JobClass, JobState, JobType } from '@/lib/types/operations'

/** Allowed `state` transitions per tasks.md job state machine */
export const ALLOWED_JOB_TRANSITIONS: Record<JobState, readonly JobState[]> = {
  Open: ['In Progress', 'Closed'],
  'In Progress': ['Completed', 'Closed'],
  Completed: ['Closed'],
  Closed: [],
}

export const JOB_STATES: readonly JobState[] = [
  'Open',
  'In Progress',
  'Completed',
  'Closed',
]

/** Valid `job_type` values per `job_class` (class↔type pairing enforced in app layer) */
export const JOB_TYPES_BY_CLASS: Record<JobClass, readonly JobType[]> = {
  Internal: ['Intake', 'Diagnostic', 'Repair', 'Cleaning'],
  Customer: [
    'Diagnostic',
    'Repair',
    'Delivery',
    'Installation',
    'Maintenance',
    'Warranty',
  ],
}

export function getAllowedJobTransitions(from: JobState): readonly JobState[] {
  return ALLOWED_JOB_TRANSITIONS[from]
}

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return getAllowedJobTransitions(from).includes(to)
}

export function isValidJobTypeForClass(
  jobClass: JobClass,
  jobType: JobType,
): boolean {
  return JOB_TYPES_BY_CLASS[jobClass].includes(jobType)
}
