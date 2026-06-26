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
      (pending?.address ?? state.values.address_street.trim()) || null,
    )
    pendingCreate.current = null
  }, [
    onCreated,
    state.customerId,
    state.success,
    state.values.address_street,
    state.values.full_name,
  ])

  function submitCustomerForm(form: HTMLFormElement) {
    if (pending) return
    const formData = new FormData(form)
    pendingCreate.current = {
      fullName: String(formData.get('full_name') ?? '').trim(),
      address:
        String(formData.get('address_street') ?? '').trim() || null,
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

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleFormSubmit}
        className="space-y-4"
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
            defaultValue={state.values.full_name}
            aria-invalid={Boolean(state.fieldErrors.full_name)}
          />
          <FieldError message={state.fieldErrors.full_name} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-add-address_street">Address</Label>
            <Input
              id="quick-add-address_street"
              name="address_street"
              autoComplete="street-address"
              defaultValue={state.values.address_street}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-add-phone">Phone</Label>
            <Input
              id="quick-add-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={state.values.phone}
            />
          </div>
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
