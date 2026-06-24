'use client'

import { useActionState, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { compressImagesForUpload } from '@/lib/images/compress'
import { useAppliances } from '@/lib/hooks/use-appliances'
import type { ApplianceListRow } from '@/lib/hooks/use-appliances'
import { createSetInventoryItem } from './actions'
import { initialSetFormState } from './types'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save Set'}
    </Button>
  )
}

function machineLabel(appliance: ApplianceListRow): string {
  const parts = [
    appliance.model_number,
    appliance.brand,
    appliance.type,
    appliance.title,
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function SetInventoryForm() {
  const [state, formAction] = useActionState(
    createSetInventoryItem,
    initialSetFormState,
  )
  const { appliances, loading } = useAppliances()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [descriptionLong, setDescriptionLong] = useState('')
  const [features, setFeatures] = useState('')
  const [brand, setBrand] = useState('')
  const [color, setColor] = useState('')
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableAppliances = useMemo(
    () => appliances.filter((row) => row.unit_type !== 'Set'),
    [appliances],
  )

  const selectedAppliances = useMemo(
    () =>
      selectedIds
        .map((id) => availableAppliances.find((row) => row.id === id))
        .filter((row): row is ApplianceListRow => row != null),
    [availableAppliances, selectedIds],
  )

  const filteredAppliances = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return availableAppliances

    return availableAppliances.filter((row) => {
      const haystack = [
        row.title,
        row.brand,
        row.model_number,
        row.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [availableAppliances, search])

  const toggleSelection = (applianceId: string) => {
    setClientError(null)
    setSelectedIds((prev) =>
      prev.includes(applianceId)
        ? prev.filter((id) => id !== applianceId)
        : [...prev, applianceId],
    )
  }

  const handleSuggest = async () => {
    if (selectedAppliances.length < 2) {
      setSuggestError('Select at least two machines before requesting AI suggestions.')
      return
    }

    setIsSuggesting(true)
    setSuggestError(null)

    try {
      const response = await fetch('/api/suggest-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machines: selectedAppliances.map((machine) => ({
            brand: machine.brand,
            type: machine.type,
            model_number: machine.model_number,
            title: machine.title,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Suggestion failed')
      }

      const data = await response.json()
      setTitle(data.title ?? '')
      setDescriptionLong(data.description_long ?? '')
      setFeatures(
        Array.isArray(data.features) ? data.features.join(', ') : '',
      )

      if (!brand && selectedAppliances[0]?.brand) {
        setBrand(selectedAppliances[0].brand)
      }
    } catch {
      setSuggestError('Could not generate set suggestions. Fill in the fields manually.')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || [])
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

  const handleFormAction = async (formData: FormData) => {
    setClientError(null)

    if (selectedIds.length < 2) {
      setClientError('Select at least two existing machines for this set.')
      return
    }

    formData.set('title', title)
    formData.set('description_long', descriptionLong)
    formData.set('features', features)
    formData.set('brand', brand)
    formData.set('color', color)
    formData.delete('memberIds')
    for (const memberId of selectedIds) {
      formData.append('memberIds', memberId)
    }

    formData.delete('images')
    for (const file of imageFiles) {
      formData.append('images', file)
    }

    formAction(formData)
  }

  return (
    <form action={handleFormAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      {clientError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {clientError}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-2">
          <p>{state.success}</p>
          {state.createdApplianceId ? (
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <Link
                href={`/dashboard/inventory/${state.createdApplianceId}`}
                className="underline underline-offset-2"
              >
                View set
              </Link>
              <Link
                href="/dashboard/inventory/view"
                className="underline underline-offset-2"
              >
                Open inventory list
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Select machines
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Choose at least two existing individual appliances to include in this set.
          </p>
        </div>

        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, brand, model, or type"
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading appliances...</p>
        ) : filteredAppliances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matching individual appliances found.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2">
            {filteredAppliances.map((appliance) => {
              const selected = selectedIds.includes(appliance.id)
              return (
                <button
                  key={appliance.id}
                  type="button"
                  onClick={() => toggleSelection(appliance.id)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                    selected
                      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900'
                      : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/70'
                  }`}
                >
                  {appliance.primary_image_url ? (
                    <Image
                      src={appliance.primary_image_url}
                      alt={appliance.title}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      N/A
                    </div>
                  )}
                  <span>{machineLabel(appliance)}</span>
                </button>
              )
            })}
          </div>
        )}

        {selectedAppliances.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Selected ({selectedAppliances.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedAppliances.map((appliance) => (
                <Button
                  key={appliance.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleSelection(appliance.id)}
                >
                  {machineLabel(appliance)} ×
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <FieldError message={state.fieldErrors.members} />
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Set listing copy
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Use AI to draft a title, description, and features for the combined set listing.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSuggest}
          disabled={isSuggesting || selectedAppliances.length < 2}
        >
          {isSuggesting ? 'Suggesting...' : 'Suggest title & description with AI'}
        </Button>
        {suggestError ? (
          <p className="text-sm text-amber-800 dark:text-amber-300">{suggestError}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Whirlpool Washer & Dryer Set"
          aria-invalid={Boolean(state.fieldErrors.title)}
        />
        <FieldError message={state.fieldErrors.title} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            name="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Whirlpool"
            aria-invalid={Boolean(state.fieldErrors.brand)}
          />
          <FieldError message={state.fieldErrors.brand} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="e.g. Stainless Steel"
            aria-invalid={Boolean(state.fieldErrors.color)}
          />
          <FieldError message={state.fieldErrors.color} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description_long">Description</Label>
        <Textarea
          id="description_long"
          name="description_long"
          rows={5}
          value={descriptionLong}
          onChange={(e) => setDescriptionLong(e.target.value)}
          placeholder="Detailed set description"
          aria-invalid={Boolean(state.fieldErrors.description_long)}
        />
        <FieldError message={state.fieldErrors.description_long} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Features</Label>
        <Textarea
          id="features"
          name="features"
          rows={3}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          placeholder="Comma-separated set features"
          aria-invalid={Boolean(state.fieldErrors.features)}
        />
        <FieldError message={state.fieldErrors.features} />
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
          <p className="text-xs text-muted-foreground">
            New sets start as Intake / Draft.
          </p>
          <datalist id="status-options">
            <option value="Draft" />
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
            defaultValue={state.values.price}
            placeholder="0.00"
            aria-invalid={Boolean(state.fieldErrors.price)}
          />
          <FieldError message={state.fieldErrors.price} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">Set photos</Label>
        <Input
          ref={fileInputRef}
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
        />
        {imageFiles.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {imageFiles.length} photo(s) will upload when you save.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={handleClearImages}>
              Clear images
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add photos of the machines together or the full set listing.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
