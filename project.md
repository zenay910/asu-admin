# project.md — Target Cross-App Data Architecture

This document defines the **target** Supabase Postgres architecture shared by `asu-admin`
(writer) and `asu-frontend` (reader), and the **Appliance Lifecycle State Machine** that
governs how an appliance moves through the platform.

It describes the destination across all four waves (`ROADMAP.md`); only Wave 1 entities are
implemented first (`tasks.md`). Everything here is governed by `AGENTS.md` — the schema is
the boundary contract, all writes are Admin-only, and customer visibility is restricted to
`Published` rows.

> **Live-state note (reconciled 2026-05-29):** On the existing `products` / `product_images`
> tables, that `Published`-only restriction is currently enforced **in application code**
> (`asu-frontend` filters `.eq("status","Published")`) — **not** by database RLS. RLS is
> **disabled** on both live tables and **no policies exist**. Moving this enforcement into
> the database is a Wave 1 hardening target (a gated, policy-first task — see `tasks.md`), not
> the current reality. New Wave 1 tables, by contrast, ship with RLS + policies from creation.

---

## 1. Conventions
- **Schema:** `public`.
- **Primary keys:** `uuid` default `gen_random_uuid()`.
- **Timestamps:** `created_at timestamptz not null default now()`, `updated_at timestamptz
  default now()`.
- **Money:** `numeric` (never floats).
- **Relations:** explicit foreign keys; `on update cascade`; choose `on delete` deliberately
  (`restrict` for financial history, `cascade` only for owned child rows like images).
- **RLS:** **target** is RLS enabled on every table, with public/anon read limited to
  customer-visible rows (`Published`-equivalent) and writes restricted to
  authenticated/service contexts. **Current live reality:** RLS is **disabled** on the
  existing `products` / `product_images` tables and there are **no policies**; the
  `Published`-only filter lives in `asu-frontend` application code. New Wave 1 tables must
  ship RLS + policies from creation; legacy-table RLS is migrated separately and policy-first.
- **Enums:** today enforced in app code (`form_import.mjs` `ALLOWED` sets); there are **no
  DB-level CHECK constraints** live. Target is DB-level `check` constraints (or Postgres
  enums) so the contract is enforced at the source — applied only **after** existing data is
  cleaned to satisfy them (see the `status` casing issue below).

---

## 2. Existing Baseline (today)

> The columns below are verified against the **live** database (29 `products`, 84
> `product_images` rows as of 2026-05-29), not just the `supabase_postgresql/*.sql` DDL files
> — which are stale (they omit `age`).

### `products` (legacy flat model — evolves into `appliances`)
`id uuid pk` · `created_at timestamptz` · `updated_at timestamptz` · `title text` ·
`brand text` · `price numeric` · `model_number text` · `type text` · `configuration text` ·
`dimensions jsonb` · `capacity numeric` · `fuel text` · `unit_type text` · `color text` ·
`features json` · `condition text` · `status text` · `description_long text` ·
**`age numeric` (nullable)**

> **Live-only column:** `age numeric` exists live (15/29 rows populated) and is written by the
> admin form (`types.ts`, `form_import.mjs`), but is **missing from `create_products.sql`**.
> The committed DDL is out of date.
>
> **Type note:** `features` is `json` live (and in the DDL). The `appliances` target below
> uses `jsonb`; this is an intentional upgrade for the new table, not a description of `products`.

### `product_images`
`id uuid pk` · `created_at timestamptz` · `product_id uuid → products(id)` · `photo_url text`

> **Live FK quirks:** `product_id` is **nullable** with a `gen_random_uuid()` default, and the
> FK is `ON UPDATE CASCADE` only (no `ON DELETE`). The random-uuid default is a footgun (an
> image inserted without a product silently gets a non-matching id → orphan). The new
> `appliance_images` table (§3.2) deliberately fixes this with a non-null FK and `ON DELETE CASCADE`.

