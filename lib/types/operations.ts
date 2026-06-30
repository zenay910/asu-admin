/** Matches `jobs_job_class_check` on public.jobs */
export type JobClass = 'Internal' | 'Customer'

/** Matches `jobs_state_check` on public.jobs */
export type JobState = 'Open' | 'In Progress' | 'Completed' | 'Closed'

/** Matches `jobs_job_type_check` on public.jobs */
export type JobType =
  | 'Intake'
  | 'Diagnostic'
  | 'Repair'
  | 'Cleaning'
  | 'Delivery'
  | 'Installation'
  | 'Maintenance'
  | 'Warranty'

/** Matches `invoices_invoice_type_check` on public.invoices */
export type InvoiceType = 'job' | 'appliance_sale' | 'retail'

/** Matches `invoices_status_check` on public.invoices */
export type InvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Void'

/** Payment method for appliance sale invoices (stored in invoices.payment_method). */
export type PaymentMethod = 'cash_venmo_zelle' | 'debit_card' | 'credit_card'

/** Matches `invoice_line_items_kind_check` on public.invoice_line_items */
export type LineItemKind =
  | 'labor'
  | 'part'
  | 'appliance'
  | 'fee'
  | 'discount'
  | 'trade_in'

/** Row shape for public.jobs */
export type Job = {
  id: string
  created_at: string
  updated_at: string | null
  appliance_id: string | null
  customer_id: string | null
  job_class: JobClass
  job_type: JobType
  state: JobState
  summary: string | null
  details: Record<string, unknown> | null
  labor_cost: number
}

/** Row shape for public.job_state_history */
export type JobStateHistory = {
  id: string
  created_at: string
  job_id: string
  from_state: JobState | null
  to_state: JobState
  changed_by: string | null
  reason: string | null
}

/** Row shape for public.job_parts */
export type JobPart = {
  id: string
  created_at: string
  job_id: string
  part_id: string
  quantity: number
  unit_price: number
}

/** `job_parts` row with joined part catalog fields for display */
export type JobPartLine = JobPart & {
  part_number: string
  part_name: string
}

export type JobDetail = {
  job: Job
  stateHistory: JobStateHistory[]
  jobParts: JobPartLine[]
}

/** Row shape for public.part_stock_movements */
export type PartStockMovement = {
  id: string
  created_at: string
  part_id: string
  job_part_id: string | null
  refurbishment_part_id: string | null
  delta: number
  quantity_after: number
  reason: string | null
  changed_by: string | null
}

/** Row shape for public.invoices */
export type Invoice = {
  id: string
  created_at: string
  updated_at: string | null
  invoice_number: string
  invoice_type: InvoiceType
  job_id: string | null
  appliance_id: string | null
  customer_id: string | null
  status: InvoiceStatus
  subtotal: number
  tax: number
  surcharge: number
  total: number
  payment_method: PaymentMethod | null
  issued_at: string | null
}

/** Row shape for public.invoice_line_items */
export type InvoiceLineItem = {
  id: string
  created_at: string
  invoice_id: string
  kind: LineItemKind
  part_id: string | null
  appliance_id: string | null
  description: string | null
  quantity: number
  unit_price: number
  line_total: number
  taxable: boolean
}
