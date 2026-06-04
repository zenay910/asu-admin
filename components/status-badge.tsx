import { Badge, type BadgeProps } from '@/components/ui/badge'
import type {
  ApplianceStatus,
  LifecycleState,
  PartStatus,
} from '@/lib/types/inventory'
import type {
  InvoiceStatus,
  InvoiceType,
  JobClass,
  JobState,
  JobType,
} from '@/lib/types/operations'
import { cn } from '@/lib/utils'

export type StatusBadgeKind =
  | 'appliance-status'
  | 'lifecycle-state'
  | 'part-status'
  | 'job-state'
  | 'job-class'
  | 'job-type'
  | 'invoice-status'
  | 'invoice-type'

type StatusBadgeProps = {
  kind: StatusBadgeKind
  value: string | null | undefined
  className?: string
}

type StyleConfig = {
  variant: BadgeProps['variant']
  className?: string
  label?: string
}

const applianceStatusStyles: Record<ApplianceStatus, StyleConfig> = {
  Draft: { variant: 'secondary' },
  Published: {
    variant: 'outline',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  Sold: {
    variant: 'outline',
    className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  Archived: { variant: 'outline', className: 'text-muted-foreground' },
}

const partStatusStyles: Record<PartStatus, StyleConfig> = {
  Active: {
    variant: 'outline',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  Discontinued: { variant: 'outline', className: 'text-muted-foreground' },
}

const lifecycleStateStyles: Record<LifecycleState, StyleConfig> = {
  Intake: { variant: 'secondary' },
  Refurbishment: {
    variant: 'outline',
    className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
  },
  Listed: {
    variant: 'outline',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  Retired: { variant: 'outline', className: 'text-muted-foreground' },
}

const jobStateStyles: Record<JobState, StyleConfig> = {
  Open: { variant: 'secondary' },
  'In Progress': {
    variant: 'outline',
    className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
  },
  Completed: {
    variant: 'outline',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  Closed: { variant: 'outline', className: 'text-muted-foreground' },
}

const jobClassStyles: Record<JobClass, StyleConfig> = {
  Internal: { variant: 'secondary' },
  Customer: {
    variant: 'outline',
    className: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
  },
}

const jobTypeStyles: Record<JobType, StyleConfig> = {
  Intake: { variant: 'secondary' },
  Diagnostic: { variant: 'outline' },
  Repair: { variant: 'outline' },
  Cleaning: { variant: 'outline' },
  Delivery: { variant: 'outline' },
  Installation: { variant: 'outline' },
  Maintenance: { variant: 'outline' },
  Warranty: { variant: 'outline' },
}

const invoiceStatusStyles: Record<InvoiceStatus, StyleConfig> = {
  Draft: { variant: 'secondary' },
  Issued: {
    variant: 'outline',
    className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
  },
  Paid: {
    variant: 'outline',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  Void: { variant: 'destructive' },
}

const invoiceTypeLabels: Record<InvoiceType, string> = {
  job: 'Job',
  appliance_sale: 'Appliance sale',
  retail: 'Retail',
}

const invoiceTypeStyles: Record<InvoiceType, StyleConfig> = {
  job: { variant: 'secondary', label: invoiceTypeLabels.job },
  appliance_sale: {
    variant: 'outline',
    className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
    label: invoiceTypeLabels.appliance_sale,
  },
  retail: {
    variant: 'outline',
    className: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
    label: invoiceTypeLabels.retail,
  },
}

function resolveStyle(
  kind: StatusBadgeKind,
  value: string,
): StyleConfig | undefined {
  switch (kind) {
    case 'appliance-status':
      return applianceStatusStyles[value as ApplianceStatus]
    case 'lifecycle-state':
      return lifecycleStateStyles[value as LifecycleState]
    case 'part-status':
      return partStatusStyles[value as PartStatus]
    case 'job-state':
      return jobStateStyles[value as JobState]
    case 'job-class':
      return jobClassStyles[value as JobClass]
    case 'job-type':
      return jobTypeStyles[value as JobType]
    case 'invoice-status':
      return invoiceStatusStyles[value as InvoiceStatus]
    case 'invoice-type':
      return invoiceTypeStyles[value as InvoiceType]
    default:
      return undefined
  }
}

export function StatusBadge({ kind, value, className }: StatusBadgeProps) {
  if (value == null || value === '') {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground', className)}>
        —
      </Badge>
    )
  }

  const style = resolveStyle(kind, value) ?? { variant: 'outline' as const }
  const label = style.label ?? value

  return (
    <Badge
      variant={style.variant}
      className={cn(style.className, className)}
    >
      {label}
    </Badge>
  )
}
