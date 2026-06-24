import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import SetInventoryForm from './set-form'

export const maxDuration = 60

export default function NewSetInventoryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Create set"
        description="Link existing individual appliances into a set listing with its own title, description, features, and photos."
        actions={
          <>
            <Button asChild variant="outline" type="button">
              <Link href="/dashboard/inventory/new">Add appliance</Link>
            </Button>
            <Button asChild variant="outline" type="button">
              <Link href="/dashboard/inventory/view">Back to list</Link>
            </Button>
          </>
        }
      />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <SetInventoryForm />
      </div>
    </div>
  )
}
