'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createInventoryItem,
  initialInventoryFormState,
} from './actions'

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

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.success}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="e.g. Whirlpool Washer" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" placeholder="e.g. Whirlpool" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model_number">Model Number</Label>
          <Input id="model_number" name="model_number" placeholder="e.g. WFW5605MW" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Input id="type" name="type" placeholder="e.g. Washer" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="configuration">Configuration</Label>
          <Input
            id="configuration"
            name="configuration"
            list="configuration-options"
            placeholder="Front Load"
          />
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
          <Input id="unit_type" name="unit_type" list="unit-type-options" placeholder="Individual" />
          <datalist id="unit-type-options">
            <option value="Individual" />
            <option value="Set" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuel">Fuel</Label>
          <Input id="fuel" name="fuel" list="fuel-options" placeholder="Electric" />
          <datalist id="fuel-options">
            <option value="Electric" />
            <option value="Gas" />
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Input id="condition" name="condition" list="condition-options" defaultValue="Good" />
          <datalist id="condition-options">
            <option value="New" />
            <option value="Good" />
            <option value="Fair" />
            <option value="Poor" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Input id="status" name="status" list="status-options" defaultValue="Draft" />
          <datalist id="status-options">
            <option value="Draft" />
            <option value="Published" />
            <option value="Archived" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input id="price" name="price" type="number" min="0" step="0.01" required placeholder="0.00" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input id="color" name="color" placeholder="e.g. Stainless Steel" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" min="0" step="0.1" placeholder="e.g. 4.5" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dimensions">Dimensions</Label>
        <Input id="dimensions" name="dimensions" placeholder='e.g. 30 x 28 x 66 or {"width_in":30,"depth_in":28,"height_in":66}' />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Features</Label>
        <Textarea id="features" name="features" rows={3} placeholder="Comma-separated (e.g. Steam Clean, Smart WiFi, Energy Star)" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description_long">Description</Label>
        <Textarea id="description_long" name="description_long" rows={5} placeholder="Detailed product description" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">Images</Label>
        <Input id="images" name="images" type="file" accept="image/*" multiple />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
