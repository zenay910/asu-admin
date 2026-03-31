'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { uploadImages } from '@/lib/supabase/storage'
import { createInventoryItem } from './actions'
import { initialInventoryFormState } from './types'

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
      {pending ? 'Saving...' : 'Save Item'}
    </Button>
  )
}

export default function InventoryForm() {
  const [state, formAction] = useActionState(
    createInventoryItem,
    initialInventoryFormState
  )
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || [])
    setImageFiles(files)
    setUploadError(null)
  }

  const handleUploadImages = async () => {
    if (imageFiles.length === 0) {
      setUploadError('Please select at least one image')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      // Generate a temporary product ID for storage (will be replaced after form submission)
      const tempProductId = `temp-${Date.now()}`
      const urls = await uploadImages(imageFiles, tempProductId)
      setUploadedImageUrls(urls)
      setImageFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload images')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    setUploadedImageUrls(uploadedImageUrls.filter((_, i) => i !== index))
  }

  const handleFormAction = async (formData: FormData) => {
    // Add uploaded image URLs to the form data
    uploadedImageUrls.forEach((url) => {
      formData.append('imageUrls', url)
    })
    formAction(formData)
  }

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
            placeholder="e.g. Washer"
            defaultValue={state.values.type}
            aria-invalid={Boolean(state.fieldErrors.type)}
          />
          <FieldError message={state.fieldErrors.type} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="configuration">Configuration</Label>
          <Input
            id="configuration"
            name="configuration"
            list="configuration-options"
            placeholder="Front Load"
            defaultValue={state.values.configuration}
            aria-invalid={Boolean(state.fieldErrors.configuration)}
          />
          <FieldError message={state.fieldErrors.configuration} />
          <datalist id="configuration-options">
            <option value="Front Load" />
            <option value="Top Load" />
            <option value="Stacked Unit" />
            <option value="Standard" />
            <option value="Slide-In" />
            <option value="Glass Cooktop" />
            <option value="Coil Cooktop" />
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
            placeholder="Individual"
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
            placeholder="Electric"
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
          <datalist id="status-options">
            <option value="Draft" />
            <option value="Published" />
            <option value="Archived" />
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
            placeholder="e.g. Stainless Steel"
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
            placeholder="e.g. 4.5"
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
            min="1900"
            step="1"
            placeholder="e.g. 2020"
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
          placeholder='e.g. 30 x 28 x 66 or {"width_in":30,"depth_in":28,"height_in":66}'
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
          placeholder="Detailed product description"
          defaultValue={state.values.description_long}
          aria-invalid={Boolean(state.fieldErrors.description_long)}
        />
        <FieldError message={state.fieldErrors.description_long} />
      </div>

      <div className="space-y-2">
        <Label>Images</Label>
        <div className="flex gap-2">
          <Input
            ref={fileInputRef}
            id="images"
            name="images"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            disabled={isUploading}
          />
          <Button
            type="button"
            onClick={handleUploadImages}
            disabled={isUploading || imageFiles.length === 0}
            variant="secondary"
          >
            {isUploading ? 'Uploading...' : 'Upload Images'}
          </Button>
        </div>
        {uploadedImageUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Uploaded images ({uploadedImageUrls.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {uploadedImageUrls.map((url, index) => (
                <div
                  key={index}
                  className="relative inline-block rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
                >
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-20 h-20 object-cover"
                  />
                  <Button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    variant="destructive"
                    size="sm"
                    className="absolute right-0 top-0 h-6 rounded-none rounded-bl-md px-2 text-xs"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
