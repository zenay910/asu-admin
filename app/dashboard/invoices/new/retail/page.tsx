import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { RetailInvoiceForm } from './retail-invoice-form'

export default function NewRetailInvoicePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Retail invoice"
        description="Counter-sale parts with optional fees; stock is reduced on create (POST /api/invoices, retail)."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/invoices">Back to list</Link>
          </Button>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <RetailInvoiceForm />
      </div>
    </div>
  )
}
