'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createCustomerItem } from '@/app/dashboard/customers/actions'
import {
  initialCustomerFormState,
  type CustomerFormState,
  type CustomerFormValues,
} from '@/app/dashboard/customers/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/phone-input'
import { formatCustomerAddressLabel } from '@/lib/format'

type QuickAddCustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (customerId: string, fullName: string, address: string | null) => void
  disabled?: boolean
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

function addressLabelFromValues(values: CustomerFormValues): string | null {
  return formatCustomerAddressLabel({
    street: values.address_street,
    city: values.address_city,
    state: values.address_state,
    zip: values.address_zip,
  })
}

function QuickAddCustomerForm({
  onCreated,
}: {
  onCreated: (
    customerId: string,
    fullName: string,
    address: string | null,
  ) => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const handledSuccess = useRef(false)
  const pendingCreate = useRef<{
    fullName: string
    address: string | null
  } | null>(null)
  const [pending, startTransition] = useTransition()
  const [state, formAction] = useActionState<CustomerFormState, FormData>(
    createCustomerItem,
    initialCustomerFormState,
  )

  useEffect(() => {
    if (!state.customerId || !state.success || handledSuccess.current) return
    handledSuccess.current = true
    const pending = pendingCreate.current
    onCreated(
      state.customerId,
      pending?.fullName ?? state.values.full_name.trim(),
      pending?.address ?? addressLabelFromValues(state.values),
    )
    pendingCreate.current = null
  }, [onCreated, state.customerId, state.success, state.values])

  function submitCustomerForm(form: HTMLFormElement) {
    if (pending) return
    const formData = new FormData(form)
    const values: CustomerFormValues = {
      full_name: String(formData.get('full_name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      address_street: String(formData.get('address_street') ?? ''),
      address_city: String(formData.get('address_city') ?? ''),
      address_state: String(formData.get('address_state') ?? ''),
      address_zip: String(formData.get('address_zip') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    }
    pendingCreate.current = {
      fullName: values.full_name.trim(),
      address: addressLabelFromValues(values),
    }
    startTransition(() => {
      formAction(formData)
    })
  }

  function handleCreateClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!formRef.current) return
    submitCustomerForm(formRef.current)
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    submitCustomerForm(e.currentTarget)
  }

  const values = state.values

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleFormSubmit}
        className="space-y-5"
      >
        {state.error ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="quick-add-full_name">Full name</Label>
          <Input
            id="quick-add-full_name"
            name="full_name"
            required
            autoComplete="name"
            defaultValue={values.full_name}
            aria-invalid={Boolean(state.fieldErrors.full_name)}
          />
          <FieldError message={state.fieldErrors.full_name} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-add-email">Email</Label>
            <Input
              id="quick-add-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={values.email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-add-phone">Phone</Label>
            <PhoneInput
              key={values.phone}
              id="quick-add-phone"
              name="phone"
              initialValue={values.phone}
            />
          </div>
        </div>

        <fieldset className="space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-medium">Address</legend>
          <div className="space-y-2">
            <Label htmlFor="quick-add-address_street">Street</Label>
            <Input
              id="quick-add-address_street"
              name="address_street"
              autoComplete="street-address"
              defaultValue={values.address_street}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="quick-add-address_city">City</Label>
              <Input
                id="quick-add-address_city"
                name="address_city"
                autoComplete="address-level2"
                defaultValue={values.address_city}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-add-address_state">State</Label>
              <Input
                id="quick-add-address_state"
                name="address_state"
                autoComplete="address-level1"
                defaultValue={values.address_state}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-add-address_zip">ZIP</Label>
              <Input
                id="quick-add-address_zip"
                name="address_zip"
                autoComplete="postal-code"
                defaultValue={values.address_zip}
              />
            </div>
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="quick-add-notes">Notes</Label>
          <Textarea
            id="quick-add-notes"
            name="notes"
            rows={4}
            defaultValue={values.notes}
          />
        </div>
      </form>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" disabled={pending} onClick={handleCreateClick}>
          {pending ? 'Saving…' : 'Create customer'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function QuickAddCustomerDialog({
  open,
  onOpenChange,
  onSuccess,
  disabled = false,
}: QuickAddCustomerDialogProps) {
  const [formKey, setFormKey] = useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setFormKey((key) => key + 1)
    }
    onOpenChange(nextOpen)
  }

  function handleCreated(
    customerId: string,
    fullName: string,
    address: string | null,
  ) {
    onSuccess(customerId, fullName, address)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          New customer
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.stopPropagation()}
        onInteractOutside={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Create a customer here without leaving the invoice form.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <QuickAddCustomerForm key={formKey} onCreated={handleCreated} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
