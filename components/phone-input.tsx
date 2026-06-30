'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatPhone } from '@/lib/format'

type PhoneInputProps = {
  id: string
  name: string
  initialValue: string
  autoComplete?: string
}

export function PhoneInput({
  id,
  name,
  initialValue,
  autoComplete = 'tel',
}: PhoneInputProps) {
  const [phone, setPhone] = useState(() => formatPhone(initialValue))

  return (
    <Input
      id={id}
      name={name}
      type="tel"
      autoComplete={autoComplete}
      value={phone}
      onChange={(event) => setPhone(formatPhone(event.target.value))}
    />
  )
}
