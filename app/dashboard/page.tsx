import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { logout } from '../actions'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              ASU Admin Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {data.user.email}
              </span>
              <form action={logout}>
                <Button variant="outline" type="submit">
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Dashboard Cards */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Welcome
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You&apos;re logged in as an administrator. This is your dashboard where you can manage all aspects of the system.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Quick Stats
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Add your statistics and metrics here.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Recent Activity
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              View recent system activity here.
            </p>
          </div>

          <Link
            href="/dashboard/inventory/new"
            className="block bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Add Inventory
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Add new inventory items to the system.
            </p>
          </Link>
        </div>
      </main>
    </div>
  )
}
