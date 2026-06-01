import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import DashboardNavbar from '@/components/dashboard-navbar'
import { logout } from '@/app/actions'
import { createClient } from '@/lib/supabase/server'

// Configure body size limit for image uploads via Server Actions
export const maxDuration = 60

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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-sm text-lg font-semibold text-foreground transition-colors duration-150 hover:text-primary active:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              ASU Admin
            </Link>
            <DashboardNavbar />
          </div>

          <div className="flex items-center gap-3">
            <span className="truncate text-sm text-muted-foreground">
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
      <Toaster richColors closeButton />
    </div>
    </ThemeProvider>
  )
}
