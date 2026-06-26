import Link from 'next/link'
import { notFound } from 'next/navigation'
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
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import type { InvoiceLineItem, LineItemKind } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
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

function sumLineTotals(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((sum, line) => sum + line.line_total, 0)
}

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
              className="font-mono text-xs underline-offset-4 hover:text-primary hover:underline print:text-foreground print:no-underline"
            >
              {invoice.job_id}
            </Link>
          ) : (
            '—'
          )}
        </dd>
      </div>
      <div>
        <dt className="type-label text-muted-foreground">Appliance</dt>
        <dd>
          {invoice.appliance_id ? (
            <Link
              href={`/dashboard/inventory/${invoice.appliance_id}`}
              className="font-mono text-xs underline-offset-4 hover:text-primary hover:underline print:text-foreground print:no-underline"
            >
              {invoice.appliance_id}
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

function LineItemsTable({ lineItems }: { lineItems: InvoiceLineItem[] }) {
  if (lineItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items on this invoice.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border print:overflow-visible print:rounded-none print:border-foreground/20">
      <table className="w-full text-sm" aria-label="Invoice line items">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left print:bg-transparent">
            <th scope="col" className="px-4 py-2 font-medium">
              Kind
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Description
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right">
              Qty
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right">
              Unit price
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right">
              Line total
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line) => (
            <tr
              key={line.id}
              className="border-b border-border last:border-0 print:break-inside-avoid"
            >
              <td className="px-4 py-3 text-foreground">
                {LINE_KIND_LABELS[line.kind]}
              </td>
              <td className="px-4 py-3 text-foreground">{lineDescription(line)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatMoney(line.unit_price)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
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
  const computedSubtotal = sumLineTotals(invoice.line_items)

  return (
    <div className="ml-auto w-full max-w-xs space-y-2 text-sm print:max-w-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums font-medium text-foreground">
          {formatMoney(invoice.subtotal)}
        </span>
      </div>
      {computedSubtotal !== invoice.subtotal ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 print:text-foreground">
          Line items sum to {formatMoney(computedSubtotal)} (stored subtotal differs).
        </p>
      ) : null}
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Tax</span>
        <span className="tabular-nums text-foreground">
          {formatMoney(invoice.tax)}
        </span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-2 text-base print:border-foreground/30">
        <span className="font-semibold text-foreground">Total</span>
        <span className="tabular-nums font-semibold text-foreground">
          {formatMoney(invoice.total)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground print:text-foreground/80">
        Total = subtotal + tax ({formatMoney(invoice.subtotal + invoice.tax)})
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

  return (
    <div className="space-y-8">
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

      <article className="invoice-print-document space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none print:text-black">
        <header className="space-y-4 border-b border-border pb-6 print:border-foreground/20 print:pb-4">
          <div className="hidden print:block">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground print:text-black/70">
              ASU Admin · Invoice
            </p>
            <h1 className="mt-1 font-mono text-2xl font-semibold text-foreground print:text-black">
              {invoice.invoice_number}
            </h1>
          </div>
          <InvoiceMeta invoice={invoice} />
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground print:text-black">
            Line items
          </h2>
          <LineItemsTable lineItems={invoice.line_items} />
        </section>

        <section className="border-t border-border pt-6 print:border-foreground/20 print:pt-4">
          <TotalsBlock invoice={invoice} />
        </section>
      </article>

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
