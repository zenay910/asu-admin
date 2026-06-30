import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { InvoicePrintDocument } from '@/components/invoice-print-document'
import { InvoiceStatusControls } from '@/components/invoice-status-controls'
import { PageHeader } from '@/components/page-header'
import { PrintPageButton } from '@/components/print-page-button'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getInvoiceById,
  type InvoiceWithLineItems,
} from '@/lib/data/invoices'
import { getCustomerById } from '@/lib/data/customers'
import {
  formatCustomerAddressDisplay,
  formatDate,
  formatDateTime,
  formatInvoiceDate,
  formatMoney,
  formatPhone,
} from '@/lib/format'
import type { Customer } from '@/lib/types/crm'
import type { InvoiceLineItem, LineItemKind, PaymentMethod } from '@/lib/types/operations'
import { TAX_RATE } from '@/lib/invoices/tax-rate'

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_venmo_zelle: 'Cash / Venmo / Zelle',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const invoice = await getInvoiceById(id)
  if (!invoice) {
    return { title: 'Invoice not found' }
  }
  return {
    title: `Receipt ${invoice.invoice_number}`,
  }
}

const LINE_KIND_LABELS: Record<LineItemKind, string> = {
  labor: 'Labor',
  part: 'Part',
  appliance: 'Appliance',
  fee: 'Fee',
  discount: 'Discount',
  trade_in: 'Trade-in',
}

function lineDescription(line: InvoiceLineItem): string {
  if (line.description?.trim()) return line.description.trim()
  return LINE_KIND_LABELS[line.kind]
}

function sumTaxableLineTotals(lineItems: InvoiceLineItem[]): number {
  let sum = 0
  for (const line of lineItems) {
    if (line.kind === 'discount' || line.kind === 'trade_in') {
      sum += line.line_total
      continue
    }
    if (line.kind === 'fee' && line.taxable === false) {
      continue
    }
    if (
      line.kind === 'labor' ||
      line.kind === 'part' ||
      line.kind === 'appliance' ||
      line.kind === 'fee'
    ) {
      sum += line.line_total
    }
  }
  return sum
}

function sumNonTaxableFees(lineItems: InvoiceLineItem[]): number {
  return lineItems
    .filter((line) => line.kind === 'fee' && line.taxable === false)
    .reduce((sum, line) => sum + line.line_total, 0)
}

type CustomerInfo = {
  full_name?: string | null
  addressLabel?: string | null
  phone?: string | null
}

function toCustomerInfo(customer: Customer): CustomerInfo {
  return {
    full_name: customer.full_name,
    addressLabel: formatCustomerAddressDisplay(customer.address),
    phone: customer.phone ? formatPhone(customer.phone) : null,
  }
}

function ReceiptHeader({ invoice }: { invoice: InvoiceWithLineItems }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
      {/* Company info */}
      <div className="text-sm leading-relaxed">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground print:text-black/50">
          Affordable prices at all times
        </p>
        <p className="mt-1 text-lg font-bold text-foreground print:text-black">
          ASU Appliances Parts, LLC
        </p>
        <p className="text-muted-foreground print:text-black/70">2944 S West Temple</p>
        <p className="text-muted-foreground print:text-black/70">Salt Lake City, UT 84115</p>
        <p className="text-muted-foreground print:text-black/70">801 833 7629</p>
        <p className="text-muted-foreground print:text-black/70">www.asuappliances.com</p>
      </div>

      {/* Receipt number + date */}
      <div className="text-sm sm:text-right">
        <dl className="space-y-1">
          <div className="flex gap-6 sm:justify-end">
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground print:text-black/50">
              Receipt No.
            </dt>
            <dd className="font-mono font-bold text-foreground print:text-black">
              {invoice.invoice_number}
            </dd>
          </div>
          <div className="flex gap-6 sm:justify-end">
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground print:text-black/50">
              Date
            </dt>
            <dd className="text-foreground print:text-black">
              {formatInvoiceDate(invoice)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function SoldToBlock({ customer }: { customer: CustomerInfo | null }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4 text-sm print:rounded-none print:border-foreground/20 print:bg-transparent print:p-2">
      <p className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground print:text-black/50">
        Sold To
      </p>
      {customer ? (
        <address className="not-italic leading-relaxed text-foreground print:text-black">
          {customer.full_name && <p className="font-medium">{customer.full_name}</p>}
          {customer.addressLabel && (
            <p className="whitespace-pre-line">{customer.addressLabel}</p>
          )}
          {customer.phone && <p>{customer.phone}</p>}
        </address>
      ) : (
        <p className="text-muted-foreground print:text-black/50">
          Customer information not available
        </p>
      )}
    </div>
  )
}

// Keep InvoiceMeta for the screen-only internal view (hidden on print)
function InvoiceMeta({ invoice }: { invoice: InvoiceWithLineItems }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="type-label text-muted-foreground">Invoice number</dt>
        <dd className="font-mono font-medium text-foreground">
          {invoice.invoice_number}
        </dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Status</dt>
        <dd>
          <StatusBadge kind="invoice-status" value={invoice.status} />
        </dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Type</dt>
        <dd>
          <StatusBadge kind="invoice-type" value={invoice.invoice_type} />
        </dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Created</dt>
        <dd className="text-foreground">{formatDateTime(invoice.created_at)}</dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Issued</dt>
        <dd className="text-foreground">{formatDate(invoice.issued_at)}</dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Job</dt>
        <dd>
          {invoice.job_id ? (
            <Link
              href={`/dashboard/jobs/${invoice.job_id}`}
              className="font-mono text-xs underline-offset-4 hover:text-primary hover:underline"
            >
              {invoice.job_id}
            </Link>
          ) : (
            '—'
          )}
        </dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Customer ID</dt>
        <dd className="font-mono text-xs text-foreground">
          {invoice.customer_id ?? '—'}
        </dd>
      </div>
    </dl>
  )
}

