'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { assignRefurbishmentToBay } from '@/lib/operations/refurbishment-bay-actions'
import type {
  RefurbishmentApplianceSummary,
  RefurbishmentPartLine,
} from '@/lib/data/refurbishments'
import type { Bay, MachineType } from '@/lib/types/refurbishment'
import { cn } from '@/lib/utils'
import RepairModal from './repair-modal'

export type BayAssignmentMap = Record<string, RefurbishmentApplianceSummary>

type ActiveBayDashboardProps = {
  dryerBays: Bay[]
  washerBays: Bay[]
  assignmentByBayId: BayAssignmentMap
  stagingOptions: RefurbishmentApplianceSummary[]
  partsByRefurbishmentId: Record<string, RefurbishmentPartLine[]>
}

type AssignDialogState = {
  bay: Bay
} | null

type RepairModalState = {
  bay: Bay
  assignment: RefurbishmentApplianceSummary
} | null

function BayCarousel({
  label,
  bays,
  assignmentByBayId,
  onAssign,
  onOpenRepair,
}: {
  label: string
  bays: Bay[]
  assignmentByBayId: BayAssignmentMap
  onAssign: (bay: Bay) => void
  onOpenRepair: (bay: Bay, assignment: RefurbishmentApplianceSummary) => void
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {bays.map((bay) => {
          const assignment = assignmentByBayId[bay.id] ?? null

          return (
            <article
              key={bay.id}
              className={cn(
                'snap-center shrink-0 w-[min(85vw,20rem)] rounded-xl border bg-card p-4 shadow-sm',
                assignment
                  ? 'border-primary/20 cursor-pointer transition-colors hover:bg-accent/40'
                  : 'border-dashed border-muted-foreground/30',
              )}
              {...(assignment
                ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    onClick: () => onOpenRepair(bay, assignment),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenRepair(bay, assignment)
                      }
                    },
                  }
                : {})}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{bay.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {bay.machine_type} · Bay {bay.position}
                  </p>
                </div>
                {assignment ? (
                  <StatusBadge
                    kind="refurbishment-status"
                    value={assignment.refurbishment.status}
                  />
                ) : null}
              </div>

              {assignment ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium leading-snug text-foreground">
                    {assignment.appliance.title || 'Untitled unit'}
                  </p>
                  <p className="text-muted-foreground">
                    {assignment.appliance.brand}
                    {assignment.appliance.model_number
                      ? ` · ${assignment.appliance.model_number}`
                      : ''}
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[4.5rem] flex-col items-start justify-end gap-3">
                  <p className="text-sm text-muted-foreground">Bay empty</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAssign(bay)}
                  >
                    Assign
                  </Button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function ActiveBayDashboard({
  dryerBays,
  washerBays,
  assignmentByBayId,
  stagingOptions,
  partsByRefurbishmentId,
}: ActiveBayDashboardProps) {
  const router = useRouter()
  const [assignDialog, setAssignDialog] = useState<AssignDialogState>(null)
  const [repairModal, setRepairModal] = useState<RepairModalState>(null)
  const [isPending, startTransition] = useTransition()

  const eligibleStaging = useMemo(() => {
    if (!assignDialog) return []
    return stagingOptions.filter(
      (option) => option.appliance.type === assignDialog.bay.machine_type,
    )
  }, [assignDialog, stagingOptions])

  const handleAssign = (refurbishmentId: string) => {
    if (!assignDialog) return

    startTransition(async () => {
      const result = await assignRefurbishmentToBay(
        refurbishmentId,
        assignDialog.bay.id,
      )

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`${assignDialog.bay.name} assigned.`)
      setAssignDialog(null)
      router.refresh()
    })
  }

  const machineTypeLabel = (type: MachineType) =>
    type === 'Dryer' ? 'dryer' : 'washer'

  const activeRepairAssignment = repairModal
    ? assignmentByBayId[repairModal.bay.id] ?? repairModal.assignment
    : null

  return (
    <>
      <div className="space-y-8">
        <BayCarousel
          label="Dryer bays"
          bays={dryerBays}
          assignmentByBayId={assignmentByBayId}
          onAssign={(bay) => setAssignDialog({ bay })}
          onOpenRepair={(bay, assignment) => setRepairModal({ bay, assignment })}
        />
        <BayCarousel
          label="Washer bays"
          bays={washerBays}
          assignmentByBayId={assignmentByBayId}
          onAssign={(bay) => setAssignDialog({ bay })}
          onOpenRepair={(bay, assignment) => setRepairModal({ bay, assignment })}
        />
      </div>

      <RepairModal
        key={
          activeRepairAssignment
            ? `${activeRepairAssignment.refurbishment.id}-${activeRepairAssignment.refurbishment.status}-${activeRepairAssignment.refurbishment.updated_at ?? ''}`
            : 'closed'
        }
        open={repairModal != null}
        onOpenChange={(open) => {
          if (!open) setRepairModal(null)
        }}
        bay={repairModal?.bay ?? null}
        assignment={activeRepairAssignment}
        parts={
          activeRepairAssignment
            ? (partsByRefurbishmentId[activeRepairAssignment.refurbishment.id] ??
              [])
            : []
        }
      />

      <Dialog
        open={assignDialog != null}
        onOpenChange={(open) => {
          if (!open) setAssignDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign to {assignDialog?.bay.name ?? 'bay'}
            </DialogTitle>
            <DialogDescription>
              Choose a staging {assignDialog ? machineTypeLabel(assignDialog.bay.machine_type) : 'unit'} to assign. Only matching types are shown.
            </DialogDescription>
          </DialogHeader>

          {eligibleStaging.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staging units match this bay type. Add intake for a{' '}
              {assignDialog?.bay.machine_type ?? 'matching'} unit first.
            </p>
          ) : (
            <ul className="space-y-2">
              {eligibleStaging.map((option) => (
                <li key={option.refurbishment.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start px-4 py-3 text-left"
                    disabled={isPending}
                    onClick={() => handleAssign(option.refurbishment.id)}
                  >
                    <span className="block">
                      <span className="block font-medium">
                        {option.appliance.title || 'Untitled unit'}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {option.appliance.brand}
                        {option.appliance.model_number
                          ? ` · ${option.appliance.model_number}`
                          : ''}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
