import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getCustomerById } from '@/lib/data/customers'
import { formatDateTime } from '@/lib/format'
import type { Customer } from '@/lib/types/crm'
import { CustomerHistoryTabs } from './customer-history-tabs'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,10rem)_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="text-foreground break-words">{value}</dd>
    </div>
  )
}

function formatAddress(customer: Customer): string {
  const address = customer.address
  if (!address) return '—'
  const parts = [address.street, address.city, address.state, address.zip].filter(
    Boolean,
  )
  return parts.length > 0 ? parts.join(', ') : '—'
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params
  const customer = await getCustomerById(id)

  if (!customer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.full_name}
        description="Customer contact and related history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/customers/edit/${customer.id}`}>
                Edit
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/customers">Back to list</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Customer profile from the customers table.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <SpecRow label="Full name" value={customer.full_name} />
            <SpecRow label="Email" value={customer.email || '—'} />
            <SpecRow label="Phone" value={customer.phone || '—'} />
            <SpecRow label="Address" value={formatAddress(customer)} />
            <SpecRow label="Notes" value={customer.notes || '—'} />
            <SpecRow label="Created" value={formatDateTime(customer.created_at)} />
            <SpecRow
              label="Updated"
              value={formatDateTime(customer.updated_at)}
            />
            <SpecRow label="ID" value={customer.id} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Owned and sold appliances, jobs, and invoices (via /api/customers
            ?history=true).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerHistoryTabs customerId={customer.id} />
        </CardContent>
      </Card>
    </div>
  )
}
