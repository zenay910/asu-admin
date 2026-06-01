import Link from 'next/link'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import {
  ClipboardList,
  Package,
  Receipt,
  Wrench,
} from 'lucide-react'

const sections = [
  {
    title: 'Inventory',
    description: 'Appliances, lifecycle states, and storefront parity.',
    href: '/dashboard/inventory',
    icon: Package,
  },
  {
    title: 'Parts',
    description: 'Stock levels, adjustments, and appliance compatibility.',
    href: '/dashboard/parts',
    icon: Wrench,
  },
  {
    title: 'Jobs',
    description: 'Internal refurbishment and customer-facing work orders.',
    href: '/dashboard/jobs',
    icon: ClipboardList,
  },
  {
    title: 'Invoices',
    description: 'Job, appliance-sale, and retail billing documents.',
    href: '/dashboard/invoices',
    icon: Receipt,
  },
] as const

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Jump to an operational area."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-md group-active:translate-y-0 group-active:border-primary group-active:shadow-sm">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-active:bg-primary/90 group-active:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
