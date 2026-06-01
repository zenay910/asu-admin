'use client'

import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function ThemeQaActions() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        Theme: {theme === 'dark' ? 'Dark' : 'Light'}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => toast.success('Success toast (branded primary)')}
      >
        Toast success
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => toast.error('Error toast')}
      >
        Toast error
      </Button>
    </div>
  )
}
