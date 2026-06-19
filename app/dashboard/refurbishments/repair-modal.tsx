'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConsumePartForRefurbishmentDialog } from '@/components/consume-part-for-refurbishment-dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { patchRefurbishmentFields } from '@/app/dashboard/refurbishments/actions'
import type { RefurbishmentPartLine } from '@/lib/data/refurbishments'
import type { RefurbishmentApplianceSummary } from '@/lib/data/refurbishments'
import {
  REPAIR_WORKFLOW_STATUSES,
  repairWorkflowStepIndex,
} from '@/lib/operations/refurbishment-lifecycle'
import { advanceRefurbishment } from '@/lib/operations/transition-refurbishment-state'
import type { Bay, RefurbishmentStatus } from '@/lib/types/refurbishment'
import { cn } from '@/lib/utils'

type RepairFormValues = {
  initial_symptoms: string
  error_codes: string
  work_needed: string
  cleaning_status: string
  test_mode_used: string
  final_results: string
}

const STEP_LABELS: Record<(typeof REPAIR_WORKFLOW_STATUSES)[number], string> = {
  diagnostic: 'Diagnostic',
  repair: 'Repair',
  testing: 'Testing',
}

function valuesFromRefurbishment(
  refurbishment: RefurbishmentApplianceSummary['refurbishment'],
): RepairFormValues {
  return {
    initial_symptoms: refurbishment.initial_symptoms ?? '',
    error_codes: refurbishment.error_codes ?? '',
    work_needed: refurbishment.work_needed ?? '',
    cleaning_status: refurbishment.cleaning_status ?? '',
    test_mode_used: refurbishment.test_mode_used ?? '',
    final_results: refurbishment.final_results ?? '',
  }
}

function fieldsForStep(
  step: RefurbishmentStatus,
  values: RepairFormValues,
): Parameters<typeof patchRefurbishmentFields>[1] {
  switch (step) {
    case 'diagnostic':
      return {
        initial_symptoms: values.initial_symptoms.trim() || null,
        error_codes: values.error_codes.trim() || null,
      }
    case 'repair':
      return {
        work_needed: values.work_needed.trim() || null,
        cleaning_status: values.cleaning_status.trim() || null,
      }
    case 'testing':
      return {
        test_mode_used: values.test_mode_used.trim() || null,
        final_results: values.final_results.trim() || null,
      }
    default:
      return {}
  }
}

const EMPTY_FORM_VALUES: RepairFormValues = {
  initial_symptoms: '',
  error_codes: '',
  work_needed: '',
  cleaning_status: '',
  test_mode_used: '',
  final_results: '',
}

type RepairModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bay: Bay | null
  assignment: RefurbishmentApplianceSummary | null
  parts: RefurbishmentPartLine[]
}

