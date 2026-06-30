'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type InvoicePrintDocumentProps = {
  lineItemCount: number
  children: ReactNode
  className?: string
}

function printDensityClass(lineItemCount: number): string {
  if (lineItemCount > 18) return 'invoice-print-document--dense'
  if (lineItemCount > 10) return 'invoice-print-document--compact'
  return ''
}

export function InvoicePrintDocument({
  lineItemCount,
  children,
  className,
}: InvoicePrintDocumentProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    function fitBodyToPage() {
      const root = ref.current
      if (!root) return

      const body = root.querySelector<HTMLElement>('.invoice-print-body')
      if (!body) return

      body.style.transform = 'none'
      body.style.width = '100%'
      body.style.height = 'auto'

      const header = root.querySelector<HTMLElement>('.invoice-print-header')
      const footer = root.querySelector<HTMLElement>('.invoice-print-footer')
      const available =
        root.clientHeight -
        (header?.offsetHeight ?? 0) -
        (footer?.offsetHeight ?? 0)

      if (available <= 0 || body.scrollHeight <= available) return

      const scale = Math.max(0.55, available / body.scrollHeight)
      body.style.transform = `scale(${scale})`
      body.style.transformOrigin = 'top left'
      body.style.width = `${100 / scale}%`
    }

    function resetBody() {
      const body = ref.current?.querySelector<HTMLElement>('.invoice-print-body')
      if (!body) return
      body.style.transform = ''
      body.style.transformOrigin = ''
      body.style.width = ''
      body.style.height = ''
    }

    window.addEventListener('beforeprint', fitBodyToPage)
    window.addEventListener('afterprint', resetBody)
    return () => {
      window.removeEventListener('beforeprint', fitBodyToPage)
      window.removeEventListener('afterprint', resetBody)
    }
  }, [lineItemCount])

  return (
    <article
      ref={ref}
      className={cn(
        'invoice-print-document space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none print:text-black',
        printDensityClass(lineItemCount),
        className,
      )}
    >
      {children}
    </article>
  )
}
