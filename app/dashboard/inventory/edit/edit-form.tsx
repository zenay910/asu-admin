'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { compressImagesForUpload } from '@/lib/images/compress'
import type { LifecycleState } from '@/lib/types/inventory'
import {
  removeApplianceImage,
  updateInventoryItem,
} from './actions'
import {
  initialInventoryFormState,
  type InventoryFormValues,
  type InventoryFormState,
} from '../new/types'

type InitialAppliance = {
  title: string
  brand: string
  price: number
  model_number: string
  condition: string | null
  status: string | null
  type: string | null
  configuration: string | null
  unit_type: string | null
  fuel: string | null
  color: string | null
  capacity: number | null
  age: number | null
  dimensions: string
  features: string
  description_long: string | null
  appliance_images?: Array<{ id: string; photo_url: string }>
}

function toInitialValues(appliance?: InitialAppliance): InventoryFormValues {
  if (!appliance) {
    return initialInventoryFormState.values
  }

  return {
    title: appliance.title || '',
    brand: appliance.brand || '',
    model_number: appliance.model_number || '',
    type: appliance.type || '',
    configuration: appliance.configuration || '',
    unit_type: appliance.unit_type || '',
    fuel: appliance.fuel || '',
    condition: appliance.condition || 'Good',
    status: appliance.status || 'Draft',
    price: appliance.price?.toString() || '',
    color: appliance.color || '',
    capacity: appliance.capacity?.toString() || '',
    age: appliance.age?.toString() || '',
    dimensions: appliance.dimensions || '',
    features: appliance.features || '',
    description_long: appliance.description_long || '',
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
}

function handleFieldInvalid(e: React.FormEvent<HTMLInputElement>) {
  const fieldLabel = e.currentTarget.dataset.label || 'this field'

  if (e.currentTarget.validity.valueMissing) {
    e.currentTarget.setCustomValidity(`Please enter ${fieldLabel.toLowerCase()}.`)
    return
  }

  if (e.currentTarget.validity.badInput) {
    e.currentTarget.setCustomValidity(`Please enter a valid ${fieldLabel.toLowerCase()}.`)
    return
  }

  if (e.currentTarget.name === 'price') {
    if (e.currentTarget.validity.rangeUnderflow) {
      e.currentTarget.setCustomValidity('Price must be 0 or greater.')
      return
    }
    if (e.currentTarget.validity.stepMismatch) {
      e.currentTarget.setCustomValidity('Price must use up to 2 decimal places (e.g. 199.99).')
      return
    }
  }

  e.currentTarget.setCustomValidity('Please check this field and try again.')
}

function clearFieldValidity(e: React.FormEvent<HTMLInputElement>) {
  e.currentTarget.setCustomValidity('')
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Updating...' : 'Save changes'}
    </Button>
  )
}

