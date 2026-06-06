import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { getCustomerById } from '@/lib/data/customers'
import CustomerForm from '../../customer-form'
import { customerToFormValues } from '../../form-utils'

export const dynamic = 'force-dynamic'

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const customer = await getCustomerById(id)

  if (!customer) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit customer"
        description={customer.full_name}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/customers/${customer.id}`}>View</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/customers">List</Link>
            </Button>
          </div>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <CustomerForm
          mode="edit"
          customerId={customer.id}
          initialValues={customerToFormValues(customer)}
        />
      </div>
    </div>
  )
}