App-enforced enum values today (no DB CHECK constraints exist live):
- `configuration`: Front Load, Top Load, Stacked Unit, Standard, Slide-In, Glass Cooktop, Coil Cooktop
- `unit_type`: Individual, Set
- `fuel`: Electric, Gas
- `condition`: New, Good, Fair, Poor
- `status` (code `ALLOWED` set): Draft, Published, Archived

> **Live `status` data drift:** actual rows contain `Published` (17), `Sold` (7), and
> **`SOLD` (5, uppercase)** — no `Draft`/`Archived` rows. Note: `Sold` is written by
> `asu-frontend` directly and is **not** in the admin `ALLOWED.status` set, and the `SOLD`/`Sold`
> casing is inconsistent. This data **must be cleaned to a single canonical casing before any
> `status` CHECK constraint or products→appliances backfill** (see `tasks.md` Phase 0).
> Live `type` values also include `Electric Range` alongside `Range`.

Storage: bucket `appliances` (public), object path `${id}/original/${index}.${ext}`.

---

## 3. Target Cross-App Architecture

> Wave 1 introduces `appliances`, `parts`, and `part_compatibility`. Waves 2–4 introduce
> `customers`, `jobs`, `job_parts`, `invoices`, `invoice_line_items`, and `bookings`. All
> additions are backward-compatible with the existing storefront reads.

### 3.1 `appliances` (Wave 1) — the catalog unit
The structured successor to `products`. Represents a single sellable/serviceable unit.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `title` | text not null | |
| `brand` | text | |
| `model_number` | text | |
| `type` | text | Washer, Dryer, Refrigerator, Range, … |
| `configuration` | text | check-constrained enum |
| `unit_type` | text | Individual, Set |
| `fuel` | text | Electric, Gas, null |
| `color` | text | |
| `capacity` | numeric | cu. ft. |
| `dimensions` | jsonb | `{width_in, depth_in, height_in, unit_of_measure}` |
| `features` | jsonb | string array |
| `condition` | text | New, Good, Fair, Poor |
| `price` | numeric | |
| `lifecycle_state` | text not null default `'Intake'` | **see §4** |
| `status` | text | storefront visibility (`Published`/`Draft`/`Archived`/`Sold`) |
| `description_long` | text | |
| `created_at` / `updated_at` | timestamptz | |

> Migration note: `products` is retained until the storefront and admin both read
> `appliances`. Introduce additively; do not break `products` reads in the same task.

### 3.2 `appliance_images` (Wave 1)
Mirrors `product_images` for the appliance unit: `id`, `created_at`, `appliance_id →
appliances(id) on delete cascade`, `photo_url text not null`, `sort_order int default 0`.

### 3.3 `parts` (Wave 1) — parts inventory
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `part_number` | text not null | unique business identifier |
| `name` | text not null | |
| `description` | text | |
| `brand` | text | |
| `category` | text | e.g. Belt, Pump, Heating Element, Board |
| `quantity_on_hand` | int not null default 0 | non-negative (check) |
| `reorder_threshold` | int default 0 | low-stock trigger |
| `location` | text | bin/shelf |
| `unit_cost` | numeric | acquisition cost |
| `unit_price` | numeric | resale/billed price |
| `status` | text not null default `'Active'` | Active, Discontinued |
| `created_at` / `updated_at` | timestamptz | |

### 3.4 `part_compatibility` (Wave 1) — part ↔ appliance link
Many-to-many compatibility mapping.
`id uuid pk` · `part_id uuid → parts(id) on delete cascade` · `appliance_id uuid →
appliances(id) on delete cascade` · `notes text` · `created_at timestamptz` ·
unique `(part_id, appliance_id)`.

> Compatibility may also be expressed against `brand`/`model_number` patterns; the explicit
> link table is the source of truth for confirmed matches.

### 3.5 `customers` (Wave 3)
`id` · `full_name` · `email` · `phone` · `address jsonb` · `notes` · timestamps.
Relates to appliances/jobs/invoices.

