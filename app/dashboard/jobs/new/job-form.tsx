'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createJobItem } from '../actions'
import { initialJobFormState, type JobFormValues } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAppliances } from '@/lib/hooks/use-appliances'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import {
  JOB_DETAIL_FIELDS_BY_TYPE,
} from '@/lib/jobs/job-form-details'
import {
  isValidJobTypeForClass,
  JOB_TYPES_BY_CLASS,
} from '@/lib/operations/job-lifecycle'
import type { JobClass, JobType } from '@/lib/types/operations'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Creating…' : 'Create job'}
    </Button>
  )
}

const selectClassName = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
)

export default function JobForm() {
  const [state, formAction] = useActionState(createJobItem, initialJobFormState)
  const [values, setValues] = useState<JobFormValues>(initialJobFormState.values)

  const { appliances, loading: appliancesLoading, error: appliancesError } =
    useAppliances({})

  useFetchErrorToast(appliancesError, 'Appliances catalog')

  const allowedTypes = useMemo(
    () => JOB_TYPES_BY_CLASS[values.job_class],
    [values.job_class],
  )

  const jobType: JobType = allowedTypes.includes(values.job_type)
    ? values.job_type
    : allowedTypes[0]

  const pairingValid = isValidJobTypeForClass(values.job_class, jobType)
  const applianceRequired = values.job_class === 'Internal'
  const applianceOk = !applianceRequired || values.appliance_id.trim().length > 0
  const canSubmit = pairingValid && applianceOk

  const detailFields = JOB_DETAIL_FIELDS_BY_TYPE[jobType]

  const setJobClass = (job_class: JobClass) => {
    const types = JOB_TYPES_BY_CLASS[job_class]
    setValues((prev) => ({
      ...prev,
      job_class,
      job_type: types.includes(prev.job_type) ? prev.job_type : types[0],
      appliance_id: job_class === 'Customer' ? prev.appliance_id : prev.appliance_id,
    }))
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-2">
          <p>{state.success}</p>
          {state.jobId ? (
            <Link
              href={`/dashboard/jobs/${state.jobId}`}
              className="font-medium underline underline-offset-2"
            >
              View job
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="job_class">Job class</Label>
          <select
            id="job_class"
            name="job_class"
            className={selectClassName}
            value={values.job_class}
            onChange={(e) => setJobClass(e.target.value as JobClass)}
          >
            <option value="Internal">Internal</option>
            <option value="Customer">Customer</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job_type">Job type</Label>
          <select
            id="job_type"
            name="job_type"
            className={selectClassName}
            value={jobType}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                job_type: e.target.value as JobType,
              }))
            }
          >
            {allowedTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors.job_type} />
          {!pairingValid ? (
            <p className="text-sm text-destructive">
              This job type is not valid for {values.job_class} jobs.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="appliance_id">
          Appliance {applianceRequired ? '(required)' : '(optional)'}
        </Label>
        <select
          id="appliance_id"
          name="appliance_id"
          className={selectClassName}
          value={values.appliance_id}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, appliance_id: e.target.value }))
          }
          disabled={appliancesLoading}
        >
          <option value="">
            {appliancesLoading
              ? 'Loading appliances…'
              : applianceRequired
                ? 'Select appliance'
                : 'None'}
          </option>
          {appliances.map((row) => (
            <option key={row.id} value={row.id}>
              {[row.title || row.model_number, row.brand]
                .filter(Boolean)
                .join(' · ')}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors.appliance_id} />
        {applianceRequired && !applianceOk ? (
          <p className="text-sm text-destructive">
            Internal jobs must be linked to an appliance.
          </p>
        ) : null}
      </div>

      {values.job_class === 'Customer' ? (
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer ID (optional)</Label>
          <Input
            id="customer_id"
            name="customer_id"
            placeholder="UUID when customer records exist"
            value={values.customer_id}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, customer_id: e.target.value }))
            }
          />
        </div>
      ) : (
        <input type="hidden" name="customer_id" value={values.customer_id} />
      )}

      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Input
          id="summary"
          name="summary"
          placeholder="Short description of the work order"
          value={values.summary}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, summary: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="labor_cost">Labor cost</Label>
        <Input
          id="labor_cost"
          name="labor_cost"
          type="number"
          min="0"
          step="0.01"
          value={values.labor_cost}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, labor_cost: e.target.value }))
          }
        />
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {jobType} details
          </h3>
          <p className="text-xs text-muted-foreground">
            Stored in the standardized <code className="text-xs">details</code>{' '}
            JSON payload for this job type.
          </p>
        </div>
        {detailFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`details_${field.key}`}>{field.label}</Label>
            {field.multiline ? (
              <Textarea
                id={`details_${field.key}`}
                name={`details_${field.key}`}
                rows={3}
                placeholder={field.placeholder}
              />
            ) : (
              <Input
                id={`details_${field.key}`}
                name={`details_${field.key}`}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton disabled={!canSubmit} />
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/jobs">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
