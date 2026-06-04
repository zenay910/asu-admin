'use client'

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FilterSelectProps = {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

export function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: FilterSelectProps) {
  const labelId = useId()
  const triggerId = useId()

  return (
    <div className="space-y-1.5">
      <Label id={labelId} className="type-label text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={triggerId}
          aria-labelledby={labelId}
          className="w-full min-h-11"
        >
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
