import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage inventory and monitor activity from one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;re logged in as an administrator. Use this dashboard to
            keep operations moving.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Quick Stats
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Add your statistics and metrics here.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent Activity
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            View recent system activity here.
          </p>
        </div>

        <Link
          href="/dashboard/inventory/new"
          className="block rounded-lg border border-zinc-200 bg-white p-6 shadow-md transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Add Inventory
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Add new inventory items to the system.
          </p>
        </Link>

        <Link
          href="/dashboard/inventory/view"
          className="block rounded-lg border border-zinc-200 bg-white p-6 shadow-md transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            See Current Inventory
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Edit and delete inventory items in the system.
          </p>
        </Link>
      </div>
    </div>
  )
}