export default function RepairModal({
  open,
  onOpenChange,
  bay,
  assignment,
  parts,
}: RepairModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const status = assignment?.refurbishment.status ?? 'diagnostic'
  const statusStepIndex = repairWorkflowStepIndex(status)
  const [viewStep, setViewStep] = useState(() =>
    repairWorkflowStepIndex(status),
  )
  const [formValues, setFormValues] = useState<RepairFormValues>(() =>
    assignment
      ? valuesFromRefurbishment(assignment.refurbishment)
      : EMPTY_FORM_VALUES,
  )
  const [graduatedApplianceId, setGraduatedApplianceId] = useState<
    string | null
  >(null)

  const currentStep = REPAIR_WORKFLOW_STATUSES[viewStep] ?? 'diagnostic'
  const isAtCurrentStatusStep = viewStep === statusStepIndex
  const isLastStep = viewStep === REPAIR_WORKFLOW_STATUSES.length - 1

  const setField =
    (field: keyof RepairFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormValues((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handlePrevious = () => {
    setViewStep((step) => Math.max(0, step - 1))
  }

  const handleSaveAndNext = () => {
    if (!assignment) return

    const stepFields = fieldsForStep(currentStep, formValues)
    const refurbishmentId = assignment.refurbishment.id

    startTransition(async () => {
      if (!isAtCurrentStatusStep) {
        const patch = await patchRefurbishmentFields(refurbishmentId, stepFields)
        if (!patch.success) {
          toast.error(patch.error)
          return
        }
        toast.success('Changes saved.')
        setViewStep((step) => Math.min(step + 1, REPAIR_WORKFLOW_STATUSES.length - 1))
        router.refresh()
        return
      }

      const result = await advanceRefurbishment(refurbishmentId, stepFields)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      if (result.refurbishment.status === 'completed') {
        setGraduatedApplianceId(assignment.appliance.id)
        router.refresh()
        return
      }

      toast.success(
        `Advanced to ${STEP_LABELS[result.refurbishment.status as keyof typeof STEP_LABELS] ?? result.refurbishment.status}.`,
      )
      setViewStep(repairWorkflowStepIndex(result.refurbishment.status))
      setFormValues(valuesFromRefurbishment(result.refurbishment))
      router.refresh()
    })
  }

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      setGraduatedApplianceId(null)
    }
    onOpenChange(next)
  }

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case 'diagnostic':
        return (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="initial_symptoms">Initial symptoms</Label>
              <Textarea
                id="initial_symptoms"
                rows={4}
                value={formValues.initial_symptoms}
                onChange={setField('initial_symptoms')}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="error_codes">Error codes</Label>
              <Input
                id="error_codes"
                value={formValues.error_codes}
                onChange={setField('error_codes')}
                disabled={pending}
              />
            </div>
          </div>
        )
      case 'repair':
        return (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="work_needed">Work needed</Label>
              <Textarea
                id="work_needed"
                rows={4}
                value={formValues.work_needed}
                onChange={setField('work_needed')}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Parts used</Label>
                {assignment ? (
                  <ConsumePartForRefurbishmentDialog
                    refurbishmentId={assignment.refurbishment.id}
                  />
                ) : null}
              </div>
              {parts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No parts recorded yet.
                </p>
              ) : (
                <ul className="divide-y rounded-md border text-sm">
                  {parts.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <span>
                        {line.part_number} — {line.part_name}
                      </span>
                      <span className="text-muted-foreground">
                        ×{line.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cleaning_status">Cleaning status</Label>
              <Input
                id="cleaning_status"
                value={formValues.cleaning_status}
                onChange={setField('cleaning_status')}
                disabled={pending}
                placeholder="e.g. Interior cleaned, lint trap cleared"
              />
            </div>
          </div>
        )
      case 'testing':
        return (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="test_mode_used">Test mode used</Label>
              <Input
                id="test_mode_used"
                value={formValues.test_mode_used}
                onChange={setField('test_mode_used')}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="final_results">Final results</Label>
              <Textarea
                id="final_results"
                rows={4}
                value={formValues.final_results}
                onChange={setField('final_results')}
                disabled={pending}
              />
            </div>
          </div>
        )
      default:
        return null
    }
  }, [assignment, currentStep, formValues, parts, pending])

  if (!assignment || !bay) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="fixed inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:rounded-none">
        {graduatedApplianceId ? (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <StatusBadge kind="refurbishment-status" value="completed" />
              <div className="space-y-2">
                <DialogTitle className="text-2xl">Graduated to Listed</DialogTitle>
                <DialogDescription className="max-w-md text-base">
                  Bay freed. This unit is ready for retail price and publishing on
                  the appliance page — separate from the refurbishment workflow.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button asChild>
                  <Link href={`/dashboard/inventory/${graduatedApplianceId}`}>
                    Open appliance
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Back to bays
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
        <div className="border-b px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl">
                  {assignment.appliance.title || 'Untitled unit'}
                </DialogTitle>
                <DialogDescription>
                  {bay.name} · {assignment.appliance.brand}
                  {assignment.appliance.model_number
                    ? ` · ${assignment.appliance.model_number}`
                    : ''}
                </DialogDescription>
              </div>
              <StatusBadge
                kind="refurbishment-status"
                value={assignment.refurbishment.status}
              />
            </div>

            <ol className="flex gap-2">
              {REPAIR_WORKFLOW_STATUSES.map((step, index) => {
                const isActive = index === viewStep
                const isComplete = index < statusStepIndex
                return (
                  <li
                    key={step}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-2 text-center text-xs font-medium sm:text-sm',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : isComplete
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                          : 'border-muted text-muted-foreground',
                    )}
                  >
                    {STEP_LABELS[step]}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl">{stepContent}</div>
        </div>

        <div className="sticky bottom-0 border-t bg-background px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={pending || viewStep === 0}
            >
              &lt; Previous
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndNext}
              disabled={pending}
            >
              {pending
                ? 'Saving…'
                : isAtCurrentStatusStep && isLastStep
                  ? 'Save & complete >'
                  : 'Save & Next >'}
            </Button>
          </div>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
