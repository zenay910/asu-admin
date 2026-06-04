import type { JobType } from '@/lib/types/operations'

export type JobDetailField = {
  key: string
  label: string
  multiline?: boolean
  placeholder?: string
}

/** Standardized `details` fields shown per job_type on the create form. */
export const JOB_DETAIL_FIELDS_BY_TYPE: Record<JobType, JobDetailField[]> = {
  Intake: [
    {
      key: 'intake_notes',
      label: 'Intake notes',
      multiline: true,
      placeholder: 'Arrival condition, accessories, paperwork',
    },
    {
      key: 'condition_observed',
      label: 'Condition observed',
      placeholder: 'e.g. Good — minor scratches',
    },
  ],
  Diagnostic: [
    {
      key: 'symptoms',
      label: 'Symptoms / reported issue',
      multiline: true,
    },
    {
      key: 'diagnosis',
      label: 'Diagnosis',
      multiline: true,
    },
  ],
  Repair: [
    {
      key: 'work_performed',
      label: 'Work performed',
      multiline: true,
    },
    {
      key: 'parts_needed',
      label: 'Parts needed',
      placeholder: 'Comma-separated part numbers or notes',
    },
  ],
  Cleaning: [
    {
      key: 'cleaning_scope',
      label: 'Cleaning scope',
      multiline: true,
      placeholder: 'Interior/exterior, chemicals used',
    },
  ],
  Delivery: [
    {
      key: 'delivery_address',
      label: 'Delivery address',
      multiline: true,
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled date',
      placeholder: 'YYYY-MM-DD or window',
    },
  ],
  Installation: [
    {
      key: 'install_location',
      label: 'Install location',
      placeholder: 'Room, floor, site notes',
    },
    {
      key: 'install_notes',
      label: 'Installation notes',
      multiline: true,
    },
  ],
  Maintenance: [
    {
      key: 'maintenance_type',
      label: 'Maintenance type',
      placeholder: 'e.g. Preventive, seasonal',
    },
    {
      key: 'notes',
      label: 'Notes',
      multiline: true,
    },
  ],
  Warranty: [
    {
      key: 'warranty_claim_id',
      label: 'Warranty claim ID',
      placeholder: 'Claim or RMA reference',
    },
    {
      key: 'notes',
      label: 'Notes',
      multiline: true,
    },
  ],
}

export function buildDetailsFromFormData(
  formData: FormData,
  jobType: JobType,
): Record<string, unknown> | null {
  const fields = JOB_DETAIL_FIELDS_BY_TYPE[jobType]
  const details: Record<string, unknown> = { form: jobType }

  for (const field of fields) {
    const raw = formData.get(`details_${field.key}`)
    if (typeof raw === 'string' && raw.trim()) {
      details[field.key] = raw.trim()
    }
  }

  return Object.keys(details).length > 1 ? details : null
}
