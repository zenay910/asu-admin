const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Format a numeric amount as USD currency. */
export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount)
}

/** Format an ISO timestamp as a medium date (no time). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

/** Receipt date: issued date when set, otherwise created date. */
export function formatInvoiceDate(invoice: {
  issued_at: string | null
  created_at: string
}): string {
  return formatDate(invoice.issued_at ?? invoice.created_at)
}

/** Format an ISO timestamp as a medium date with short time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter.format(date)
}

/** Format a phone string as (XXX) XXX-XXXX (up to 10 digits). */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

type CustomerAddressParts = {
  street?: string
  city?: string
  state?: string
  zip?: string
}

/** Short address label for pickers (street, or city/state/zip). */
export function formatCustomerAddressLabel(
  address: CustomerAddressParts | null | undefined,
): string | null {
  if (!address) return null
  const street = address.street?.trim()
  if (street) return street
  const parts = [address.city, address.state, address.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** Full address for receipt display (street + city/state/zip lines). */
export function formatCustomerAddressDisplay(
  address: CustomerAddressParts | null | undefined,
): string | null {
  if (!address) return null
  const street = address.street?.trim()
  const cityStateZip = [address.city, address.state, address.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  if (street && cityStateZip) return `${street}\n${cityStateZip}`
  if (street) return street
  if (cityStateZip) return cityStateZip
  return null
}
