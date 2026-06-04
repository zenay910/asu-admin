'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PrintPageButtonProps = {
  label?: string
}

export function PrintPageButton({ label = 'Print' }: PrintPageButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      aria-label={label}
    >
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  )
}
