import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import CustomerForm from '../customer-form'

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add customer"
        description="Creates a customer via POST /api/customers."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/customers">Back to list</Link>
          </Button>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <CustomerForm mode="create" />
      </div>
    </div>
  )
}
