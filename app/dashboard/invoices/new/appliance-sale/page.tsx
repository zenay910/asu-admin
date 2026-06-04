import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { ApplianceSaleInvoiceForm } from './appliance-sale-invoice-form'

export default function NewApplianceSaleInvoicePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Appliance sale invoice"
        description="Sell an appliance with optional delivery/installation fees and accessory parts (POST /api/invoices, appliance_sale)."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/invoices">Back to list</Link>
          </Button>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <ApplianceSaleInvoiceForm />
      </div>
    </div>
  )
}
