import type { Customer } from '@/lib/types/crm'
import type { CustomerFormValues } from './types'

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    full_name: customer.full_name,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    address_street: customer.address?.street ?? '',
    address_city: customer.address?.city ?? '',
    address_state: customer.address?.state ?? '',
    address_zip: customer.address?.zip ?? '',
    notes: customer.notes ?? '',
  }
}