function WarrantyTerms() {
  return (
    <div className="mt-6 border-t border-border pt-3 text-[10px] leading-snug text-muted-foreground print:border-foreground/20 print:text-black/60">
      <p>
        <strong className="text-foreground print:text-black">Pickup:</strong> Purchased or repaired appliances must be picked up within one week of the invoice date.{' '}
        <strong className="text-foreground print:text-black">Warranty:</strong> Washers, dryers, and stoves carry a 30-day warranty from the date of purchase. If the appliance stops working within that period, we will send a technician to diagnose it first and will repair or replace it at our discretion.{' '}
        <strong className="text-foreground print:text-black">Service area:</strong> Technician visits are available within Salt Lake County; outside that area, you are responsible for bringing the appliance to our store.{' '}
        <strong className="text-foreground print:text-black">Refunds:</strong> If a claim can't be resolved by repair or replacement, you'll receive a 75% refund or, at your preference, full store credit. Delivery and installation/removal are non-refundable.{' '}
        <strong className="text-foreground print:text-black">Liability:</strong> This warranty excludes damage from misuse, third-party installation, or customer negligence. We are not responsible for pre-existing damage, or for flooding or property damage. We are not responsible for issues caused by the home's existing plumbing, electrical, or drainage, including floor drains, standpipes, or venting that are missing, undersized, blocked, or otherwise not functioning properly. If we identify unsafe or improper drainage, venting, or electrical conditions at the time of service, we may decline to complete installation; you will be responsible for correcting these conditions before installation can proceed.{' '}
      </p>
      <p className="pt-1 italic">
        By accepting this receipt, you acknowledge and agree to the terms above.
      </p>
    </div>
  )
}

function ReceiptFooter() {
  return (
    <div className="mt-8 space-y-4 border-t border-border pt-6 print:mt-0 print:space-y-2 print:border-foreground/20 print:pt-3">
      <p className="text-sm text-muted-foreground print:text-black/60">
        Sign: <span className="inline-block w-48 border-b border-current" />
      </p>
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-foreground print:text-black">
        Thank you for your business!
      </p>
    </div>
  )
}

