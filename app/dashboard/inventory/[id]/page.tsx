import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ApplianceLifecycleControls } from '@/components/appliance-lifecycle-controls'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getApplianceDetailById } from '@/lib/data/appliances'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { Appliance, ApplianceDimensions } from '@/lib/types/inventory'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

function formatDimensions(dimensions: ApplianceDimensions | null): string {
  if (!dimensions) return '—'
  const parts: string[] = []
  if (dimensions.width_in != null) parts.push(`W ${dimensions.width_in}"`)
  if (dimensions.depth_in != null) parts.push(`D ${dimensions.depth_in}"`)
  if (dimensions.height_in != null) parts.push(`H ${dimensions.height_in}"`)
  if (parts.length === 0) return '—'
  const unit = dimensions.unit_of_measure ? ` (${dimensions.unit_of_measure})` : ''
  return parts.join(' × ') + unit
}

function formatFeatures(features: string[] | null): string {
  if (!features?.length) return '—'
  return features.join(', ')
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,10rem)_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}

function buildSpecRows(appliance: Appliance): Array<{ label: string; value: string }> {
  return [
    { label: 'Brand', value: appliance.brand || '—' },
    { label: 'Model', value: appliance.model_number || '—' },
    { label: 'Type', value: appliance.type || '—' },
    { label: 'Configuration', value: appliance.configuration || '—' },
    { label: 'Unit type', value: appliance.unit_type || '—' },
    { label: 'Fuel', value: appliance.fuel || '—' },
    { label: 'Condition', value: appliance.condition || '—' },
    { label: 'Color', value: appliance.color || '—' },
    {
      label: 'Capacity',
      value: appliance.capacity != null ? String(appliance.capacity) : '—',
    },
    {
      label: 'Age',
      value: appliance.age != null ? `${appliance.age} yr` : '—',
    },
    { label: 'Dimensions', value: formatDimensions(appliance.dimensions) },
    { label: 'Features', value: formatFeatures(appliance.features) },
    { label: 'Price', value: formatMoney(appliance.price) },
    { label: 'Created', value: formatDateTime(appliance.created_at) },
    { label: 'Updated', value: formatDateTime(appliance.updated_at) },
    { label: 'ID', value: appliance.id },
  ]
}

export default async function ApplianceDetailPage({ params }: PageProps) {
  const { id } = await params
  const detail = await getApplianceDetailById(id)

  if (!detail) {
    notFound()
  }

  const { appliance, images, stateHistory } = detail

  return (
    <div className="space-y-8">
      <PageHeader
        title={appliance.title || appliance.model_number || 'Appliance'}
        description={[appliance.brand, appliance.model_number]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/view">Back to list</Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/inventory/edit/${appliance.id}`}>Edit</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="lifecycle-state" value={appliance.lifecycle_state} />
        <StatusBadge kind="appliance-status" value={appliance.status} />
      </div>

      <ApplianceLifecycleControls
        applianceId={appliance.id}
        lifecycleState={appliance.lifecycle_state}
        status={appliance.status}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Images</CardTitle>
            <CardDescription>
              {images.length
                ? `${images.length} photo${images.length === 1 ? '' : 's'}`
                : 'No images on file'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((image) => (
                  <a
                    key={image.id}
                    href={image.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-md border border-border bg-muted transition-shadow hover:shadow-md"
                  >
                    <Image
                      src={image.photo_url}
                      alt={`${appliance.title} photo`}
                      width={320}
                      height={320}
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {appliance.description_long?.trim() || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            {buildSpecRows(appliance).map((row) => (
              <SpecRow key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle history</CardTitle>
          <CardDescription>
            Ordered state transitions (newest last)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stateHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lifecycle transitions recorded yet.
            </p>
          ) : (
            <ol className="border-l border-border pl-6">
              {stateHistory.map((entry) => (
                <li key={entry.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                      {entry.from_state ? (
                        <>
                          <StatusBadge
                            kind="lifecycle-state"
                            value={entry.from_state}
                          />
                          <span className="text-muted-foreground">→</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Initial →</span>
                      )}
                      <StatusBadge
                        kind="lifecycle-state"
                        value={entry.to_state}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
