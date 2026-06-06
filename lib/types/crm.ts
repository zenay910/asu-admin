import type { Appliance } from '@/lib/types/inventory'
import type { Invoice, Job } from '@/lib/types/operations'

/** JSONB shape for `customers.address` */
export type CustomerAddress = {
  street?: string
  city?: string
  state?: string
  zip?: string
}

/** Row shape for public.customers */
export type Customer = {
  id: string
  created_at: string
  updated_at: string | null
  full_name: string
  email: string | null
  phone: string | null
  address: CustomerAddress | null
  notes: string | null
}

/** Related records for a customer (owned + sold appliances, jobs, invoices) */
export type CustomerHistory = {
  ownedAppliances: Appliance[]
  soldAppliances: Appliance[]
  jobs: Job[]
  invoices: Invoice[]
}
