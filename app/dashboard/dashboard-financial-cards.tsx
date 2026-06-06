'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/format'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { useFinancialSummary } from '@/lib/hooks/use-financial-summary'

function FinancialCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-8 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  )
}

function FinancialCard({
  title,
  value,
  description,
  href,
}: {
  title: string
  value: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-colors hover:border-primary/60">
        <CardHeader className="pb-2">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function DashboardFinancialCards() {
  const { summary, loading, error } = useFinancialSummary()

  useFetchErrorToast(error, 'Financial summary')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Financial pulse</h2>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinancialCardSkeleton />
          <FinancialCardSkeleton />
          <FinancialCardSkeleton />
          <FinancialCardSkeleton />
        </div>
      ) : error || !summary ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinancialCard
            title="Revenue"
            value={formatMoney(summary.revenueTotal)}
            description="Issued + Paid invoice totals"
            href="/dashboard/invoices"
          />
          <FinancialCard
            title="Outstanding"
            value={formatMoney(summary.outstandingTotal)}
            description={`${summary.outstandingCount} issued invoice${summary.outstandingCount === 1 ? '' : 's'} unpaid`}
            href="/dashboard/invoices"
          />
          <FinancialCard
            title="Parts cost"
            value={formatMoney(summary.partsCostTotal)}
            description="Σ qty on hand × unit cost"
            href="/dashboard/parts"
          />
          <FinancialCard
            title="Inventory value"
            value={formatMoney(summary.inventoryValueTotal)}
            description="Non-retired appliances + parts cost"
            href="/dashboard/inventory/view"
          />
        </div>
      )}
    </div>
  )
}
