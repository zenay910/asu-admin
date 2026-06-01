# tasks.md — Wave 2: Standardized Operations Forms & Invoicing

Itemized, **one-task-at-a-time** checklist for **Wave 2 only** (see `ROADMAP.md`).

**Goal:** Capture the operational work performed on appliances (jobs/work orders with
standardized intake/diagnostic/repair forms), distinguish **internal refurbishment** work
from **customer-facing billable services**, draw down `parts` stock auditably, and turn work
**and sales** into billable invoices. Wave 2 supports three invoice sources: a **job**
(service labor + parts), an **appliance sale** (appliance + delivery/installation fees +
accessories + tax), and a **retail** counter sale (parts only).

**Order of execution (hard requirement):**
**Phase A (new-table DDL) → Phase B (RLS on new tables) → Phase C (backend
accessors/hooks/APIs).**

> Wave 2 needs **no Phase 0**: the live database is clean and reconciled (Wave 1 exit),
> RLS + tracked migrations are in place, and all new work is **strictly additive** (new
> tables only). `products` / `product_images` / `appliances` reads are never altered, so the
> storefront and existing Admin flows keep working throughout.

**Execution rules (from `AGENTS.md`):**
- Do **one** task at a time, touching only the files that task requires.
- A task is done only when its **`Verify`** metric is objectively met.
- After each task, **STOP and request human verification** before starting the next.
- Schema changes are idempotent SQL DDL committed to the repo under
  `supabase_postgresql/migrations/<YYYYMMDDHHMMSS>_<name>.sql` and applied via **tracked
  migrations**.
- Mirror the established Wave 1 patterns: internal-only RLS
  (`...130200_internal_tables_rls.sql`), accessors (`lib/data/parts.ts`), the state-machine
  helper + server action (`lib/inventory/lifecycle.ts`,
  `lib/inventory/transition-appliance-state.ts`), and route handlers (`app/api/parts/route.ts`).

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` `created_at`/`updated_at`,
`numeric` money, RLS on every new table. Admin writes only; storefront read-only.

---

## Confirmed scope decisions (ratified during planning)

### Jobs are two-dimensional: internal work vs. customer-facing services
A job shares one lifecycle (`Open → In Progress → Completed → Closed`) but has two contexts:

| | **Internal** (refurbishment) | **Customer** (billable service) |
|---|---|---|
| Purpose | Prep our inventory for sale | Service performed for a customer |
| `appliance_id` | **required** (our `appliances` unit) | optional (customer's unit / none) |
| `job_type` | Intake, Diagnostic, Repair, Cleaning | Diagnostic, Repair, Delivery, Installation, Maintenance, Warranty |
| Invoiceable? | No (internal cost only) | Yes (`generateInvoiceForJob`) |
| Drives appliance lifecycle? | Yes (Intake→Refurbishment→Listed) | No |

- `jobs.job_class text` CHECK `in ('Internal','Customer')`.
- `jobs.appliance_id` is **nullable**; a table CHECK requires it non-null when
  `job_class='Internal'`.
- `jobs.job_type` CHECK enforces the full union
  `('Intake','Diagnostic','Repair','Cleaning','Delivery','Installation','Maintenance','Warranty')`;
  the valid **class↔type pairing** is enforced in the backend (`job-lifecycle.ts`).

### Invoices are source-agnostic (not strictly job-derived)
- `invoices.job_id` is **nullable**; `invoices.invoice_type text` CHECK
  `in ('job','appliance_sale','retail')`.
- `invoices.appliance_id uuid null → appliances(id)` (for appliance sales).
- `invoices.customer_id uuid null` — **no FK** in Wave 2 (`customers` is Wave 3; FK added then).
- `invoice_line_items.kind` CHECK `in ('labor','part','appliance','fee')` — delivery,
  installation and misc charges are `fee` lines; accessories (hoses, vents) are `part` lines.
- Line items carry optional nullable `part_id` / `appliance_id` traceability columns.
- **Sequential invoice number:** `invoices.invoice_number` is unique and human-readable
  (`INV-000123`), backed by a Postgres sequence — in addition to the `uuid` PK.

### Cross-feature behavior
- **Appliance-sale invoices** drive the sold appliance to `Retired` (`status='Sold'`) via the
  existing `transitionApplianceState`, so it leaves the storefront.
- **Retail parts sales** draw down `parts.quantity_on_hand` and write a `part_stock_movements`
  row (no `job_part`), reusing the same audited stock path as job consumption.

### `on delete` policy
Financial/work history uses `restrict` (`jobs.appliance_id`, `job_parts.part_id`,
`invoices.job_id`, `invoices.appliance_id`, `part_stock_movements.part_id`); owned children
use `cascade` (`job_state_history`, `job_parts` by job, `invoice_line_items`); line-item
traceability FKs use `set null` so a financial document survives later catalog cleanup.

### Job state machine (defined in `lib/operations/job-lifecycle.ts`)
```
Open ──▶ In Progress ──▶ Completed ──▶ Closed
  │            │             │
  └─ Closed ◀──┴─────────────┘   (close-early allowed from any non-terminal state)
