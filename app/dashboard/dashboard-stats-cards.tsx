import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageErrorAlert } from '@/components/page-error-alert'
import { getDashboardStats } from '@/lib/data/dashboard-stats'
import { formatMoney } from '@/lib/format'
import type { LifecycleState } from '@/lib/types/inventory'

const LIFECYCLE_ORDER: readonly LifecycleState[] = [
  'Intake',
  'Refurbishment',
  'Listed',
  'Retired',
]

export async function DashboardStatsCards() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>>
  try {
    stats = await getDashboardStats()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load dashboard stats'
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">At a glance</h2>
        <PageErrorAlert message={message} />
      </div>
    )
  }

  const applianceTotal = LIFECYCLE_ORDER.reduce(
    (sum, state) => sum + stats.appliancesByLifecycle[state],
    0,
  )

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">At a glance</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Appliances"
          value={String(applianceTotal)}
          description="By lifecycle stage"
          href="/dashboard/inventory"
          detail={
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {LIFECYCLE_ORDER.map((state) => (
                <li key={state} className="flex justify-between gap-2">
                  <span>{state}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {stats.appliancesByLifecycle[state]}
                  </span>
                </li>
              ))}
            </ul>
          }
        />
        <StatCard
          title="Low-stock parts"
          value={String(stats.lowStockPartsCount)}
          description="qty on hand ≤ reorder threshold"
          href="/dashboard/parts"
        />
        <StatCard
          title="Open jobs"
          value={String(stats.openJobsCount)}
          description="Not Closed"
          href="/dashboard/jobs"
        />
        <StatCard
          title="Draft invoices"
          value={String(stats.draftInvoicesCount)}
          description="Awaiting issue"
          href="/dashboard/invoices"
        />
        <StatCard
          title="Issued invoices"
          value={String(stats.issuedInvoicesCount)}
          description="Outstanding billing"
          href="/dashboard/invoices"
        />
        <StatCard
          title="Revenue"
          value={formatMoney(stats.revenueTotal)}
          description="Sum of Issued + Paid totals"
          href="/dashboard/invoices"
        />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  href,
  detail,
}: {
  title: string
  value: string
  description: string
  href: string
  detail?: ReactNode
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
          {detail}
        </CardContent>
      </Card>
    </Link>
  )
}