export default function EditInventoryForm({
  applianceId,
  lifecycleState,
  initialAppliance,
}: {
  applianceId: string
  lifecycleState: LifecycleState
  initialAppliance?: InitialAppliance
}) {
  const router = useRouter()
  const initialValues = toInitialValues(initialAppliance)
  const [state, formAction] = useActionState(
    (prevState: InventoryFormState, formData: FormData) =>
      updateInventoryItem(prevState, formData, applianceId),
    {
      ...initialInventoryFormState,
      values: initialValues,
    },
  )
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState<
    Array<{ id: string; url: string }>
  >(
    () =>
      initialAppliance?.appliance_images?.map((img) => ({
        id: img.id,
        url: img.photo_url,
      })) ?? [],
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [removingImageId, setRemovingImageId] = useState<string | null>(null)
  const [, startRemoveTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || [])
    setUploadError(null)
    if (files.length === 0) {
      setImageFiles([])
      return
    }
    try {
      const compressed = await compressImagesForUpload(files)
      setImageFiles(compressed)
    } catch {
      setImageFiles(files)
    }
  }

  const handleClearImages = () => {
    setImageFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveExistingImage = (imageId: string) => {
    setUploadError(null)
    setRemovingImageId(imageId)
    startRemoveTransition(async () => {
      try {
        await removeApplianceImage(imageId)
        setExistingImages((prev) => prev.filter((img) => img.id !== imageId))
        toast.success('Image removed')
        router.refresh()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to remove image'
        setUploadError(message)
        toast.error(message)
      } finally {
        setRemovingImageId(null)
      }
    })
  }

  const handleFormAction = async (formData: FormData) => {
    formData.delete('images')
    for (const file of imageFiles) {
      formData.append('images', file)
    }
    formAction(formData)
  }

  const canPublish = lifecycleState === 'Listed'

  return (
    <form action={handleFormAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      {uploadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {uploadError}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.success}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          data-label="Title"
          placeholder="e.g. Whirlpool Washer"
          defaultValue={state.values.title}
          aria-invalid={Boolean(state.fieldErrors.title)}
          onInvalid={handleFieldInvalid}
          onInput={clearFieldValidity}
        />
        <FieldError message={state.fieldErrors.title} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            name="brand"
            placeholder="e.g. Whirlpool"
            defaultValue={state.values.brand}
            aria-invalid={Boolean(state.fieldErrors.brand)}
          />
          <FieldError message={state.fieldErrors.brand} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model_number">Model Number</Label>
          <Input
            id="model_number"
            name="model_number"
            placeholder="e.g. WFW5605MW"
            defaultValue={state.values.model_number}
            aria-invalid={Boolean(state.fieldErrors.model_number)}
          />
          <FieldError message={state.fieldErrors.model_number} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Input
            id="type"
            name="type"
            list="type-options"
            placeholder="e.g. Washer"
            defaultValue={state.values.type}
            aria-invalid={Boolean(state.fieldErrors.type)}
          />
          <FieldError message={state.fieldErrors.type} />
          <datalist id="type-options">
            <option value="Washer" />
            <option value="Dryer" />
            <option value="Refrigerator" />
            <option value="Range" />
            <option value="Dishwasher" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="configuration">Configuration</Label>
          <Input
            id="configuration"
            name="configuration"
            list="configuration-options"
            defaultValue={state.values.configuration}
            aria-invalid={Boolean(state.fieldErrors.configuration)}
          />
          <FieldError message={state.fieldErrors.configuration} />
          <datalist id="configuration-options">
            <option value="Front Load" />
            <option value="Top Load" />
            <option value="Stacked Unit" />
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit_type">Unit Type</Label>
          <Input
            id="unit_type"
            name="unit_type"
            list="unit-type-options"
            defaultValue={state.values.unit_type}
            aria-invalid={Boolean(state.fieldErrors.unit_type)}
          />
          <FieldError message={state.fieldErrors.unit_type} />
          <datalist id="unit-type-options">
            <option value="Individual" />
            <option value="Set" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuel">Fuel</Label>
          <Input
            id="fuel"
            name="fuel"
            list="fuel-options"
            defaultValue={state.values.fuel}
            aria-invalid={Boolean(state.fieldErrors.fuel)}
          />
          <FieldError message={state.fieldErrors.fuel} />
          <datalist id="fuel-options">
            <option value="Electric" />
            <option value="Gas" />
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Input
            id="condition"
            name="condition"
            list="condition-options"
            defaultValue={state.values.condition}
            aria-invalid={Boolean(state.fieldErrors.condition)}
          />
          <FieldError message={state.fieldErrors.condition} />
          <datalist id="condition-options">
            <option value="New" />
            <option value="Good" />
            <option value="Fair" />
            <option value="Poor" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Input
            id="status"
            name="status"
            list="status-options"
            defaultValue={state.values.status}
            aria-invalid={Boolean(state.fieldErrors.status)}
          />
          <FieldError message={state.fieldErrors.status} />
          {!canPublish ? (
            <p className="text-xs text-muted-foreground">
              Published is available only when lifecycle is Listed.
            </p>
          ) : null}
          <datalist id="status-options">
            <option value="Draft" />
            {canPublish ? <option value="Published" /> : null}
            <option value="Archived" />
            <option value="Sold" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            data-label="Price"
            placeholder="0.00"
            defaultValue={state.values.price}
            aria-invalid={Boolean(state.fieldErrors.price)}
            onInvalid={handleFieldInvalid}
            onInput={clearFieldValidity}
          />
          <FieldError message={state.fieldErrors.price} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            defaultValue={state.values.color}
            aria-invalid={Boolean(state.fieldErrors.color)}
          />
          <FieldError message={state.fieldErrors.color} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min="0"
            step="0.1"
            defaultValue={state.values.capacity}
            aria-invalid={Boolean(state.fieldErrors.capacity)}
          />
          <FieldError message={state.fieldErrors.capacity} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">Age (Year)</Label>
          <Input
            id="age"
            name="age"
            type="number"
            min="0"
            defaultValue={state.values.age}
            aria-invalid={Boolean(state.fieldErrors.age)}
          />
          <FieldError message={state.fieldErrors.age} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dimensions">Dimensions</Label>
        <Input
          id="dimensions"
          name="dimensions"
          placeholder='JSON or W x D x H (e.g. 27 x 30 x 38)'
          defaultValue={state.values.dimensions}
          aria-invalid={Boolean(state.fieldErrors.dimensions)}
        />
        <FieldError message={state.fieldErrors.dimensions} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Features</Label>
        <Textarea
          id="features"
          name="features"
          rows={3}
          placeholder="Comma-separated (e.g. Steam Clean, Smart WiFi, Energy Star)"
          defaultValue={state.values.features}
          aria-invalid={Boolean(state.fieldErrors.features)}
        />
        <FieldError message={state.fieldErrors.features} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description_long">Description</Label>
        <Textarea
          id="description_long"
          name="description_long"
          rows={5}
          placeholder="Detailed description"
          defaultValue={state.values.description_long}
          aria-invalid={Boolean(state.fieldErrors.description_long)}
        />
        <FieldError message={state.fieldErrors.description_long} />
      </div>

      <div className="space-y-2">
        <Label>Images</Label>

        {existingImages.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Current images ({existingImages.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="relative inline-block overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={img.url}
                    alt="Appliance"
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 object-cover"
                  />
                  <Button
                    type="button"
                    onClick={() => handleRemoveExistingImage(img.id)}
                    variant="destructive"
                    size="sm"
                    disabled={removingImageId === img.id}
                    className="absolute right-0 top-0 h-6 rounded-none rounded-bl-md px-2 text-xs"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Input
            ref={fileInputRef}
            id="images"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
          />
          {imageFiles.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearImages}>
              Clear selection ({imageFiles.length})
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          New photos upload when you save. Removed photos are deleted from both
          tables and storage.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton />
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
