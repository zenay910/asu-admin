import Link from 'next/link'
import { Button } from '@/components/ui/button'
import InventoryForm from './inventory-form'

export default function NewInventoryPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Add Inventory Item
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fill out the form below to add a new item.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
          <InventoryForm />

          <div className="flex items-center gap-3 pt-4">
            <Button asChild variant="outline" type="button">
              <Link href="/dashboard">Cancel</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
