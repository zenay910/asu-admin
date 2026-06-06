import { createClient } from '@/lib/supabase/server'
import type {
  Customer,
  CustomerAddress,
  CustomerHistory,
} from '@/lib/types/crm'
import type { Appliance, LifecycleState } from '@/lib/types/inventory'
import type {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  Job,
  JobClass,
  JobState,
  JobType,
} from '@/lib/types/operations'

export type CustomerListFilters = {
  search?: string
  limit?: number
}

export type CreateCustomerInput = {
  full_name: string
  email?: string | null
  phone?: string | null
  address?: CustomerAddress | null
  notes?: string | null
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>

function mapCustomerAddress(value: unknown): CustomerAddress | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const row = value as Record<string, unknown>
  return {
    street: row.street != null ? String(row.street) : undefined,
    city: row.city != null ? String(row.city) : undefined,
    state: row.state != null ? String(row.state) : undefined,
    zip: row.zip != null ? String(row.zip) : undefined,
  }
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    full_name: String(row.full_name),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    address: mapCustomerAddress(row.address),
    notes: row.notes != null ? String(row.notes) : null,
  }
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

function customerHasInvoiceHistoryMessage(): string {
  return 'Cannot delete this customer because they have invoice history.'
}

function mapAppliance(row: Record<string, unknown>): Appliance {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    title: String(row.title),
    brand: String(row.brand),
    price: Number(row.price),
    model_number: String(row.model_number),
    type: row.type != null ? String(row.type) : null,
    configuration: (row.configuration as Appliance['configuration']) ?? null,
    dimensions: (row.dimensions as Appliance['dimensions']) ?? null,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    fuel: (row.fuel as Appliance['fuel']) ?? null,
    unit_type: (row.unit_type as Appliance['unit_type']) ?? null,
    color: row.color != null ? String(row.color) : null,
    features: (row.features as Appliance['features']) ?? null,
    condition: (row.condition as Appliance['condition']) ?? null,
    lifecycle_state: row.lifecycle_state as LifecycleState,
    status: (row.status as Appliance['status']) ?? null,
    description_long:
      row.description_long != null ? String(row.description_long) : null,
    age: row.age != null ? Number(row.age) : null,
  }
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    appliance_id: row.appliance_id != null ? String(row.appliance_id) : null,
    customer_id: row.customer_id != null ? String(row.customer_id) : null,
    job_class: row.job_class as JobClass,
    job_type: row.job_type as JobType,
    state: row.state as JobState,
    summary: row.summary != null ? String(row.summary) : null,
    details: (row.details as Job['details']) ?? null,
    labor_cost: Number(row.labor_cost),
  }
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    invoice_number: String(row.invoice_number),
    invoice_type: row.invoice_type as InvoiceType,
    job_id: row.job_id != null ? String(row.job_id) : null,
    appliance_id: row.appliance_id != null ? String(row.appliance_id) : null,
    customer_id: row.customer_id != null ? String(row.customer_id) : null,
    status: row.status as InvoiceStatus,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    issued_at: row.issued_at != null ? String(row.issued_at) : null,
  }
}

export async function listCustomers(
  filters: CustomerListFilters = {},
): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  const search = filters.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  throwOnError(error, 'Failed to list customers')
  return (data ?? []).map((row) => mapCustomer(row as Record<string, unknown>))
}

