import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { listBays } from '@/lib/data/bays'
import {
  listActiveBayAssignmentsWithAppliances,
  listRefurbishmentParts,
  listStagingRefurbishmentsWithAppliances,
  type RefurbishmentPartLine,
} from '@/lib/data/refurbishments'
import ActiveBayDashboard, {
  type BayAssignmentMap,
} from './active-bay-dashboard'

export default async function RefurbishmentsPage() {
  const [bays, assignments, stagingOptions] = await Promise.all([
    listBays(),
    listActiveBayAssignmentsWithAppliances(),
    listStagingRefurbishmentsWithAppliances(),
  ])

  const dryerBays = bays.filter((bay) => bay.machine_type === 'Dryer')
  const washerBays = bays.filter((bay) => bay.machine_type === 'Washer')

  const assignmentByBayId: BayAssignmentMap = {}
  for (const assignment of assignments) {
    const bayId = assignment.refurbishment.bay_id
    if (bayId) {
      assignmentByBayId[bayId] = assignment
    }
  }

  const partsEntries = await Promise.all(
    assignments.map(async (assignment) => {
      const parts = await listRefurbishmentParts(assignment.refurbishment.id)
      return [assignment.refurbishment.id, parts] as const
    }),
  )
  const partsByRefurbishmentId = Object.fromEntries(
    partsEntries,
  ) as Record<string, RefurbishmentPartLine[]>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active bays"
        description="Six-bay refurbishment floor — assign staging units to dryer or washer bays."
        actions={
          <Button asChild>
            <Link href="/dashboard/refurbishments/new">New intake</Link>
          </Button>
        }
      />

      <ActiveBayDashboard
        dryerBays={dryerBays}
        washerBays={washerBays}
        assignmentByBayId={assignmentByBayId}
        stagingOptions={stagingOptions}
        partsByRefurbishmentId={partsByRefurbishmentId}
      />
    </div>
  )
}