```
- Allowed: `Open → {In Progress, Closed}`, `In Progress → {Completed, Closed}`,
  `Completed → {Closed}`, `Closed → {}` (terminal).

### Data flow added by Wave 2
```
appliances 1──* jobs 1──* job_parts *──1 parts
     │            │                         │
     │            ├──* job_state_history     └──* part_stock_movements (audit; job OR retail)
     │            └──1 invoices (type=job)
     │
     └──1 invoices (type=appliance_sale) ─┐
   (retail) invoices (type=retail) ───────┴──* invoice_line_items (labor|part|appliance|fee)
```

---

## Phase A — New-Table Database Setup (DDL)

> Strictly **additive**: creates new tables/sequences/triggers/indexes only. Does **not**
> alter `products` / `product_images` / `appliances`, guaranteeing the live storefront and
> existing Admin flows keep working.

### A1. `jobs` table DDL
- [x] Create idempotent `create_jobs.sql` migration per `project.md` §3.6 (extended):
  `id uuid pk default gen_random_uuid()`, `appliance_id uuid null → appliances(id) on delete
  restrict`, `customer_id uuid null` (**no FK — added in Wave 3**), `job_class text not null`,
  `job_type text not null`, `state text not null default 'Open'`, `summary text`,
  `details jsonb` (standardized form payload), `labor_cost numeric not null default 0`,
  `created_at`/`updated_at timestamptz`.
- **Verify:** Running on a clean DB creates `jobs`; re-running is a no-op (idempotent); an
  insert referencing a real appliance succeeds; a non-existent `appliance_id` is rejected by
  the FK (`23503`); a row with `appliance_id` NULL inserts (constrained in A2); all
  columns/types confirmed via `information_schema.columns`.

### A2. `jobs` CHECK constraints
- [x] Add `check` constraints: `job_class in ('Internal','Customer')`;
  `state in ('Open','In Progress','Completed','Closed')`;
  `job_type in ('Intake','Diagnostic','Repair','Cleaning','Delivery','Installation','Maintenance','Warranty')`;
  `labor_cost >= 0`; and a class-targeting table check **`job_class <> 'Internal' or
  appliance_id is not null`** (Internal jobs must reference an inventory appliance).
- **Verify:** Inserting an invalid `job_class`, invalid `state`, invalid `job_type`, negative
  `labor_cost`, or an `Internal` job with NULL `appliance_id` is **rejected** (`23514`); a
  valid `Internal` job (with appliance) and a valid `Customer` job (appliance NULL) both insert.

### A3. `job_state_history` audit table DDL
- [x] Create `create_job_state_history.sql`: `id`, `job_id → jobs(id) on delete cascade`,
  `from_state text`, `to_state text not null`, `changed_by uuid`, `reason text`,
  `created_at timestamptz default now()`. Mirrors `appliance_state_history`.
- **Verify:** A transition record inserts and is queryable ordered by `created_at`; an unknown
  `job_id` is rejected by the FK (`23503`); deleting the parent job cascades child rows to 0.

### A4. `job_parts` table DDL
- [x] Create `create_job_parts.sql` per `project.md` §3.7: `id`, `job_id → jobs(id) on delete
  cascade`, `part_id → parts(id) on delete restrict`, `quantity int not null check (> 0)`,
  `unit_price numeric not null` (snapshot at consumption), `created_at`.
- **Verify:** A valid row inserts; `quantity <= 0` is rejected (`23514`); deleting a part that
  is referenced by a job is rejected (`23503`, restrict); deleting the parent job cascades
  child rows to 0.

### A5. `part_stock_movements` audit table DDL
- [x] Create `create_part_stock_movements.sql`: `id`, `part_id → parts(id) on delete
  restrict`, `job_part_id uuid null → job_parts(id) on delete set null`, `delta int not null`,
  `quantity_after int not null`, `reason text`, `changed_by uuid`, `created_at`. Supports both
  job consumption (`job_part_id` set) and retail sales (`job_part_id` NULL).
- **Verify:** A movement row inserts with and without `job_part_id`; a bad `part_id` is
  rejected (`23503`); deleting the source `job_part` sets `job_part_id` to NULL (the movement
  row is preserved for audit).

### A6. `invoice_number` sequence + `invoices` table DDL
- [x] Create `create_invoices.sql`: a sequence `invoice_number_seq`, then `invoices` per
  `project.md` §3.8 (extended): `id uuid pk`, `invoice_number text not null unique default
  ('INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0'))`, `invoice_type text not null
  default 'job'`, `job_id uuid null → jobs(id) on delete restrict`, `appliance_id uuid null →
  appliances(id) on delete restrict`, `customer_id uuid null` (**no FK — added in Wave 3**),
  `status text not null default 'Draft'`, `subtotal numeric not null default 0`, `tax numeric
  not null default 0`, `total numeric not null default 0`, `issued_at timestamptz null`,
  `created_at`/`updated_at`.
- **Verify:** Two inserts receive distinct, sequential `invoice_number`s; a duplicate explicit
  `invoice_number` is rejected (`23505`); a bad `job_id`/`appliance_id` is rejected (`23503`);
  re-running the migration is idempotent.

### A7. `invoices` type/status & source-consistency CHECK constraints
- [x] Add `check` constraints: `invoice_type in ('job','appliance_sale','retail')`;
  `status in ('Draft','Issued','Paid','Void')`; non-negative `subtotal`/`tax`/`total`; and a
  source-consistency check — `invoice_type='job'` ⇒ `job_id is not null`;
  `invoice_type='appliance_sale'` ⇒ `appliance_id is not null`; `invoice_type='retail'` ⇒
  `job_id is null`.
- **Verify:** A `job` invoice with NULL `job_id`, an `appliance_sale` with NULL `appliance_id`,
  a `retail` with a non-null `job_id`, an invalid `status`, and any negative total are each
  rejected (`23514`); one valid invoice of each type inserts.

### A8. `invoice_line_items` table DDL
- [x] Create `create_invoice_line_items.sql` per `project.md` §3.8 (extended): `id`,
  `invoice_id → invoices(id) on delete cascade`, `kind text check (kind in
  ('labor','part','appliance','fee'))`, `part_id uuid null → parts(id) on delete set null`,
  `appliance_id uuid null → appliances(id) on delete set null`, `description text`,
  `quantity numeric not null default 1`, `unit_price numeric not null default 0`,
  `line_total numeric not null default 0`, `created_at`.
- **Verify:** A line of each `kind` inserts; an invalid `kind` is rejected (`23514`); deleting
  the parent invoice cascades line items to 0; deleting a referenced part/appliance sets the
  traceability column to NULL (line preserved).

### A9. `updated_at` maintenance
- [x] Attach the existing shared `set_updated_at()` `before update` trigger to `jobs` and
  `invoices` (idempotent create).
- **Verify:** Updating a row on `jobs` and on `invoices` advances `updated_at` past
  `created_at` without the app setting it explicitly.

### A10. Indexes for query paths
- [x] Add indexes: `jobs(appliance_id)`, `jobs(state)`, `jobs(job_class)`,
  `job_parts(job_id)`, `job_parts(part_id)`, `part_stock_movements(part_id)`,
  `invoices(job_id)`, `invoices(appliance_id)`, `invoices(invoice_type)`, `invoices(status)`,
  `invoice_line_items(invoice_id)`.
- **Verify:** All indexes exist (`pg_indexes`); `EXPLAIN` on a `jobs.state` filter and on a
  `job_parts(job_id)` lookup shows Index Scan (not a full seq scan) on seeded data.

---

## Phase B — RLS on New Tables (must precede any consumption)

> New tables ship RLS + policies together, from creation. Every Wave 2 table is
> **internal-only** (operations + financial data): authenticated + service_role full access,
> **no anon access**. Follows the `...130200_internal_tables_rls.sql` pattern.

### B1. RLS on `jobs` + `job_state_history`
- [x] Enable RLS on both. Authenticated + service_role full access; **no anon**.
- **Verify:** Anon `select` on each returns 0 rows / permission denied; authenticated context
  can read/write both; `pg_policies` lists the policies and `rls_enabled = true` on both tables.

### B2. RLS on `job_parts` + `part_stock_movements`
- [x] Enable RLS on both with the same internal-only pattern.
- **Verify:** Anon `select` on each returns 0 / permission denied; authenticated context can
  read/write both; policies confirmed via `pg_policies`.

### B3. RLS on `invoices` + `invoice_line_items`
- [x] Enable RLS on both with the same internal-only pattern (financial data — never anon).
- **Verify:** Anon `select` on each returns 0 / permission denied; authenticated context can
  read/write both; policies confirmed via `pg_policies`.

---

## Phase C — Backend Accessors, Hooks & APIs (Admin App)

> Typed data-access layer first, then state-machine/actions, then route handlers, then hooks.
> No new pages/UI wiring. Reuse `lib/supabase/server.ts` / `client.ts`; do not hand-roll clients.

### C1. Shared TypeScript types
- [x] Add `lib/types/operations.ts` with `Job`, `JobClass`, `JobState`, `JobType`,
  `JobStateHistory`, `JobPart`, `PartStockMovement`, `Invoice`, `InvoiceType`,
  `InvoiceStatus`, `InvoiceLineItem`, `LineItemKind`, matching the DDL/check constraints
  exactly (incl. nullable `appliance_id`/`job_id` and the traceability columns).
- **Verify:** `npm run lint` and `tsc --noEmit` pass; every enum union matches its DB check
  constraint 1:1.

### C2. Job state machine + type taxonomy helper (pure, replaceable)
- [x] Add `lib/operations/job-lifecycle.ts` exporting `ALLOWED_JOB_TRANSITIONS`,
  `getAllowedJobTransitions(from)`, `canTransitionJob(from, to)`, plus `JOB_TYPES_BY_CLASS`
  and `isValidJobTypeForClass(jobClass, jobType)` (Internal: Intake/Diagnostic/Repair/Cleaning;
  Customer: Diagnostic/Repair/Delivery/Installation/Maintenance/Warranty).
- **Verify:** Every allowed transition returns `true` and every disallowed one returns
  `false` (`Closed` terminal); `isValidJobTypeForClass` accepts each valid class↔type pair and
  rejects cross-class pairs (e.g. `Internal`+`Delivery` → `false`); `tsc` OK.

### C3. `jobs` server accessors
- [x] Add `lib/data/jobs.ts`: `listJobs(filters)` (incl. `job_class`/`state`/`job_type`),
  `getJobById(id)`, `createJob(input)`, `updateJob(id, input)`, using the cookie-bound server
  client; validate class↔type via C2 and the Internal⇒appliance_id rule; include
  `runJobsAccessorSmokeTest()`.
- **Verify:** From a server scratch invocation, `create` then `getById` round-trips both an
  Internal and a Customer job; an invalid class↔type pair and an Internal job without an
  appliance are rejected before insert; `list` honors filters; all calls go through
  `@/lib/supabase/server`; `npm run lint` and `tsc` pass.

### C4. `transitionJobState` server action
- [x] Add `lib/operations/transition-job-state.ts` (`"use server"`): auth gate, validate via
  C2, update `state`, write a `job_state_history` row (rollback on insert failure), and
  `revalidatePath`.
- **Verify:** A valid transition updates `state` **and** inserts one history row; an invalid
  transition is rejected with a friendly error and makes **no** DB change.

### C5. `consumePartsForJob` server action (job stock drawdown + audit)
- [x] Add `lib/operations/consume-parts.ts` (`"use server"`): insert `job_parts` row(s)
  snapshotting `parts.unit_price`, decrement `parts.quantity_on_hand` (reuse/guard the
  non-negative `adjustStock` rule), and write a `part_stock_movements` row (with `job_part_id`)
  per consumption.
- **Verify:** Consuming N units inserts a `job_parts` row, reduces `quantity_on_hand` by N,
  and inserts a movement whose `quantity_after` matches the new stock; a consumption exceeding
  available stock is **rejected** with **no** `job_parts`, movement, or stock change.

### C6. Generalized stock-movement helper (retail/non-job path)
- [x] Add a reusable stock drawdown in the parts layer (e.g. `recordStockMovement(partId,
  delta, { reason, jobPartId? , changedBy })`) that decrements `parts.quantity_on_hand` and
  writes a `part_stock_movements` row, usable when there is **no** job (retail sales). C5 may
  be refactored to call it.
- **Verify:** A non-job drawdown of N units reduces `quantity_on_hand` by N and writes one
  movement with `job_part_id` NULL and correct `quantity_after`; an over-draw is rejected with
  no stock/movement change.

### C7. `invoices` accessors + total recompute
- [x] Add `lib/data/invoices.ts`: `listInvoices(filters)` (incl. `invoice_type`/`status`),
  `getInvoiceById(id)` (with line items), `createInvoice(input)`, `addLineItem(invoiceId,
  input)` (computes `line_total = quantity * unit_price`), and `recomputeInvoiceTotals(id)`
  (sum line items → `subtotal`, apply `tax` → `total`).
- **Verify:** Adding mixed-`kind` line items then calling `recomputeInvoiceTotals` yields
  `subtotal = Σ line_total` and `total = subtotal + tax`; round-trip create/get works for each
  `invoice_type`.

### C8. `generateInvoiceForJob` server action (Customer jobs)
- [x] Add `lib/operations/generate-invoice-for-job.ts` (`"use server"`): only for
  `job_class='Customer'` jobs in `Completed`/`Closed`; create a `job` invoice with one `labor`
  line (`jobs.labor_cost`) + one `part` line per `job_parts` row (snapshot `unit_price`), then
  recompute totals.
- **Verify:** Generating from a Customer job with labor + 2 consumed parts produces a `job`
  invoice with 3 line items and correct totals; generating from an `Internal` job or an
  ineligible state is rejected.

### C9. `createApplianceSaleInvoice` server action (+ lifecycle → Sold)
- [x] Add `lib/operations/create-appliance-sale-invoice.ts` (`"use server"`): create an
  `appliance_sale` invoice with an `appliance` line (the appliance price), optional `fee` lines
  (delivery/installation), and optional `part` lines (accessories — hoses, vents); recompute
  totals; then transition the appliance to `Retired` (`status='Sold'`) via
  `transitionApplianceState`.
- **Verify:** Selling an appliance with price + a delivery fee + 2 accessory parts produces an
  `appliance_sale` invoice whose line kinds/total are correct **and** the appliance ends in
  `lifecycle_state='Retired'`, `status='Sold'`; a sale of an already-`Retired` appliance is
  rejected with no invoice created.

### C10. `createRetailInvoice` server action (counter parts sale)
- [x] Add `lib/operations/create-retail-invoice.ts` (`"use server"`): create a `retail`
  invoice (no job) with `part` line(s), draw down stock for each via C6, optionally add `fee`
  lines, then recompute totals.
- **Verify:** A retail sale of 3 units of a part creates a `retail` invoice with the part line
  + correct total, reduces `quantity_on_hand` by 3, and writes a `part_stock_movements` row
  with `job_part_id` NULL; an oversell is rejected with **no** invoice/stock/movement change.

### C11. `/api/jobs` route handler
- [x] Add `app/api/jobs/route.ts` (GET list / `?id=` single, POST create) following the
  `app/api/parts/route.ts` shape: typed success/error JSON, auth required, validation errors
  (bad class↔type, Internal without appliance) → HTTP 400.
- **Verify:** `POST` valid body → `{success:true, jobId}`; `POST` an invalid class↔type or
  Internal-without-appliance → `400` with message; `GET` returns the created job;
  unauthenticated → `401`.

### C12. `/api/invoices` route handler
- [x] Add `app/api/invoices/route.ts` (GET list / `?id=` single with line items, POST) that
  dispatches by `invoice_type` to C8 (`job`), C9 (`appliance_sale`), or C10 (`retail`); same
  typed/auth/validation shape.
- **Verify:** `POST` of each `invoice_type` → `{success:true, invoiceId}` with computed totals
  (and, for `appliance_sale`, the appliance flipped to `Sold`); a missing/ineligible source →
  `400`; `GET` returns the invoice + its line items; unauthenticated → `401`.

### C13. Client hooks for Admin UI consumption
- [x] Add `lib/hooks/use-jobs.ts` and `lib/hooks/use-invoices.ts` wrapping the route handlers
  with loading + error state, mirroring `lib/hooks/use-parts.ts`. No new pages/UI wiring.
- **Verify:** From a temporary unwired probe, hooks expose correct `loading`/`error`
  transitions and surface errors without throwing; `npm run lint` passes.

---

## Wave 2 Exit Criteria
- [ ] All Phase A tables exist with constraints, sequence, triggers, and indexes (idempotent,
  additive DDL); `products` / `product_images` / `appliances` reads untouched.
- [ ] RLS enabled and verified **internal-only** on all six new tables (Phase B).
- [ ] Jobs distinguish `Internal` vs `Customer` class with enforced class↔type pairings;
  `Internal` jobs require an appliance, `Customer` jobs may target a customer-owned/none unit.
- [ ] Job state transitions enforced in the backend and audited in `job_state_history`.
- [ ] Parts consumption (job) and retail drawdown both reduce `parts.quantity_on_hand` and are
  audited in `part_stock_movements`; over-consumption/oversell is rejected.
- [ ] Invoices support all three sources — `job`, `appliance_sale`, `retail` — with
  `labor`/`part`/`appliance`/`fee` line items, recomputed totals, and a unique sequential
  `invoice_number`.
- [ ] Appliance-sale invoices drive the appliance to `Retired` (`status='Sold'`) via
  `transitionApplianceState`.
- [ ] Typed accessors/hooks/route handlers for jobs and invoices exist and are verified (Phase C).
- [ ] Storefront unaffected; each task above was completed individually and **human-verified**
  before the next began.
