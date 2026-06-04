import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageErrorAlert } from '@/components/page-error-alert'
import {
  getRecentDashboardActivity,
  type DashboardActivityItem,
  type DashboardActivityKind,
} from '@/lib/data/dashboard-activity'
import { formatDateTime } from '@/lib/format'

const KIND_LABELS: Record<DashboardActivityKind, string> = {
  job_created: 'Job',
  invoice_created: 'Invoice',
  job_state_change: 'Job state',
  appliance_state_change: 'Appliance lifecycle',
}

export async function DashboardRecentActivity() {
  let activity: Awaited<ReturnType<typeof getRecentDashboardActivity>>
  try {
    activity = await getRecentDashboardActivity()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load recent activity'
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <PageErrorAlert message={message} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Latest jobs, invoices, and state changes (newest first).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent activity yet.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {activity.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {KIND_LABELS[item.kind]}
        </p>
        <Link
          href={item.href}
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {item.title}
        </Link>
        <p className="text-sm text-muted-foreground">{item.detail}</p>
      </div>
      <time
        dateTime={item.created_at}
        className="shrink-0 text-xs text-muted-foreground tabular-nums"
      >
        {formatDateTime(item.created_at)}
      </time>
    </li>
  )
}
