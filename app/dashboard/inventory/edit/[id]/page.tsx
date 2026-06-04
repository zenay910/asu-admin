import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteApplianceDialog } from '@/components/delete-appliance-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { getApplianceDetailById } from '@/lib/data/appliances'
import type { Appliance, ApplianceImage } from '@/lib/types/inventory'
import EditInventoryForm from '../edit-form'

export const dynamic = 'force-dynamic'

function formatDimensionsForForm(
  dimensions: Appliance['dimensions'],
): string {
  if (!dimensions) return ''
  return JSON.stringify(dimensions)
}

function formatFeaturesForForm(features: Appliance['features']): string {
  if (!features?.length) return ''
  return features.join(', ')
}

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getApplianceDetailById(id)

  if (!detail) {
    notFound()
  }

  const { appliance, images } = detail

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit appliance"
        description="Updates the appliance and mirrored products row."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/inventory/${appliance.id}`}>View</Link>
            </Button>
            <DeleteApplianceDialog applianceId={appliance.id} />
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <EditInventoryForm
          applianceId={appliance.id}
          lifecycleState={appliance.lifecycle_state}
          initialAppliance={{
            title: appliance.title,
            brand: appliance.brand,
            price: appliance.price,
            model_number: appliance.model_number,
            condition: appliance.condition,
            status: appliance.status,
            type: appliance.type,
            configuration: appliance.configuration,
            unit_type: appliance.unit_type,
            fuel: appliance.fuel,
            color: appliance.color,
            capacity: appliance.capacity,
            age: appliance.age,
            description_long: appliance.description_long,
            dimensions: formatDimensionsForForm(appliance.dimensions),
            features: formatFeaturesForForm(appliance.features),
            appliance_images: images.map((image: ApplianceImage) => ({
              id: image.id,
              photo_url: image.photo_url,
            })),
          }}
        />
      </div>
    </div>
  )
}