function LineItemsTable({ lineItems }: { lineItems: InvoiceLineItem[] }) {
  if (lineItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items on this invoice.</p>
    )
  }

  return (
    <div className="invoice-print-items overflow-x-auto rounded-md border border-border print:overflow-hidden print:rounded-none print:border-foreground/20">
      <table className="w-full text-sm print:text-[inherit]" aria-label="Invoice line items">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left print:bg-transparent">
            <th scope="col" className="px-4 py-2 font-medium print:px-2 print:py-1">
              Kind
            </th>
            <th scope="col" className="px-4 py-2 font-medium print:px-2 print:py-1">
              Description
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right print:px-2 print:py-1">
              Qty
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right print:px-2 print:py-1">
              Unit price
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right print:px-2 print:py-1">
              Line total
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line) => (
            <tr
              key={line.id}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-3 text-foreground print:px-2 print:py-1">
                {LINE_KIND_LABELS[line.kind]}
              </td>
              <td className="px-4 py-3 text-foreground print:px-2 print:py-1">{lineDescription(line)}</td>
              <td className="px-4 py-3 text-right tabular-nums print:px-2 print:py-1">{line.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums print:px-2 print:py-1">
                {formatMoney(line.unit_price)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium print:px-2 print:py-1">
                {formatMoney(line.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TotalsBlock({ invoice }: { invoice: InvoiceWithLineItems }) {
  const computedTaxableSubtotal = sumTaxableLineTotals(invoice.line_items)
  const nonTaxableFees = sumNonTaxableFees(invoice.line_items)
  const paymentMethodLabel = invoice.payment_method
    ? PAYMENT_METHOD_LABELS[invoice.payment_method]
    : null

  return (
    <div className="ml-auto w-full max-w-xs space-y-2 text-sm print:max-w-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums font-medium text-foreground">
          {formatMoney(invoice.subtotal)}
        </span>
      </div>
      {computedTaxableSubtotal !== invoice.subtotal ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 print:hidden">
          Taxable line items sum to {formatMoney(computedTaxableSubtotal)} (stored
          subtotal differs).
        </p>
      ) : null}
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Tax ({(TAX_RATE * 100).toFixed(2)}%)</span>
        <span className="tabular-nums text-foreground">
          {formatMoney(invoice.tax)}
        </span>
      </div>
      {nonTaxableFees > 0 ? (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Non-taxable fees</span>
          <span className="tabular-nums text-foreground">
            {formatMoney(nonTaxableFees)}
          </span>
        </div>
      ) : null}
      {invoice.surcharge > 0 ? (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Credit card surcharge (3%)</span>
          <span className="tabular-nums text-foreground">
            {formatMoney(invoice.surcharge)}
          </span>
        </div>
      ) : null}
      <div className="flex justify-between gap-4 border-t border-border pt-2 text-base print:border-foreground/30">
        <span className="font-semibold text-foreground">Total</span>
        <span className="tabular-nums font-semibold text-foreground">
          {formatMoney(invoice.total)}
        </span>
      </div>
      {paymentMethodLabel ? (
        <p className="text-xs text-muted-foreground print:text-black/60">
          Payment method: {paymentMethodLabel}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground print:hidden">
        Total = subtotal + tax + non-taxable fees + surcharge (
        {formatMoney(
          invoice.subtotal + invoice.tax + nonTaxableFees + invoice.surcharge,
        )}
        )
      </p>
    </div>
  )
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const invoice = await getInvoiceById(id)

  if (!invoice) {
    notFound()
  }

  const customerRecord = invoice.customer_id
    ? await getCustomerById(invoice.customer_id).catch(() => null)
    : null
  const customer = customerRecord ? toCustomerInfo(customerRecord) : null

  return (
    <div className="space-y-8">
      {/* Screen-only header + controls */}
      <div className="print:hidden">
        <PageHeader
          title={invoice.invoice_number}
          description="Invoice detail and print view"
          actions={
            <div className="flex flex-wrap gap-2">
              <PrintPageButton />
              <Button variant="outline" asChild>
                <Link href="/dashboard/invoices">Back to list</Link>
              </Button>
            </div>
          }
        />
      </div>

      <div className="print:hidden">
        <InvoiceStatusControls invoiceId={invoice.id} status={invoice.status} />
      </div>

      {/* Screen-only internal meta (type, appliance ID, etc.) */}
      <div className="print:hidden rounded-lg border border-border bg-card p-6 shadow-sm">
        <InvoiceMeta invoice={invoice} />
      </div>

      {/* Print / customer receipt */}
      <InvoicePrintDocument lineItemCount={invoice.line_items.length}>
        <div className="invoice-print-header space-y-4 print:space-y-3">
          <header className="border-b border-border pb-6 print:border-foreground/20 print:pb-3">
            <ReceiptHeader invoice={invoice} />
          </header>
          <SoldToBlock customer={customer} />
        </div>

        <div className="invoice-print-body">
          <LineItemsTable lineItems={invoice.line_items} />
          <section className="border-t border-border pt-4 print:border-foreground/20 print:pt-2">
            <TotalsBlock invoice={invoice} />
          </section>
          <WarrantyTerms />
        </div>

        <div className="invoice-print-footer">
          <ReceiptFooter />
        </div>
      </InvoicePrintDocument>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Record</CardTitle>
          <CardDescription>Internal identifiers</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-xs text-muted-foreground">{invoice.id}</p>
        </CardContent>
      </Card>
    </div>
  )
}