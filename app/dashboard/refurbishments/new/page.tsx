import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import RefurbishmentIntakeForm from './refurbishment-intake-form'

export const maxDuration = 60

export default function NewRefurbishmentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Refurbishment intake"
        description="Add a unit entering the active bay workflow. Specs are AI-assisted; retail price and publish status are set later."
        actions={
          <Button asChild variant="outline" type="button">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <RefurbishmentIntakeForm />
      </div>
    </div>
  )
}
