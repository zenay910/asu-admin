'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createRefurbishmentIntake } from './actions'
import { initialRefurbishmentIntakeFormState } from './types'

type SpecFormValues = {
  title: string
  brand: string
  model_number: string
  type: string
  configuration: string
  fuel: string
  capacity: string
  color: string
  age: string
  dimensions: string
  features: string
  description_long: string
}

const emptySpecValues: SpecFormValues = {
  title: '',
  brand: '',
  model_number: '',
  type: '',
  configuration: '',
  fuel: '',
  capacity: '',
  color: '',
  age: '',
  dimensions: '',
  features: '',
  description_long: '',
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save intake'}
    </Button>
  )
}

export default function RefurbishmentIntakeForm() {
  const [state, formAction] = useActionState(
    createRefurbishmentIntake,
    initialRefurbishmentIntakeFormState,
  )

  const [source, setSource] = useState('')
  const [cost, setCost] = useState('')
  const [modelNumber, setModelNumber] = useState('')
  const [specValues, setSpecValues] = useState<SpecFormValues>(emptySpecValues)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractSuccess, setExtractSuccess] = useState(false)

  const setSpecField =
    (field: keyof SpecFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSpecValues((prev) => ({ ...prev, [field]: e.target.value }))

  const handleExtract = async () => {
    const trimmed = modelNumber.trim()
    if (!trimmed) {
      setExtractError('Please enter a model number first.')
      return
    }

    setIsExtracting(true)
    setExtractError(null)
    setExtractSuccess(false)

    try {
      const response = await fetch('/api/extract-appliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelNumber: trimmed }),
      })

      if (!response.ok) {
        throw new Error('Extraction failed')
      }

      const data = await response.json()

      setSpecValues({
        title: data.title ?? '',
        brand: data.brand ?? '',
        model_number: data.model_number ?? trimmed,
        type: data.type ?? '',
        configuration: data.configuration ?? '',
        fuel: data.fuel ?? '',
        capacity: data.capacity != null ? String(data.capacity) : '',
        color: data.color ?? '',
        age: data.manufacture_year != null ? String(data.manufacture_year) : '',
        dimensions: data.dimensions ? JSON.stringify(data.dimensions) : '',
        features: Array.isArray(data.features) ? data.features.join(', ') : '',
        description_long: data.description_long ?? '',
      })

      if (data.model_number) {
        setModelNumber(String(data.model_number))
      }

      setExtractSuccess(true)
    } catch {
      setExtractError('Could not extract specs. Please fill in the fields manually.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFormAction = (formData: FormData) => {
    formData.set('source', source)
    formData.set('cost', cost)
    formData.set('model_number', modelNumber)

    Object.entries(specValues).forEach(([key, value]) => {
      if (value) formData.set(key, value)
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

      {state.success ? (
        <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p>{state.success}</p>
          {state.createdApplianceId ? (
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <Link
                href={`/dashboard/inventory/${state.createdApplianceId}`}
                className="underline underline-offset-2"
              >
                View appliance
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Auction, trade-in, etc."
          />
          <FieldError message={state.fieldErrors.source} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">Cost</Label>
          <Input
            id="cost"
            name="cost"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Acquisition cost"
          />
          <FieldError message={state.fieldErrors.cost} />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Extract specs
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Enter a model number to auto-fill technical specs for review.
              Price and status are not set by AI.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grow space-y-2">
              <Label htmlFor="model_number">Model number</Label>
              <Input
                id="model_number"
                value={modelNumber}
                onChange={(e) => {
                  setModelNumber(e.target.value)
                  setExtractError(null)
                  setExtractSuccess(false)
                }}
                placeholder="e.g. GTD42EASJWW"
              />
              <FieldError message={state.fieldErrors.model_number} />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleExtract}
              disabled={isExtracting}
            >
              {isExtracting ? 'Extracting...' : 'Extract specs'}
            </Button>
          </div>

          {extractError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{extractError}</p>
          ) : null}
          {extractSuccess ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Specs extracted — review and edit below before saving.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Technical specs</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={specValues.title}
              onChange={setSpecField('title')}
              placeholder="Product title"
            />
            <FieldError message={state.fieldErrors.title} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={specValues.brand}
              onChange={setSpecField('brand')}
            />
            <FieldError message={state.fieldErrors.brand} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input
              id="type"
              value={specValues.type}
              onChange={setSpecField('type')}
              placeholder="Washer, Dryer, etc."
            />
            <FieldError message={state.fieldErrors.type} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="configuration">Configuration</Label>
            <Input
              id="configuration"
              value={specValues.configuration}
              onChange={setSpecField('configuration')}
              list="configuration-options"
            />
            <datalist id="configuration-options">
              <option value="Front Load" />
              <option value="Top Load" />
              <option value="Stacked Unit" />
              <option value="Standard" />
            </datalist>
            <FieldError message={state.fieldErrors.configuration} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel">Fuel</Label>
            <Input
              id="fuel"
              value={specValues.fuel}
              onChange={setSpecField('fuel')}
              list="fuel-options"
            />
            <datalist id="fuel-options">
              <option value="Electric" />
              <option value="Gas" />
            </datalist>
            <FieldError message={state.fieldErrors.fuel} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (cu. ft.)</Label>
            <Input
              id="capacity"
              value={specValues.capacity}
              onChange={setSpecField('capacity')}
            />
            <FieldError message={state.fieldErrors.capacity} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="age">Age (year)</Label>
            <Input
              id="age"
              value={specValues.age}
              onChange={setSpecField('age')}
            />
            <FieldError message={state.fieldErrors.age} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={specValues.color}
              onChange={setSpecField('color')}
            />
            <FieldError message={state.fieldErrors.color} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dimensions">Dimensions (JSON or W x D x H)</Label>
            <Input
              id="dimensions"
              value={specValues.dimensions}
              onChange={setSpecField('dimensions')}
            />
            <FieldError message={state.fieldErrors.dimensions} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="features">Features</Label>
            <Input
              id="features"
              value={specValues.features}
              onChange={setSpecField('features')}
              placeholder="Comma-separated"
            />
            <FieldError message={state.fieldErrors.features} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description_long">Description</Label>
            <Textarea
              id="description_long"
              value={specValues.description_long}
              onChange={setSpecField('description_long')}
              rows={4}
            />
            <FieldError message={state.fieldErrors.description_long} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}
