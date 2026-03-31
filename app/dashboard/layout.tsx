import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import DashboardNavbar from '@/components/dashboard-navbar'
import { logout } from '@/app/actions'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              ASU Admin
            </Link>
            <DashboardNavbar />
          </div>

          <div className="flex items-center gap-3">
            <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
              {data.user.email}
            </span>
            <form action={logout}>
              <Button variant="outline" type="submit">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  )
}
