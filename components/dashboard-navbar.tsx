'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Add Inventory', href: '/dashboard/inventory/new' },
  { label: 'Inventory', href: '/dashboard/inventory/view' },
]

export default function DashboardNavbar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard navigation" className="flex items-center gap-2">
      {navItems.map((item) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
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