export async function assertCustomerExists(
  customerId: string | null | undefined,
): Promise<void> {
  if (customerId == null) return
  const customer = await getCustomerById(customerId)
  if (!customer) {
    throw new Error('Customer not found')
  }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch customer')
  if (!data) return null
  return mapCustomer(data as Record<string, unknown>)
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const supabase = await createClient()
  const payload = {
    full_name: input.full_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('*')
    .single()

  throwOnError(error, 'Failed to create customer')
  return mapCustomer(data as Record<string, unknown>)
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update customer')
  return mapCustomer(data as Record<string, unknown>)
}

export async function getCustomerHistory(id: string): Promise<CustomerHistory | null> {
  const customer = await getCustomerById(id)
  if (!customer) return null

  const supabase = await createClient()

  const { data: ownedRows, error: ownedError } = await supabase
    .from('appliances')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
  throwOnError(ownedError, 'Failed to fetch owned appliances')

  const ownedAppliances = (ownedRows ?? []).map((row) =>
    mapAppliance(row as Record<string, unknown>),
  )
  const ownedIds = new Set(ownedAppliances.map((row) => row.id))

  const { data: saleInvoiceRows, error: saleInvoiceError } = await supabase
    .from('invoices')
    .select('appliance_id')
    .eq('customer_id', id)
    .eq('invoice_type', 'appliance_sale')
    .not('appliance_id', 'is', null)
  throwOnError(saleInvoiceError, 'Failed to fetch sold appliance invoices')

  const soldApplianceIds = [
    ...new Set(
      (saleInvoiceRows ?? [])
        .map((row) =>
          row.appliance_id != null ? String(row.appliance_id) : null,
        )
        .filter((applianceId): applianceId is string =>
          applianceId != null && !ownedIds.has(applianceId),
        ),
    ),
  ]

  let soldAppliances: Appliance[] = []
  if (soldApplianceIds.length > 0) {
    const { data: soldRows, error: soldError } = await supabase
      .from('appliances')
      .select('*')
      .in('id', soldApplianceIds)
      .order('created_at', { ascending: false })
    throwOnError(soldError, 'Failed to fetch sold appliances')
    soldAppliances = (soldRows ?? []).map((row) =>
      mapAppliance(row as Record<string, unknown>),
    )
  }

  const { data: jobRows, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
  throwOnError(jobsError, 'Failed to fetch customer jobs')

  const { data: invoiceRows, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
  throwOnError(invoicesError, 'Failed to fetch customer invoices')

  return {
    ownedAppliances,
    soldAppliances,
    jobs: (jobRows ?? []).map((row) => mapJob(row as Record<string, unknown>)),
    invoices: (invoiceRows ?? []).map((row) =>
      mapInvoice(row as Record<string, unknown>),
    ),
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient()
  const { count, error: countError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id)

  throwOnError(countError, 'Failed to check customer invoices')
  if (count != null && count > 0) {
    throw new Error(customerHasInvoiceHistoryMessage())
  }

  const { error } = await supabase.from('customers').delete().eq('id', id)
  throwOnError(error, 'Failed to delete customer')
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runCustomersAccessorSmokeTest(): Promise<{
  createdId: string
  deletedAfterInvoiceCleanup: boolean
}> {
  const suffix = Date.now()
  const searchToken = `c2-smoke-${suffix}`
  const created = await createCustomer({
    full_name: `C2 Customer ${searchToken}`,
    email: `${searchToken}@example.com`,
    phone: '555-0199',
    address: { street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
    notes: 'C2 accessor smoke',
  })

  const fetched = await getCustomerById(created.id)
  if (
    !fetched ||
    fetched.full_name !== created.full_name ||
    fetched.email !== created.email
  ) {
    throw new Error('getCustomerById round-trip failed')
  }

  const listed = await listCustomers({ search: searchToken })
  if (!listed.some((row) => row.id === created.id)) {
    throw new Error('listCustomers search filter did not return created row')
  }

  const updated = await updateCustomer(created.id, {
    notes: 'C2 accessor smoke updated',
  })
  if (updated.notes !== 'C2 accessor smoke updated') {
    throw new Error('updateCustomer failed')
  }

  const supabase = await createClient()
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_type: 'retail',
      customer_id: created.id,
      status: 'Draft',
    })
    .select('id')
    .single()
  if (invoiceError || !invoiceRow) {
    throw new Error(
      `Failed to create smoke invoice: ${invoiceError?.message ?? 'unknown error'}`,
    )
  }
  const invoiceId = String(invoiceRow.id)

  try {
    await deleteCustomer(created.id)
    throw new Error('Expected deleteCustomer to reject customer with invoices')
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes(customerHasInvoiceHistoryMessage())
    ) {
      throw error
    }
  }

  const stillThere = await getCustomerById(created.id)
  if (!stillThere) {
    throw new Error('Customer row was removed despite invoice history')
  }

  const { error: deleteInvoiceError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
  throwOnError(deleteInvoiceError, 'Failed to clean up smoke invoice')

  await deleteCustomer(created.id)
  const afterDelete = await getCustomerById(created.id)
  if (afterDelete != null) {
    throw new Error('deleteCustomer did not remove row after invoice cleanup')
  }

  return {
    createdId: created.id,
    deletedAfterInvoiceCleanup: true,
  }
}

/** Dev-only history accessor smoke test (authenticated server context required). */
export async function runCustomerHistorySmokeTest(): Promise<{
  ownedCount: number
  soldCount: number
  jobCount: number
  invoiceCount: number
}> {
  const suffix = Date.now()
  const supabase = await createClient()
  const customer = await createCustomer({
    full_name: `C3 History ${suffix}`,
    email: `c3-history-${suffix}@example.com`,
  })

  const { data: ownedApplianceRow, error: ownedApplianceError } = await supabase
    .from('appliances')
    .insert({
      title: `C3 owned ${suffix}`,
      brand: 'Test',
      price: 100,
      model_number: `OWN-${suffix}`,
      customer_id: customer.id,
    })
    .select('id')
    .single()
  if (ownedApplianceError || !ownedApplianceRow) {
    throw new Error(
      `Failed to create owned appliance: ${ownedApplianceError?.message ?? 'unknown error'}`,
    )
  }

  const { data: soldApplianceRow, error: soldApplianceError } = await supabase
    .from('appliances')
    .insert({
      title: `C3 sold ${suffix}`,
      brand: 'Test',
      price: 200,
      model_number: `SOLD-${suffix}`,
    })
    .select('id')
    .single()
  if (soldApplianceError || !soldApplianceRow) {
    throw new Error(
      `Failed to create sold appliance: ${soldApplianceError?.message ?? 'unknown error'}`,
    )
  }

  const ownedApplianceId = String(ownedApplianceRow.id)
  const soldApplianceId = String(soldApplianceRow.id)

  const { data: saleInvoiceRow, error: saleInvoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_type: 'appliance_sale',
      customer_id: customer.id,
      appliance_id: soldApplianceId,
      status: 'Draft',
    })
    .select('id')
    .single()
  if (saleInvoiceError || !saleInvoiceRow) {
    throw new Error(
      `Failed to create appliance_sale invoice: ${saleInvoiceError?.message ?? 'unknown error'}`,
    )
  }

  const { data: retailInvoiceRow, error: retailInvoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_type: 'retail',
      customer_id: customer.id,
      status: 'Draft',
    })
    .select('id')
    .single()
  if (retailInvoiceError || !retailInvoiceRow) {
    throw new Error(
      `Failed to create retail invoice: ${retailInvoiceError?.message ?? 'unknown error'}`,
    )
  }

  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .insert({
      job_class: 'Customer',
      job_type: 'Repair',
      customer_id: customer.id,
      summary: `C3 history job ${suffix}`,
    })
    .select('id')
    .single()
  if (jobError || !jobRow) {
    throw new Error(
      `Failed to create customer job: ${jobError?.message ?? 'unknown error'}`,
    )
  }

  const history = await getCustomerHistory(customer.id)
  if (!history) {
    throw new Error('getCustomerHistory returned null for seeded customer')
  }

  if (history.ownedAppliances.length !== 1) {
    throw new Error(
      `Expected 1 owned appliance, got ${history.ownedAppliances.length}`,
    )
  }
  if (history.soldAppliances.length !== 1) {
    throw new Error(
      `Expected 1 sold appliance, got ${history.soldAppliances.length}`,
    )
  }
  if (history.jobs.length !== 1) {
    throw new Error(`Expected 1 job, got ${history.jobs.length}`)
  }
  if (history.invoices.length !== 2) {
    throw new Error(`Expected 2 invoices, got ${history.invoices.length}`)
  }

  if (history.ownedAppliances[0]?.id !== ownedApplianceId) {
    throw new Error('Owned appliance id mismatch')
  }
  if (history.soldAppliances[0]?.id !== soldApplianceId) {
    throw new Error('Sold appliance id mismatch')
  }

  const applianceIds = new Set([
    ...history.ownedAppliances.map((row) => row.id),
    ...history.soldAppliances.map((row) => row.id),
  ])
  if (applianceIds.size !== 2) {
    throw new Error('Owned and sold appliance sets must not duplicate rows')
  }

  const { error: deleteJobError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobRow.id)
  throwOnError(deleteJobError, 'Failed to clean up smoke job')

  const { error: deleteInvoicesError } = await supabase
    .from('invoices')
    .delete()
    .in('id', [saleInvoiceRow.id, retailInvoiceRow.id])
  throwOnError(deleteInvoicesError, 'Failed to clean up smoke invoices')

  const { error: deleteAppliancesError } = await supabase
    .from('appliances')
    .delete()
    .in('id', [ownedApplianceId, soldApplianceId])
  throwOnError(deleteAppliancesError, 'Failed to clean up smoke appliances')

  await deleteCustomer(customer.id)

  return {
    ownedCount: history.ownedAppliances.length,
    soldCount: history.soldAppliances.length,
    jobCount: history.jobs.length,
    invoiceCount: history.invoices.length,
  }
}
