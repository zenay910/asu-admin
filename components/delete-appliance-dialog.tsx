'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteInventoryAppliance } from '@/app/dashboard/inventory/edit/actions'
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

type DeleteApplianceDialogProps = {
  applianceId: string
  label?: string
  variant?: 'destructive' | 'outline'
}

export function DeleteApplianceDialog({
  applianceId,
  label = 'Delete appliance',
  variant = 'destructive',
}: DeleteApplianceDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteInventoryAppliance(applianceId)
        toast.success('Appliance deleted')
        setOpen(false)
        router.push('/dashboard/inventory/view')
        router.refresh()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete appliance.'
        toast.error(message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this appliance?</DialogTitle>
          <DialogDescription>
            This removes the appliance and mirrored product, all image rows, and
            storage files. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
