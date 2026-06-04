import type { CreatePartInput, UpdatePartInput } from '@/lib/data/parts'
import type { PartStatus } from '@/lib/types/inventory'

export function friendlyPartDbError(message: string): string {
  if (
    message.includes('duplicate key') ||
    message.includes('parts_part_number_key') ||
    message.includes('unique constraint')
  ) {
    return 'A part with this part number already exists.'
  }
  return message
}

function parseOptionalNumber(
  raw: unknown,
  field: string,
  options: { allowNull?: boolean; min?: number } = {},
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, value: undefined }
  }
  if (raw === null || raw === '') {
    if (options.allowNull) return { ok: true, value: null }
    return { ok: true, value: undefined }
  }
  const num = Number(raw)
  if (!Number.isFinite(num)) {
    return { ok: false, error: `${field} must be a number` }
  }
  if (options.min != null && num < options.min) {
    return { ok: false, error: `${field} must be at least ${options.min}` }
  }
  return { ok: true, value: num }
}

export function parseCreatePartBody(
  body: unknown,
): { ok: true; input: CreatePartInput } | { ok: false; error: string } {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body.' }
  }

  const raw = body as Record<string, unknown>
  const part_number =
    typeof raw.part_number === 'string' ? raw.part_number.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''

  if (!part_number) {
    return { ok: false, error: 'Missing required field: part_number' }
  }
  if (!name) {
    return { ok: false, error: 'Missing required field: name' }
  }

  const input: CreatePartInput = { part_number, name }

  if (raw.description !== undefined) {
    input.description =
      raw.description == null ? null : String(raw.description).trim() || null
  }
  if (raw.brand !== undefined) {
    input.brand = raw.brand == null ? null : String(raw.brand).trim() || null
  }
  if (raw.category !== undefined) {
    input.category =
      raw.category == null ? null : String(raw.category).trim() || null
  }
  if (raw.location !== undefined) {
    input.location =
      raw.location == null ? null : String(raw.location).trim() || null
  }

  const qty = parseOptionalNumber(raw.quantity_on_hand, 'quantity_on_hand', {
    min: 0,
  })
  if (!qty.ok) return { ok: false, error: qty.error }
  if (qty.value !== undefined) input.quantity_on_hand = qty.value as number

  const threshold = parseOptionalNumber(raw.reorder_threshold, 'reorder_threshold', {
    allowNull: true,
    min: 0,
  })
  if (!threshold.ok) return { ok: false, error: threshold.error }
  if (threshold.value !== undefined) {
    input.reorder_threshold = threshold.value
  }

  const unitCost = parseOptionalNumber(raw.unit_cost, 'unit_cost', {
    allowNull: true,
    min: 0,
  })
  if (!unitCost.ok) return { ok: false, error: unitCost.error }
  if (unitCost.value !== undefined) input.unit_cost = unitCost.value

  const unitPrice = parseOptionalNumber(raw.unit_price, 'unit_price', {
    allowNull: true,
    min: 0,
  })
  if (!unitPrice.ok) return { ok: false, error: unitPrice.error }
  if (unitPrice.value !== undefined) input.unit_price = unitPrice.value

  if (raw.status !== undefined) {
    const status = String(raw.status)
    if (status !== 'Active' && status !== 'Discontinued') {
      return { ok: false, error: 'Invalid status; use Active or Discontinued' }
    }
    input.status = status as PartStatus
  }

  return { ok: true, input }
}

export function parseUpdatePartBody(
  body: unknown,
): { ok: true; input: UpdatePartInput } | { ok: false; error: string } {
  const parsed = parseCreatePartBody(body)
  if (!parsed.ok) return parsed
  return { ok: true, input: parsed.input }
}
