import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { getPartById } from '@/lib/data/parts'
import { partToFormValues } from '../../form-utils'
import PartForm from '../../part-form'

export const dynamic = 'force-dynamic'

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const part = await getPartById(id)

  if (!part) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit part"
        description={part.part_number}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/parts/${part.id}`}>View</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/parts">List</Link>
            </Button>
          </div>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <PartForm
          mode="edit"
          partId={part.id}
          initialValues={partToFormValues(part)}
          quantityOnHand={part.quantity_on_hand}
        />
      </div>
    </div>
  )
}
