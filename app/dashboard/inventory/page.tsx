import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'

export default function InventorySectionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage appliances and lifecycle."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/view">View inventory</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/inventory/new">Add appliance</Link>
            </Button>
          </>
        }
      />
    </div>
  )
}