### 3.6 `jobs` (Wave 2) — work orders
`id` · `appliance_id → appliances(id)` · `customer_id → customers(id)` (nullable until W3) ·
`job_type` · `state` (Open → In Progress → Completed → Closed) · `summary` · `labor_cost` ·
timestamps.

### 3.7 `job_parts` (Wave 2) — parts consumed by a job
`id` · `job_id → jobs(id) on delete cascade` · `part_id → parts(id) on delete restrict` ·
`quantity int` · `unit_price numeric` (snapshot). Drives `parts.quantity_on_hand` drawdown.

### 3.8 `invoices` + `invoice_line_items` (Wave 2)
`invoices`: `id` · `job_id → jobs(id)` · `customer_id → customers(id)` · `status` (Draft →
Issued → Paid → Void) · `subtotal` · `tax` · `total` · `issued_at` · timestamps.
`invoice_line_items`: `id` · `invoice_id → invoices(id) on delete cascade` · `kind`
(labor/part) · `description` · `quantity` · `unit_price` · `line_total`.

### 3.9 `bookings` (Wave 4) — constrained intake
`id` · `customer_name` · `contact` · `service_type` · `requested_at` · `state` (Pending →
Triaged → Converted → Rejected) · `notes` · timestamps. Anonymous insert through a narrow,
validated boundary only; triaged into `jobs` by the Admin App.

### 3.10 Relationship Overview
```
appliances 1──* appliance_images
appliances *──* parts            (via part_compatibility)
appliances 1──* jobs
customers  1──* appliances / jobs / invoices
jobs       1──* job_parts *──1 parts
jobs       1──1 invoices 1──* invoice_line_items
bookings   ──▶ jobs              (triage/convert)
```

---

## 4. Appliance Lifecycle State Machine (4 stages)

Every appliance has a single authoritative `lifecycle_state`. The Admin App is the **only**
writer of this field; the Customer App observes it (indirectly via `status`). Transitions
are forward-leaning with explicitly allowed paths.

### 4.1 Stages
1. **Intake** — Unit received and logged. Specs may be incomplete (Gemini extraction allowed).
   Not customer-visible.
2. **Refurbishment** — Unit under assessment/repair. Parts may be consumed against it
   (Wave 2 `jobs`/`job_parts`). Not customer-visible.
3. **Listed** — Refurbishment complete and approved for sale; the unit is published to the
   storefront (`status = 'Published'`).
4. **Retired** — Terminal. The unit has left active inventory: **Sold**, **Scrapped**, or
   **Archived**. Not customer-visible (removed from `Published`).

### 4.2 Allowed Transitions
```
        ┌─────────────────────────────────────────────┐
        ▼                                             │ (relist after fix)
   ┌────────┐      ┌──────────────────┐      ┌────────┐      ┌─────────┐
   │ Intake │ ───▶ │ Refurbishment    │ ───▶ │ Listed │ ───▶ │ Retired │
   └────────┘      └──────────────────┘      └────────┘      └─────────┘
        │                   │                     │                ▲
        │                   └─────────────────────┴────────────────┘
        └──────────────────────────────────────────────────────────┘
                 (any active stage → Retired: scrap/archive)
```
- `Intake → Refurbishment` — begin assessment/repair.
- `Refurbishment → Listed` — passed QA; publish.
- `Listed → Refurbishment` — pulled from sale for additional work (relist path).
- `Intake → Retired`, `Refurbishment → Retired`, `Listed → Retired` — sold/scrapped/archived.
- `Retired` is terminal (no automatic transitions out).

### 4.3 Invariants
- `status = 'Published'` is permitted **only** when `lifecycle_state = 'Listed'`.
- Entering `Retired` for a **Sold** reason sets storefront `status = 'Sold'` and removes it
  from public results.
- State changes are written exclusively through an Admin server action/route handler that
  validates the transition against §4.2 (no arbitrary client-driven jumps).
- Transitions should be auditable (target: an `appliance_state_history` log; see `tasks.md`).
