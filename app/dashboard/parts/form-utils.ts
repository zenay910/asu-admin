import type { Part } from '@/lib/types/inventory'
import type { PartFormValues } from './types'

export function partToFormValues(part: Part): PartFormValues {
  return {
    part_number: part.part_number,
    name: part.name,
    description: part.description ?? '',
    brand: part.brand ?? '',
    category: part.category ?? '',
    location: part.location ?? '',
    quantity_on_hand: String(part.quantity_on_hand),
    reorder_threshold:
      part.reorder_threshold != null ? String(part.reorder_threshold) : '',
    unit_cost: part.unit_cost != null ? String(part.unit_cost) : '',
    unit_price: part.unit_price != null ? String(part.unit_price) : '',
    status: part.status,
  }
}
