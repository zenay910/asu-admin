import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import JobForm from './job-form'

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New job"
        description="Creates a work order via POST /api/jobs with class↔type validation."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/jobs">Back to list</Link>
          </Button>
        }
      />
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <JobForm />
      </div>
    </div>
  )
}
