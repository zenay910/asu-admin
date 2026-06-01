'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
