'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Inventory', href: '/dashboard/inventory' },
  { label: 'Parts', href: '/dashboard/parts' },
  { label: 'Jobs', href: '/dashboard/jobs' },
  { label: 'Invoices', href: '/dashboard/invoices' },
] as const

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function DashboardNavbar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard navigation" className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const isActive = isNavActive(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/80 active:shadow-none'
                : [
                    'text-muted-foreground',
                    'hover:bg-accent hover:text-accent-foreground',
                    'active:bg-accent/80 active:text-accent-foreground',
                  ],
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
