import Link from 'next/link'
import { Button } from '@/components/ui/button'
import InventoryForm from './inventory-form'

export const maxDuration = 60

export default function NewInventoryPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Add Inventory Item
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fill out the form below to add a new item.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
        <InventoryForm />

        <div className="flex items-center gap-3 pt-4">
          <Button asChild variant="outline" type="button">
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
