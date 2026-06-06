# tasks.md — Wave 3: CRM & Basic Financial Dashboard

Itemized, **one-task-at-a-time** checklist for **Wave 3 only** (see `ROADMAP.md`).

**Goal:** Make customers first-class in the platform and give operators a financial pulse.
Introduce a **`customers`** entity with contact details and relationships to appliances, jobs,
and invoices; surface customer history views (owned appliances, past jobs, invoices); and extend
the overview dashboard with a **basic financial dashboard** — revenue, outstanding invoices,
parts cost, and inventory value — as aggregated read models over Wave 1–2 data.

**Order of execution (hard requirement):**
**Phase A (DDL) → Phase B (RLS) → Phase C (backend accessors/hooks/APIs + financial read
models) → Phase F (Admin UI).**

> Wave 3 needs **no Phase 0**: Wave 1 + Wave 2 exit criteria are met, RLS + tracked migrations
> are in place, and all new work is **strictly additive** (new `customers` table + nullable FK
> columns/constraints on existing tables). `products` / `product_images` reads are never altered,
> so the storefront and existing Admin flows keep working throughout.

**Execution rules (from `AGENTS.md`):**
- Do **one** task at a time, touching only the files that task requires.
- A task is done only when its **`Verify`** metric is objectively met.
- After each task, **STOP and request human verification** before starting the next.
- Schema changes are idempotent SQL DDL committed to the repo under
  `supabase_postgresql/migrations/<YYYYMMDDHHMMSS>_<name>.sql` and applied via **tracked
  migrations**.
