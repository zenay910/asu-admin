import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import PartForm from '../part-form'

export default function NewPartPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add part"
        description="Creates a part via POST /api/parts."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/parts">Back to list</Link>
          </Button>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <PartForm mode="create" />
      </div>
    </div>
  )
}
