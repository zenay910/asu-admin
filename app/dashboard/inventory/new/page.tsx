import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import InventoryForm from './inventory-form'

export const maxDuration = 60

export default function NewInventoryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add appliance"
        description="Creates an appliance in Intake (Draft) and mirrors a matching products row. Publish on the storefront only after the unit is Listed."
        actions={
          <Button asChild variant="outline" type="button">
            <Link href="/dashboard/inventory/view">Back to list</Link>
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <InventoryForm />
      </div>
    </div>
  )
}
