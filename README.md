# ASU Admin — Appliance Refurbishment & Resale ERP

**ASU Admin** is the internal operations platform for a small appliance refurbishment and
resale business. It's a full ERP that takes a used appliance from the moment it arrives at
the shop, through diagnosis and repair, onto the sales floor, out the door as a sale, and
into the books — while keeping a public storefront, a parts inventory, work orders,
invoicing, a lightweight CRM, and a financial dashboard all in sync against a single source
of truth.

It is the authenticated, operator-facing half of a **two-app platform**:

- **`asu-admin`** (this repo) — the internal Admin App. Authenticated operators create and
  mutate all data. Next.js 16 App Router, runs on port `3001`.
- **`asu-frontend`** — the public, anonymous, **read-only** storefront that customers browse.
  Next.js 15, runs on port `3000`.

Both apps deploy independently and communicate **only** through one shared Supabase Postgres
database, one Auth instance, and one Storage bucket. The database schema is the contract
between them; all writes are Admin-only.

> This README documents `asu-admin`, the app I designed and built. The storefront lives in a
> separate repository.

---

## Table of Contents

1. [Why this project exists](#why-this-project-exists)
2. [Highlights](#highlights)
3. [Tech stack](#tech-stack)
4. [Feature tour](#feature-tour)
5. [Architecture](#architecture)
6. [The appliance lifecycle state machine](#the-appliance-lifecycle-state-machine)
7. [Data model](#data-model)
8. [AI-assisted spec extraction](#ai-assisted-spec-extraction)
9. [Google Merchant integration](#google-merchant-integration)
10. [Project structure](#project-structure)
11. [Getting started](#getting-started)
12. [Engineering principles](#engineering-principles)

---

## Why this project exists

Refurbishing and reselling appliances is a surprisingly data-heavy operation. A single dryer
might be logged at intake, diagnosed, repaired with three parts pulled from stock, cleaned,
tested, photographed, listed for sale, published to Google's local shopping listings, sold to
a walk-in customer, and invoiced — each step producing state that has to stay consistent.

Off-the-shelf tools handle slices of this (billing here, inventory there), but nothing tied
the physical lifecycle of a unit to its sales listing, its parts consumption, and its books.
ASU Admin models the whole pipeline as one coherent system, purpose-built around how the
shop actually works.

## Highlights

- **End-to-end appliance lifecycle** modeled as an explicit, server-enforced state machine
  (`Intake → Refurbishment → Listed → Retired`) with an audited transition history.
- **AI-assisted intake** — snap a photo of an appliance's model-number tag and Google Gemini
  extracts a full, structured spec sheet (brand, capacity, dimensions, features, marketing
  copy) directly into the inventory form.
- **Parts inventory with auditable stock movements** — every quantity change (consumed by a
  job or a refurbishment, or manually adjusted) is recorded as an immutable ledger entry.
- **Refurbishment bay board** — a shop-floor view of which units are in which physical bay
  and what stage of repair they're at.
- **Three flavors of invoicing** — service jobs, appliance sales (with trade-ins, fees, and
  payment-method surcharges), and retail parts sales — all producing printable documents.
- **Financial dashboard** — revenue, outstanding receivables, parts cost, and live inventory
  value aggregated across the operational data.
- **Google Merchant sync** — publishing an appliance to the storefront can push it to Google
  local inventory listings and flip it to out-of-stock when it sells.
- **Strict architectural discipline** — a documented boundary contract between the two apps,
  server-only writes, Row Level Security on every new table, and tracked SQL migrations.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) |
| UI runtime | **React 19** |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind CSS v4** + `shadcn`-style primitives on **Radix UI** |
| Icons | **lucide-react** |
| Database / Auth / Storage | **Supabase** (Postgres + Row Level Security, Supabase Auth, Storage) |
| Supabase clients | `@supabase/ssr` (server & middleware), `@supabase/supabase-js` (service role) |
| AI | **Google Gemini** (`@google/generative-ai`, `gemini-2.5-flash`) |
| Notifications | **sonner** toasts |
| Theming | **next-themes** |
| Image handling | **browser-image-compression** for client-side compression before upload |

## Feature tour

Navigation is organized into the operator's day-to-day areas:

### Inventory
- List, filter, and view appliances with their lifecycle state and storefront status.
- Create appliances manually or via **AI extraction** from a model-tag photo / model number.
- **Appliance sets** — group individual units (e.g. a matching washer + dryer) into a
  sellable set with ordered members.
- Multi-image upload to Supabase Storage with client-side compression and sort ordering.
- **Lifecycle controls** that only expose transitions the state machine permits.
- A dual-write bridge that keeps the legacy `products` storefront table mirrored while the
  platform migrates to the structured `appliances` model.

### Refurbishments
- An **active bay dashboard** showing each physical repair bay, its machine type, and the
  unit currently occupying it.
- A structured intake → diagnostic → repair → testing → completed workflow capturing
  symptoms, error codes, work needed, cleaning status, test-mode results, and cost.
- **Consume parts** against a refurbishment, drawing down stock with a recorded movement.

### Parts
- Full parts catalog with quantity on hand, reorder thresholds, bin location, unit cost, and
  unit price.
- **Stock adjustment dialog** with reason tracking; low-stock and non-negative guards.
- **Part ↔ appliance compatibility** management from either side of the relationship.

### Jobs (work orders)
- Internal (refurbishment) and customer-facing job types (Diagnostic, Repair, Cleaning,
  Delivery, Installation, Maintenance, Warranty).
- State machine: `Open → In Progress → Completed → Closed`, with transition history.
- Consume parts into a job (labor + parts), then **generate an invoice** from the job.

### Customers (CRM)
- Customer records with contact details, address, and notes.
- **History tabs** surfacing a customer's owned appliances, jobs, and invoices.
- Quick-add customer flow available inline while writing an invoice.

### Invoices
- Three invoice types, each with its own tailored builder:
  - **Job invoices** generated from a completed work order.
  - **Appliance-sale invoices** with line items for the appliance, trade-ins, discounts,
    fees, tax handling per line, and **payment-method surcharges**.
  - **Retail invoices** for over-the-counter parts sales.
- Status lifecycle: `Draft → Issued → Paid` (or `Void`).
- **Print-ready invoice documents** with a dedicated print stylesheet.

### Dashboard
- Quick-link cards into each area.
- Operational stat cards and a **financial summary** (revenue, outstanding invoices, parts
  cost, inventory value).
- A recent-activity feed across the platform.

## Architecture

### Two apps, one contract
The Customer App and Admin App are deployed and versioned independently and never import each
other's code. They coordinate solely through the shared database, Storage bucket, and Auth
instance. Schema changes are **additive and backward-compatible by default** so one app can
evolve without breaking the other.

### Server-first Next.js
- **Server Components by default**; `"use client"` only where interactivity requires it.
- **All mutations are Server Actions or Route Handlers** — a client component never writes to
  Supabase directly. After a successful write, the affected routes are revalidated.
- Forms use a typed `*FormState` + `useActionState` pattern with field-level errors and
  input preservation on failure.

### Auth & route protection
`middleware.ts` refreshes the Supabase session on every request and guards everything under
`/dashboard`; unauthenticated users are redirected to the login page, and already-authenticated
users are bounced away from it.

### Layered data access
Supabase access is confined to a wrapper layer rather than sprinkled through the UI:

- `lib/supabase/server.ts` — cookie-bound client for Server Components / Actions / handlers.
- `lib/supabase/client.ts` — browser client for client components.
- `lib/supabase/service.ts` — service-role client for privileged, server-only operations.
- `lib/data/*` — typed read accessors (appliances, parts, jobs, invoices, customers, …).
- `lib/operations/*` — write/transition operations (state transitions, invoice generation,
  parts consumption) that encapsulate the business rules.
- `lib/hooks/*` — client-side data hooks over the API routes.

### Migrations as source of truth
Schema changes are written as idempotent, reviewable SQL DDL and committed under
`supabase_postgresql/migrations/`. New tables ship with **Row Level Security enabled and
explicit policies before any UI consumes them** — public read is limited to customer-visible
(`Published`) rows; writes are restricted to authenticated/service contexts.

## The appliance lifecycle state machine

Every appliance has a single authoritative `lifecycle_state`. The Admin App is the only
writer; the storefront merely observes visibility via `status`. Transitions are validated
server-side against an explicit allow-list — arbitrary client-driven jumps are impossible.

```
        ┌─────────────────────────────────────────────┐
        ▼                                              │ (relist after fix)
   ┌────────┐      ┌────────────────┐      ┌────────┐      ┌─────────┐
   │ Intake │ ───▶ │ Refurbishment  │ ───▶ │ Listed │ ───▶ │ Retired │
   └────────┘      └────────────────┘      └────────┘      └─────────┘
        │                  │                    │               ▲
        │                  └────────────────────┴───────────────┘
        └─────────────────────────────────────────────────────────┘
                 (any active stage → Retired: sold / scrapped / archived)
```

- **Intake** — received and logged; specs may be incomplete. Not customer-visible.
- **Refurbishment** — under assessment/repair; parts may be consumed. Not customer-visible.
- **Listed** — passed QA and published to the storefront (`status = 'Published'`).
- **Retired** — terminal: **Sold**, **Scrapped**, or **Archived**. Removed from the storefront.

**Invariant:** `status = 'Published'` is only permitted while `lifecycle_state = 'Listed'`.
Transitions and their reasons are written to an `appliance_state_history` audit log.

## Data model

The shared Postgres schema (partial, focused on the core entities):

```
appliances ─1──*─ appliance_images
appliances ─1──*─ appliance_state_history
appliances ─*──*─ parts                (via part_compatibility)
appliances ─1──*─ appliance_set_members   (grouping units into sellable sets)
appliances ─1──*─ refurbishments ─1──*─ refurbishment_parts ─*──1 parts
appliances ─1──*─ jobs ─1──*─ job_parts ─*──1 parts
customers  ─1──*─ appliances / jobs / invoices
jobs       ─1──1 invoices ─1──*─ invoice_line_items
parts      ─1──*─ part_stock_movements    (immutable stock ledger)
bays       ─1──*─ refurbishments          (physical repair stations)
```

Conventions across the schema:

- `uuid` primary keys (`gen_random_uuid()`), `timestamptz` `created_at` / `updated_at`.
- **Money is `numeric`, never floating point.**
- Explicit foreign keys with deliberate `on delete` behavior (`cascade` for owned child rows
  like images; `restrict` for financial history).
- Domain enums enforced with `CHECK` constraints and mirrored as TypeScript union types in
  `lib/types/*` so the database and app agree on valid values.

## AI-assisted spec extraction

Intake is the most tedious data-entry step, so it's automated. An operator uploads a photo of
the appliance's model-number tag (or types the model number), and the
`/api/extract-appliance` route sends it to **Gemini 2.5 Flash** with a strict extraction
prompt. The model returns a JSON spec sheet constrained to the inventory form's allowed enum
values (configuration, fuel, etc.), including a generated marketing description. The form is
prefilled and the operator only reviews and corrects.

There's also a `/api/suggest-set` endpoint that helps identify appliances that belong
together as a set.

## Google Merchant integration

When an appliance is published (or sold), `lib/google-merchant.ts` can sync it to **Google
Merchant Center local inventory listings** via the Merchant API:

- OAuth refresh tokens are stored server-side in a `store_settings` table (never exposed to
  the client) and exchanged for short-lived access tokens on demand.
- Publishing pushes the appliance as a `legacyLocal` product scoped to local-inventory
  destinations, mapping condition, price, primary image, and a storefront deep link.
- Selling flips availability to `OUT_OF_STOCK`.
- Sync failures are recorded (with secret-safe diagnostics) and never crash the mutation that
  triggered them.

## Project structure

```
asu-admin/
├── app/
│   ├── page.tsx                 # Login (Supabase Auth)
│   ├── actions.ts               # login / logout server actions
│   ├── api/                     # Route handlers (REST-ish endpoints)
│   │   ├── extract-appliance/   # Gemini spec extraction
│   │   ├── suggest-set/         # AI set suggestions
│   │   ├── inventory · parts · jobs · invoices · customers
│   │   ├── dashboard/           # stats · financial · activity
│   │   └── integrations/google/ # Merchant OAuth + sync
│   └── dashboard/               # Authenticated operator UI
│       ├── inventory/  refurbishments/  parts/
│       ├── jobs/  customers/  invoices/
│       └── *-cards.tsx, *-form.tsx, actions.ts (per-area server actions)
├── components/                  # Shared UI (Radix-based primitives in components/ui)
├── lib/
│   ├── supabase/                # server · client · service clients + storage
│   ├── data/                    # typed read accessors
│   ├── operations/              # business-rule write/transition logic
│   ├── inventory/               # lifecycle, dual-write, product mirror
│   ├── types/                   # domain types mirroring DB CHECK constraints
│   ├── hooks/                   # client data hooks
│   └── google-merchant.ts       # Merchant Center sync
├── supabase_postgresql/
│   └── migrations/              # tracked, idempotent SQL DDL
└── middleware.ts                # session refresh + /dashboard protection
```

## Getting started

### Prerequisites
- Node.js 20+
- A Supabase project (Postgres + Auth + a public `appliances` Storage bucket)
- A Google Gemini API key (for AI extraction)
- *(Optional)* Google Merchant Center + OAuth credentials for storefront sync

### 1. Install
```bash
npm install
```

### 2. Environment
Create `.env.local` in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only

# AI
GEMINI_API_KEY=<gemini-key>                    # server-only

# Google Merchant (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_MERCHANT_ID=...
GOOGLE_MERCHANT_DATASOURCE_ID=...
GOOGLE_MERCHANT_FEED_LABEL=...
GOOGLE_MERCHANT_CONTENT_LANGUAGE=en
GOOGLE_MERCHANT_CURRENCY=USD
GOOGLE_MERCHANT_STORE_CODE=...
STOREFRONT_BASE_URL=https://<storefront-domain>
```

> Only `NEXT_PUBLIC_*` values ever reach the browser. Service-role and API keys are strictly
> server-side.

### 3. Database
Apply the migrations in `supabase_postgresql/migrations/` to your Supabase project (via the
Supabase CLI or your migration tooling of choice).

### 4. Run
```bash
npm run dev      # http://localhost:3001
```

Other scripts:
```bash
npm run build    # production build
npm run start    # serve production build on :3001
npm run lint     # ESLint
```

## Engineering principles

This codebase is built around five explicit tenets (documented in full in `AGENTS.md`):

1. **Well-defined boundaries** — the DB schema is the contract; writes are Admin-only; the
   storefront is read-only.
2. **Composability** — small, single-purpose server actions, route handlers, hooks, and
   accessors composed into features.
3. **Independence** — the two apps deploy separately; schema changes stay additive and
   backward-compatible.
4. **Replaceability** — external SDKs (Supabase, Gemini) sit behind wrapper layers; modules
   are swappable without rewriting callers.
5. **State isolation** — the database is the single source of truth; server and client state
   are kept distinct, with mutations on the server followed by revalidation.

---

*Built as a real, working operations tool. Names and business specifics are lightly
anonymized here for portfolio use.*
