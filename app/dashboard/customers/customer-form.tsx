'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { PhoneInput } from '@/components/phone-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCustomerItem, updateCustomerItem } from './actions'
import {
  initialCustomerFormState,
  type CustomerFormState,
  type CustomerFormValues,
} from './types'

type CustomerFormProps = {
  mode: 'create' | 'edit'
  customerId?: string
  initialValues?: CustomerFormValues
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

export default function CustomerForm({
  mode,
  customerId,
  initialValues,
}: CustomerFormProps) {
  const action =
    mode === 'create'
      ? createCustomerItem
      : (prev: CustomerFormState, formData: FormData) =>
          updateCustomerItem(prev, formData, customerId as string)

  const [state, formAction] = useActionState(action, {
    ...initialCustomerFormState,
    values: initialValues ?? initialCustomerFormState.values,
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
          {state.customerId ? (
            <Link
              href={`/dashboard/customers/${state.customerId}`}
              className="font-medium underline underline-offset-2"
            >
              View customer
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={values.full_name}
          aria-invalid={Boolean(state.fieldErrors.full_name)}
        />
        <FieldError message={state.fieldErrors.full_name} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values.email}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <PhoneInput
            key={values.phone}
            id="phone"
            name="phone"
            initialValue={values.phone}
          />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Address</legend>
        <div className="space-y-2">
          <Label htmlFor="address_street">Street</Label>
          <Input
            id="address_street"
            name="address_street"
            autoComplete="street-address"
            defaultValue={values.address_street}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="address_city">City</Label>
            <Input
              id="address_city"
              name="address_city"
              autoComplete="address-level2"
              defaultValue={values.address_city}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_state">State</Label>
            <Input
              id="address_state"
              name="address_state"
              autoComplete="address-level1"
              defaultValue={values.address_state}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_zip">ZIP</Label>
            <Input
              id="address_zip"
              name="address_zip"
              autoComplete="postal-code"
              defaultValue={values.address_zip}
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={values.notes}
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton
          label={mode === 'create' ? 'Create customer' : 'Save changes'}
        />
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/customers">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
