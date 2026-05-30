# ROADMAP.md — Product Trajectory

This roadmap describes the ERP upgrade of the ASU dual-repo appliance platform
(`asu-admin` + `asu-frontend`) across **four delivery waves**. Each wave builds on a stable,
human-verified predecessor. Waves are sequenced so the shared Supabase schema evolves
additively and the two apps remain independently deployable at all times.

**Today's baseline (pre-Wave 1):** a single `products` + `product_images` model, an
authenticated Admin inventory CRUD with Gemini-assisted spec extraction, and a read-only
`Published` storefront.

Execution discipline for every wave is governed by `AGENTS.md`: one isolated task at a time,
each with an explicit `Verify` metric, with a human verification gate between tasks. Detailed,
itemized tasks are tracked in `tasks.md` (currently scoped to **Wave 1 only**).

---

## Wave 1 — Advanced Inventory & Parts
**Goal:** Evolve flat inventory into a structured catalog that distinguishes whole
appliances from the parts that service them, and lay the data foundation the later waves
depend on.

**Scope highlights**
- Promote app-enforced enums (`condition`, `status`, `configuration`, `fuel`, `unit_type`)
  toward DB-backed constraints and introduce the **Appliance Lifecycle** status model
  (see `project.md`).
- Introduce a first-class **`appliances`** concept and a **`parts`** inventory with stock
  quantities, locations, and part↔appliance compatibility.
- Define typed data-access hooks/accessors for appliances and parts in the Admin App; keep
  the Customer App read-only.
- Establish RLS for all new tables before any UI consumes them.

**Exit criteria:** Parts and appliances tables exist with RLS, are queryable through typed
backend accessors/hooks, and inventory operations respect the lifecycle states.

---

## Wave 2 — Standardized Operations Forms & Invoicing
**Goal:** Capture the operational work performed on appliances and turn it into billable
documents.

**Scope highlights**
- **Jobs/work orders** linked to appliances and (optionally) customers, with standardized
  intake/diagnostic/repair forms.
- **Parts consumption**: jobs draw down `parts` stock; stock movements are auditable.
- **Invoices** derived from jobs (labor + parts + tax), with status (draft → issued → paid).
- Admin-only authoring; storefront remains unaffected.

**Depends on:** Wave 1 parts/appliances schema and lifecycle states.

---

## Wave 3 — CRM & Basic Financial Dashboard
**Goal:** Make customers first-class and give operators a financial pulse.

**Scope highlights**
- **`customers`** entity with contact details and relationship to appliances/jobs/invoices.
- Customer history views (owned appliances, past jobs, invoices).
- A **basic financial dashboard**: revenue, outstanding invoices, parts cost, inventory
  value — aggregated read models over Wave 1–2 data.

**Depends on:** Wave 2 jobs/invoices.

---

## Wave 4 — Constrained Booking Pipeline
**Goal:** Allow controlled customer-initiated bookings that feed the operations pipeline
without compromising the read-only safety of the storefront.

**Scope highlights**
- A **constrained** booking request flow (capacity/time/service-type limits) surfaced on
  `asu-frontend`, written through a tightly-scoped, validated server boundary — not a broad
  customer write path.
- Booking requests land as pending records the Admin App triages into jobs (Wave 2).
- Guardrails: rate limiting, validation, and RLS that exposes only the booking-intake
  surface to anonymous users.

**Depends on:** Waves 1–3 (appliances, jobs, customers).

---

## Sequencing Principles
1. **Schema-first, additive-only.** Each wave adds nullable columns / new tables; it never
   breaks columns the other app reads.
2. **Backend before UI.** Tables + RLS + typed accessors/hooks land and are verified before
   any consuming UI.
3. **Independent deploys preserved.** No wave forces a simultaneous breaking change across
   both repos.
4. **Human-gated progression.** A wave is "done" only when its tasks' `Verify` metrics are
   met and explicitly approved.
