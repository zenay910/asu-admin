'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createPartItem, updatePartItem } from './actions'
import {
  initialPartFormState,
  type PartFormState,
  type PartFormValues,
} from './types'
import type { PartStatus } from '@/lib/types/inventory'

type PartFormProps = {
  mode: 'create' | 'edit'
  partId?: string
  initialValues?: PartFormValues
  quantityOnHand?: number
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

export default function PartForm({
  mode,
  partId,
  initialValues,
  quantityOnHand,
}: PartFormProps) {
  const action =
    mode === 'create'
      ? createPartItem
      : (prev: PartFormState, formData: FormData) =>
          updatePartItem(prev, formData, partId as string)

  const [state, formAction] = useActionState(action, {
    ...initialPartFormState,
    values: initialValues ?? initialPartFormState.values,
  })

  const values = state.values

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-2">
          <p>{state.success}</p>
          {state.partId ? (
            <Link
              href={`/dashboard/parts/${state.partId}`}
              className="font-medium underline underline-offset-2"
            >
              View part
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="part_number">Part number</Label>
          <Input
            id="part_number"
            name="part_number"
            required
            defaultValue={values.part_number}
            aria-invalid={Boolean(state.fieldErrors.part_number)}
            className="font-mono"
          />
          <FieldError message={state.fieldErrors.part_number} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={values.name}
            aria-invalid={Boolean(state.fieldErrors.name)}
          />
          <FieldError message={state.fieldErrors.name} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={values.description}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" defaultValue={values.brand} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" defaultValue={values.category} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={values.location} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mode === 'create' ? (
          <div className="space-y-2">
            <Label htmlFor="quantity_on_hand">Quantity on hand</Label>
            <Input
              id="quantity_on_hand"
              name="quantity_on_hand"
              type="number"
              min="0"
              step="1"
              defaultValue={values.quantity_on_hand}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Quantity on hand</Label>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm tabular-nums">
              {quantityOnHand ?? '—'}
              <span className="mt-1 block text-xs text-muted-foreground">
                Adjust stock from the part detail page to change quantity.
              </span>
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="reorder_threshold">Reorder threshold</Label>
          <Input
            id="reorder_threshold"
            name="reorder_threshold"
            type="number"
            min="0"
            step="1"
            defaultValue={values.reorder_threshold}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_cost">Unit cost</Label>
          <Input
            id="unit_cost"
            name="unit_cost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.unit_cost}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_price">Unit price</Label>
          <Input
            id="unit_price"
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.unit_price}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={values.status}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          {(['Active', 'Discontinued'] as PartStatus[]).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton label={mode === 'create' ? 'Create part' : 'Save changes'} />
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/parts">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