- Mirror the established Wave 1–2 patterns: internal-only RLS
  (`...130200_internal_tables_rls.sql`), accessors (`lib/data/parts.ts`), route handlers
  (`app/api/parts/route.ts`), hooks (`lib/hooks/use-parts.ts`), and the typed `useActionState`
  + `*FormState` form pattern for UI mutations.

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` `created_at`/`updated_at`,
`numeric` money, RLS on every new table. Admin writes only; storefront read-only.

---

## Confirmed scope decisions (ratified during planning)

### Customers are internal-only PII
- `customers` is **never** exposed to the anon key or `asu-frontend`.
- RLS: authenticated + service_role full access; **no anon** (same pattern as `jobs`,
  `invoices`, `parts`).

### Wave 2 placeholder columns promoted to real FKs
Wave 2 created `jobs.customer_id` and `invoices.customer_id` as nullable columns **without
FK constraints** (see `create_invoices.sql` — "no FK — added in Wave 3"). Wave 3 adds the
constraints:
- `jobs.customer_id → customers(id) on delete set null`
- `invoices.customer_id → customers(id) on delete restrict`

### Owned appliances — dual model
Customer appliance history is surfaced **both** ways:
1. **Explicit ownership:** nullable `appliances.customer_id → customers(id) on delete set null`
   (e.g. a customer-owned unit brought in for service).
2. **Sale-derived:** appliances sold to the customer via `appliance_sale` invoices
   (`invoices.customer_id` + `invoices.appliance_id`).

The history accessor unions both sets (deduplicated by `appliance_id`).

### `on delete` policy (Wave 3 additions)
| FK | on delete | rationale |
|---|---|---|
| `invoices.customer_id` | **restrict** | financial history must survive |
| `jobs.customer_id` | **set null** | unlink job, don't destroy work record |
| `appliances.customer_id` | **set null** | unlink appliance, don't destroy catalog row |

### Financial dashboard metrics (read-only aggregates)
Extends the existing `lib/data/dashboard-stats.ts` / `app/dashboard/page.tsx` — does **not**
replace the operational stats cards (F5.1/F5.2). New metrics:
- **Revenue:** sum of `invoices.total` where `status in ('Issued','Paid')`.
- **Outstanding:** sum + count of `invoices.total` where `status = 'Issued'` (unpaid issued).
- **Parts cost:** Σ `parts.quantity_on_hand * parts.unit_cost` (inventory acquisition cost).
- **Inventory value:** sum of `appliances.price` where `lifecycle_state <> 'Retired'` + parts
  cost (total asset value on hand).

### Data flow added by Wave 3
```
customers 1──* appliances (customer_id; explicit ownership)
customers 1──* jobs (customer_id)
customers 1──* invoices (customer_id)
customers ──▶ appliance_sale invoices ──▶ sold appliances (derived history)
```

---

## Phase A — Database Setup (DDL)

> Strictly **additive**: creates the `customers` table, adds FK constraints to existing
> nullable columns, and adds a nullable `appliances.customer_id`. Does **not** alter
> `products` / `product_images`, guaranteeing the live storefront keeps working.

### A1. `customers` table DDL
- [x] Create idempotent `create_customers.sql` migration per `project.md` §3.5:
  `id uuid pk default gen_random_uuid()`, `full_name text not null`, `email text`,
  `phone text`, `address jsonb` (e.g. `{street, city, state, zip}`), `notes text`,
  `created_at`/`updated_at timestamptz`.
- **Verify:** Running on a clean DB creates `customers`; re-running is a no-op (idempotent);
  a row with `full_name` inserts; all columns/types confirmed via `information_schema.columns`.

### A2. FK constraints on `jobs.customer_id` and `invoices.customer_id`
- [x] Add FK constraints to the existing nullable columns (Wave 2 left them unconstrained):
  `jobs.customer_id → customers(id) on delete set null`;
  `invoices.customer_id → customers(id) on delete restrict`.
- **Verify:** Inserting a job/invoice with a non-existent `customer_id` is rejected (`23503`);
  inserting with a valid `customer_id` succeeds; deleting a customer referenced by an invoice
  is **rejected** (`23503`, restrict); deleting a customer referenced only by a job sets
  `jobs.customer_id` to NULL (job row preserved).

### A3. `appliances.customer_id` column + FK
- [x] Add nullable `customer_id uuid null → customers(id) on delete set null` to
  `appliances` (additive column only — **not** mirrored to `products`).
- **Verify:** Column exists and is nullable; a valid `customer_id` links; a bad `customer_id`
  is rejected (`23503`); deleting the customer sets `appliances.customer_id` to NULL;
  `products` table schema is unchanged.

### A4. Indexes for query paths
- [x] Add indexes: `jobs(customer_id)`, `invoices(customer_id)`,
  `appliances(customer_id)`, and a `customers` search index on `lower(full_name)` and/or
  `lower(email)` (expression index or btree on `email`).
- **Verify:** All indexes exist (`pg_indexes`); `EXPLAIN` on a `jobs.customer_id` filter and
  a `customers` name search shows Index Scan (not a full seq scan) on seeded data.

### A5. `updated_at` maintenance on `customers`
- [x] Attach the existing shared `set_updated_at()` `before update` trigger to `customers`
  (idempotent create).
- **Verify:** Updating a `customers` row advances `updated_at` past `created_at` without the
  app setting it explicitly.

---

## Phase B — RLS on New Table (must precede any consumption)

> `customers` ships RLS + policies together, from creation. Internal-only (PII): authenticated
> + service_role full access, **no anon access**. Follows the `...130200_internal_tables_rls.sql`
> pattern.

### B1. RLS on `customers`
- [x] Enable RLS on `customers`. Authenticated + service_role full access; **no anon**.
- **Verify:** Anon `select` returns 0 rows / permission denied; authenticated context can
  read/write; `pg_policies` lists the policies and `rls_enabled = true` on the table.

---

## Phase C — Backend Accessors, Hooks, APIs & Financial Read Models (Admin App)

> Typed data-access layer first, then route handlers, then hooks, then financial read models.
> Reuse `lib/supabase/server.ts` / `client.ts`; do not hand-roll clients.

### C1. Shared TypeScript types
- [x] Add `lib/types/crm.ts` with `Customer`, `CustomerAddress` (jsonb shape), and
  `CustomerHistory` (owned appliances, sold appliances, jobs, invoices) matching the DDL.
- **Verify:** `npm run lint` and `tsc --noEmit` pass; `Customer` fields match the DB columns
  1:1.

### C2. `customers` server accessors
- [x] Add `lib/data/customers.ts`: `listCustomers(filters)` (incl. `search` on name/email),
  `getCustomerById(id)`, `createCustomer(input)`, `updateCustomer(id, input)`,
  `deleteCustomer(id)` (reject when invoices reference the customer), using the cookie-bound
  server client; include `runCustomersAccessorSmokeTest()`.
- **Verify:** From a server scratch invocation, `create` then `getById` round-trips; `list`
  honors search filter; `delete` on a customer with invoices is rejected with a friendly error
  and no row removed; all calls go through `@/lib/supabase/server`; `npm run lint` and `tsc`
  pass.

### C3. Customer history accessor
- [x] Add `getCustomerHistory(id)` to `lib/data/customers.ts` (or a sibling
  `lib/data/customer-history.ts`): return owned appliances (`appliances.customer_id = id`),
  sold appliances (via `appliance_sale` invoices with `customer_id = id`), linked jobs
  (`jobs.customer_id = id`), and invoices (`invoices.customer_id = id`); deduplicate
  appliances across owned + sold sets.
- **Verify:** For a seeded customer with one owned appliance, one sold appliance (via
  `appliance_sale` invoice), one job, and two invoices, the accessor returns all four sets
  with correct counts and no duplicate appliance rows.

### C4. `/api/customers` route handler
- [x] Add `app/api/customers/route.ts` (GET list / `?id=` single / `?id=&history=true` with
  history, POST create) following the `app/api/parts/route.ts` shape: typed success/error JSON,
  auth required, validation errors → HTTP 400.
- **Verify:** `POST` valid body → `{success:true, customerId}`; `POST` missing `full_name` →
  `400`; `GET` returns the created customer; `GET ?id=&history=true` returns history payload;
  unauthenticated → `401`.

### C5. Client hook for Admin UI consumption
- [x] Add `lib/hooks/use-customers.ts` wrapping the route handler with loading + error state,
  mirroring `lib/hooks/use-parts.ts`. Support `?history=true` for detail pages.
- **Verify:** From a temporary unwired probe, hook exposes correct `loading`/`error`
  transitions and surfaces errors without throwing; `npm run lint` passes.

### C6. Link `customer_id` in jobs and invoices accessors
- [x] Extend `lib/data/jobs.ts` and `lib/data/invoices.ts` `create`/`update` inputs to accept
  and persist optional `customer_id`; validate the customer exists when non-null.
- **Verify:** Creating a job and an invoice each with a valid `customer_id` round-trips the
  link; creating with `customer_id: null` still succeeds; a non-existent `customer_id` is
  rejected before insert.

### C7. Financial summary read model
- [x] Add `lib/data/financial-summary.ts` exporting `getFinancialSummary()` with:
  `revenueTotal` (sum `invoices.total` where `status in ('Issued','Paid')`),
  `outstandingTotal` + `outstandingCount` (sum + count where `status = 'Issued'`),
  `partsCostTotal` (Σ `quantity_on_hand * unit_cost`), `inventoryValueTotal`
  (non-`Retired` appliance `price` sum + `partsCostTotal`).
- **Verify:** Each metric matches a direct DB query/sum for the same predicate on seeded data;
  `npm run lint` and `tsc` pass.

### C8. `/api/dashboard/financial` route + hook
- [x] Add `app/api/dashboard/financial/route.ts` (GET, auth required) returning C7 metrics;
  add `lib/hooks/use-financial-summary.ts` wrapping it.
- **Verify:** Authenticated `GET` returns all four metrics; unauthenticated → `401`; hook
  loading/error transitions work without throwing.

---

## Phase F — Admin UI (Customers CRM + Financial Dashboard)

> Built on the existing shadcn UI stack and Wave 1–2 frontend patterns (`frontend-tasks.md`).
> Default to **Server Components**; add `"use client"` only where interactivity requires it.
> Mutations go through Server Actions / route handlers — never write Supabase directly from a
> client component. After a mutation, `revalidatePath(...)` affected routes.

### F1. Customers list page
- [ ] Add `app/dashboard/customers/page.tsx` via `useCustomers`: `DataTable` with columns
  (full_name, email, phone) + search input (name/email) + skeleton loading + empty state.
- **Verify:** Lists customers from `/api/customers`; search narrows results; loading and empty
  states render without throwing.

### F2. New/edit customer form
- [ ] Add `app/dashboard/customers/new/page.tsx` and `app/dashboard/customers/edit/[id]/page.tsx`
  with a shared form using the typed `useActionState` + `CustomerFormState` pattern; fields:
  full_name (required), email, phone, address (street/city/state/zip), notes; POST via server
  action or `/api/customers`.
- **Verify:** Create returns a `customerId` and the customer appears in the list; edit persists
  changes; missing `full_name` surfaces a field-level error (no crash).

### F3. Customer detail + history page
- [ ] Add `app/dashboard/customers/[id]/page.tsx`: contact card (name, email, phone, address,
  notes) + tabbed history from `getCustomerHistory` / `useCustomers({ id, history: true })`:
  **Owned Appliances**, **Sold Appliances**, **Jobs**, **Invoices** — each tab links to the
  respective detail page.
- **Verify:** Renders a seeded customer with all contact fields; each tab shows the correct
  related records; owned and sold appliance tabs are distinct (no duplicates when an appliance
  appears in both sources).

### F4. Customer selector on job and invoice forms
- [ ] Add an optional customer picker (searchable select via `useCustomers`) to
  `app/dashboard/jobs/new/job-form.tsx` (Customer-class jobs) and
  `app/dashboard/invoices/new/appliance-sale/appliance-sale-invoice-form.tsx`; persist
  `customer_id` on create.
- **Verify:** Creating a Customer job with a selected customer stores `customer_id` and it
  appears on the job detail page; creating an appliance-sale invoice with a customer links
  `invoices.customer_id`; leaving the picker empty still creates successfully.

### F5. Financial dashboard section
- [ ] Add a financial metrics panel to `app/dashboard/page.tsx` (below the existing F5.1
  operational stats) via `useFinancialSummary` / `getFinancialSummary`: cards for Revenue,
  Outstanding (total + count), Parts Cost, and Inventory Value.
- **Verify:** Each card figure matches a direct DB sum for the same query; cards render with
  skeleton loading and handle API errors via toast without throwing.

### F6. Navigation + QA gate
- [ ] Add **Customers** to `components/dashboard-navbar.tsx` (between Jobs and Invoices);
  ensure all new customer routes have loading/empty/error states; run `npm run lint` and
  `next build`.
- **Verify:** Nav link routes to `/dashboard/customers` with correct active state; all four
  new customer routes + the financial panel handle loading/empty/error; `npm run lint` and
  `next build` pass with no type errors.

---

## Wave 3 Exit Criteria
- [ ] `customers` table exists with constraints, indexes, and `updated_at` trigger (idempotent,
  additive DDL); `products` / `product_images` reads untouched.
- [ ] RLS enabled and verified **internal-only** on `customers` (Phase B); no anon access.
- [ ] FK constraints on `jobs.customer_id`, `invoices.customer_id`, and `appliances.customer_id`
  enforce the documented `on delete` policies (Phase A2/A3).
- [ ] Customer history returns owned appliances (`appliances.customer_id`), sold appliances
  (via `appliance_sale` invoices), jobs, and invoices — deduplicated (Phase C3/F3).
- [ ] Jobs and invoices can be linked to a customer at create/update time (Phase C6/F4).
- [ ] Financial dashboard shows revenue, outstanding invoices, parts cost, and inventory value
  matching direct DB aggregates (Phase C7/C8/F5).
- [ ] Customers list, create/edit forms, detail+history, and nav are wired (Phase F).
- [ ] Storefront unaffected; each task above was completed individually and **human-verified**
  before the next began.
