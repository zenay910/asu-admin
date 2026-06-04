import { cn } from '@/lib/utils'

type PageErrorAlertProps = {
  message: string
  className?: string
}

export function PageErrorAlert({ message, className }: PageErrorAlertProps) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive',
        className,
      )}
    >
      {message}
    </p>
  )
}
