# tasks.md — Wave 1: Advanced Inventory & Parts

Itemized, **one-task-at-a-time** checklist for **Wave 1 only** (see `ROADMAP.md`).

**Order of execution (hard requirement):**
**Phase 0 (Reconciliation Prerequisites) → Phase A (new-table DDL) → Phase B (RLS on new
tables) → Phase C (backend accessors/hooks/APIs) → Phase D (gated data migration).**

> ### 🚦 Phase 0 is a BLOCKING SAFETY GATE
> Phase 0 reconciles the live database with our plans. **No CHECK constraint that touches
> `status`, and no `products → appliances` backfill, may run until every Phase 0 task is
> complete and human-verified.** This sequencing exists because the live DB (1) has **RLS
> disabled with no policies** on `products`/`product_images`, and (2) holds **dirty `status`
> data** (`SOLD` vs `Sold`) that would violate any naive constraint or corrupt a backfill.

**Execution rules (from `AGENTS.md`):**
- Do **one** task at a time, touching only the files that task requires.
- A task is done only when its **`Verify`** metric is objectively met.
- After each task, **STOP and request human verification** before starting the next.
- Schema changes are idempotent SQL DDL committed to the repo and applied via **tracked
  migrations** (the live DB currently has none).
- **No application code edits or live migrations are executed during planning.** When a task
  reaches execution, it still respects the additive, non-breaking doctrine.

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` `created_at`/`updated_at`,
`numeric` money, RLS on every new table. Admin writes only; storefront read-only.

---

## Phase 0 — Reconciliation Prerequisites (MANDATORY · BLOCKING)

> Verified live baseline (2026-05-29): `products` (29 rows), `product_images` (84 rows); RLS
> **off**, **0** policies, **0** CHECK constraints, **0** tracked migrations; `status` =
> `Published` (17) / `Sold` (7) / `SOLD` (5); live-only `products.age numeric` column.

### 0.1 Capture a baseline migration (source-of-record)
- [x] Without changing the schema, record the **current live schema** as the first tracked
  migration and update the stale committed DDL so it reflects reality — specifically add the
  live-only **`age numeric` (nullable)** column to `create_products.sql`.
- [x] Do **not** alter live tables in this task; it only establishes a faithful source-of-record.
- **Verify:** The committed `products` DDL lists `age numeric`; a diff of the committed schema
  against `list_tables`/`information_schema.columns` for `products` + `product_images` shows
  **zero** differences (columns, types, defaults, FKs all match live).

### 0.2 Audit `status` (and other enum) data drift — read-only
- [x] Re-run the distinct-value census for `status`, `type`, `condition`, `configuration`,
  `fuel`, `unit_type` on live `products`; record exact values + counts.
- [x] Confirm the full scope of casing/typo drift (currently known: `SOLD` × 5 vs `Sold` × 7).
- **Verify:** A recorded census table exists; every distinct `status` value is classified as
  either "canonical" or "needs cleanup", with counts that sum to `total_products` (29).
  → Recorded in `phase-0-enum-census.md`.

### 0.3 Decide the canonical `status` vocabulary
- [x] Ratify the canonical set (proposed: **`Draft`, `Published`, `Sold`, `Archived`** —
  title-case) and map each live variant to its canonical form (`SOLD → Sold`).
- **Verify:** A written mapping covering **every** value observed in 0.2 is approved by a
  human; no observed value is left unmapped.
  → Recorded in `phase-0-status-vocabulary.md`. Human approved.

### 0.4 Clean the live `status` data (idempotent, reversible)
- [x] Apply a targeted, idempotent update normalizing casing per 0.3
  (e.g. `update products set status='Sold' where status='SOLD'`), wrapped so re-running is a no-op.
- [x] This is a **data** change only — **no schema/constraint change** in this task.
- **Verify:** `select distinct status from products` returns **only** canonical values
  (no `SOLD`); row counts are conserved (still 29 total; `Sold` count = previous `Sold` +
  `SOLD` = 12); the storefront still lists the same `Published` items as before.
  → `Published` 17 · `Sold` 12 · total 29 · no `SOLD`.

### 0.5 Align application code expectations (FLAG-ONLY in planning)
- [x] Record the required follow-up code reconciliation (do **not** edit code now): the admin
  `form_import.mjs` `ALLOWED.status` set lacks `Sold`, while `asu-frontend` writes `Sold`
  directly — so re-saving a sold unit currently throws `Invalid status`.
- **Verify:** A tracked code-fix item exists (canonical `status` set shared by both apps),
  explicitly deferred to its own gated task. No code is edited in Phase 0.
  → `phase-0-code-reconciliation.md` (CR-001, CR-002).

### 0.6 Legacy RLS — **POLICY-FIRST** remediation (do NOT enable RLS bare)
> The single biggest "will it break live?" risk. With the storefront on the anon key and no
> policies, enabling RLS first would return **zero rows → blank storefront**. Policies go on
> **before** enforcement, with verification between each step.
- [x] **Step 1 — Author policies (no enforcement yet):** create policies mirroring intended
  access — `products`: public `SELECT` where `status='Published'`, full access for
  `service_role`/authenticated; `product_images`: public `SELECT` where the parent product is
  `Published`, full access for service/authenticated. (RLS still disabled, so behavior is unchanged.)
- [x] **Step 2 — Verify against the anon key (RLS still OFF):** confirm the intended policy
  predicates return exactly the rows the storefront expects.
- [x] **Step 3 — Enable RLS** on `products` then `product_images`.
- [x] **Step 4 — Re-verify the live storefront** end-to-end with the anon key.
- **Verify:** After Step 3, with the **anon key**: `products` returns only `Published` rows and
  `product_images` returns only images of `Published` products; authenticated/service context
  still sees everything; the `asu-frontend` products page renders the **same** published
  inventory as before enabling RLS (no blank screen, identical count). `pg_policies` lists the
  new policies and `rls_enabled = true` on both tables.
  → anon: 17 products / 50 images · authenticated: 29 · service_role: 29 · RLS on both tables · 6 policies.

> ✅ **Phase 0 exit gate:** 0.1–0.6 complete and human-verified. Only now may Phases A–D run.
> Tasks that depend on clean data / source-of-record are explicitly marked **(requires Phase 0)** below.

---

## Phase A — New-Table Database Setup (DDL)

> Strictly **additive**: creates new tables only. Does **not** alter `products` /
> `product_images`, guaranteeing the live storefront and admin keep working.

### A1. `appliances` table DDL
- [x] Create idempotent `create_appliances.sql` per `project.md` §3.1, including
  `lifecycle_state text not null default 'Intake'` and the existing inventory columns
  (title, brand, model_number, type, configuration, unit_type, fuel, color, capacity,
  dimensions jsonb, features jsonb, condition, price, status, description_long, **age numeric**,
  created_at, updated_at). PK `id uuid default gen_random_uuid()`.
- **Verify:** Running on a clean DB creates `appliances`; re-running is a no-op (idempotent);
  an empty `select` returns 0 rows with all columns/types confirmed via `information_schema.columns`.
  → 20 columns · 0 rows · re-run success.

### A2. Lifecycle & enum CHECK constraints on `appliances` **(requires Phase 0)**
- [x] Add `check` constraints: `lifecycle_state IN ('Intake','Refurbishment','Listed','Retired')`,
  `condition IN ('New','Good','Fair','Poor')`, **`status IN ('Draft','Published','Sold','Archived')`
  (the canonical set ratified in 0.3)**, and `configuration`/`unit_type`/`fuel` matching the
  `ALLOWED` sets in `form_import.mjs`.
- [x] Add invariant guard: `status='Published'` only when `lifecycle_state='Listed'` (table `check`).
- **Verify:** Inserting an invalid `lifecycle_state`, a non-canonical `status` (e.g. `SOLD`), or
  `status='Published'` with `lifecycle_state<>'Listed'` is **rejected**; a valid row
  (`lifecycle_state='Listed'`, `status='Published'`) inserts. (Depends on 0.3/0.4 so the
  canonical set is authoritative.)
  → 3 rejects (23514) · valid insert OK · test row deleted.

### A3. `appliance_images` table DDL
- [x] Create `create_appliance_images.sql` per `project.md` §3.2: `id`, `created_at`,
  `appliance_id uuid NOT NULL → appliances(id) ON DELETE CASCADE`, `photo_url text not null`,
  `sort_order int default 0`. **Deliberately fixes the legacy footgun** (no nullable FK, no
  `gen_random_uuid()` default on the FK).
- **Verify:** Insert referencing a real appliance succeeds; a non-existent `appliance_id` is
  rejected by the FK; a NULL `appliance_id` is rejected by NOT NULL; deleting the parent
  cascades (child count = 0).
  → valid insert OK · FK 23503 · NOT NULL 23502 · cascade delete verified (0 child rows).

### A4. `parts` table DDL
- [x] Create `create_parts.sql` per `project.md` §3.3: `part_number` (unique, not null),
  `name` (not null), `quantity_on_hand int not null default 0 check (>= 0)`,
  `reorder_threshold`, `location`, `unit_cost`, `unit_price`,
  `status default 'Active' check (status IN ('Active','Discontinued'))`, timestamps.
- **Verify:** Creates idempotently; duplicate `part_number` rejected (unique); negative
  `quantity_on_hand` rejected (check); a valid part inserts and is selectable.
  → re-run OK · duplicate 23505 · negative qty 23514 · valid insert/select OK · 0 rows after cleanup.

### A5. `part_compatibility` table DDL
- [x] Create `create_part_compatibility.sql` per `project.md` §3.4: `part_id → parts(id) on
  delete cascade`, `appliance_id → appliances(id) on delete cascade`, `notes`, `created_at`,
  unique `(part_id, appliance_id)`.
- **Verify:** A valid link inserts; a duplicate pair is rejected; deleting either parent
  removes the link (cascade confirmed).
  → valid link OK · duplicate 23505 · delete part → 0 links · cleanup done.

### A6. `appliance_state_history` audit table DDL
- [x] Create `create_appliance_state_history.sql`: `id`, `appliance_id → appliances(id) on
  delete cascade`, `from_state text`, `to_state text not null`, `changed_by uuid`,
  `reason text`, `created_at timestamptz default now()`.
- **Verify:** Inserting a transition record succeeds and is queryable ordered by `created_at`;
  FK rejects unknown `appliance_id`.
  → 2 rows ordered by `created_at` · bad FK 23503 · cleanup done (0 history rows).

### A7. `updated_at` maintenance
- [x] Add a shared `set_updated_at()` function + `before update` triggers on `appliances` and
  `parts` (idempotent create-or-replace).
- **Verify:** Updating a row on these tables advances `updated_at` past `created_at` without
  the app setting it explicitly.
  → `appliances` + `parts` both `updated_at > created_at` after update · cleanup done.

### A8. Indexes for query paths
- [x] Add indexes: `appliances(status)`, `appliances(lifecycle_state)`, `parts(category)`,
  `part_compatibility(appliance_id)`, `part_compatibility(part_id)`,
  `appliance_images(appliance_id)`.
- **Verify:** Indexes exist (`pg_indexes`); `EXPLAIN` on a `status`/`lifecycle_state` filter and
  on a compatibility lookup shows index usage (not a full seq scan on seeded data).
  → 6/6 indexes in `pg_indexes` · Index Scan on `appliances_status_idx`, `appliances_lifecycle_state_idx`, `part_compatibility_appliance_id_idx` (seeded data) · cleanup done.

---

## Phase B — RLS on New Tables (must precede any consumption)

> New tables ship RLS + policies together, from creation. (Legacy-table RLS was already
> handled, policy-first, in **Phase 0.6**.)

### B1. RLS on `appliances`
- [x] Enable RLS. Public/anon read **only** where `status='Published'`. Authenticated/service:
  full access.
- **Verify:** Anon key returns only `Published` appliances (0 non-published); authenticated/
  service sees all; anon `insert`/`update` denied.
  → RLS on · 3 policies · anon 1 published / 0 non-published · auth+service 2 · anon insert 42501 · anon update 0 rows.

### B2. RLS on `appliance_images`
- [x] Enable RLS. Public read only for images whose parent appliance is `Published` (EXISTS
  subquery). Authenticated/service: full access.
- **Verify:** Anon can read images of a `Published` appliance and **cannot** read images of a
  non-published one; anon writes denied.
  → RLS on · 3 policies · anon 1 image · auth 2 · anon insert 42501 · cleanup done.

### B3. RLS on `parts`, `part_compatibility`, `appliance_state_history`
- [x] Enable RLS on all three. **No anon access** (internal-only): read/write restricted to
  authenticated/service role.
- **Verify:** Anon `select` on each returns 0 rows / permission denied; authenticated context
  can read/write; policies confirmed via `pg_policies`.
  → RLS on all 3 · 6 policies (2/table) · anon 0/0/0 · auth 1/1/1 + write OK · cleanup done.

---

## Phase C — Backend Accessors, Hooks & APIs (Admin App)

> Typed data-access layer first, then route handlers. UI deferred. Reuse
> `lib/supabase/server.ts` / `client.ts`; do not hand-roll clients.

### C1. Shared TypeScript types
- [x] Add `Appliance`, `ApplianceImage`, `Part`, `PartCompatibility`, and
  `LifecycleState`/enum types (e.g. `lib/types/inventory.ts`) matching the DDL exactly,
  including `age` and the canonical `status` union.
- **Verify:** `npm run lint` and `tsc --noEmit` pass; enum unions match the DB check
  constraints 1:1.
  → `lib/types/inventory.ts` · lint 0 errors · `tsc --noEmit` OK.

### C2. Lifecycle transition helper (pure, replaceable)
- [x] Add a pure module exporting allowed transitions and `canTransition(from, to)` per
  `project.md` §4.2.
- **Verify:** Every allowed transition returns `true` and every disallowed one returns `false`,
  including `Retired` as terminal.
  → `lib/inventory/lifecycle.ts` · 16/16 transition pairs verified · `tsc` OK.

### C3. `appliances` server accessors
- [x] Add `lib/data/appliances.ts`: `listAppliances(filters)`, `getApplianceById(id)`,
  `createAppliance(input)`, `updateAppliance(id, input)`, using the cookie-bound server client.
- **Verify:** From a server scratch invocation, `create` then `getById` round-trips a row;
  `list` honors filters; all calls go through `lib/supabase/server.ts`.
  → `lib/data/appliances.ts` · all four accessors + `runApplianceAccessorSmokeTest()` (create →
  get → list filter → update → delete cleanup) · only `@/lib/supabase/server` · live CRUD parity
  on `appliances` (insert/select/filter/update/delete) · `npm run lint` 0 errors · `tsc` OK.

### C4. `transitionApplianceState` server action
- [x] Add a `"use server"` action that validates via C2, updates `lifecycle_state`, enforces the
  `Published⇒Listed` invariant, writes an `appliance_state_history` row, and `revalidatePath`s.
- **Verify:** A valid transition updates state **and** inserts a history row; an invalid
  transition is rejected with a friendly error and makes **no** DB change.
  → `lib/inventory/transition-appliance-state.ts` · `transitionApplianceState` + `runTransitionApplianceStateSmokeTest()` ·
  `canTransition` gate before writes · `Published⇒Listed` via `resolveStatusForTransition` · history rollback on insert failure ·
  live Intake→Refurbishment + history row · `npm run lint` 0 errors · `tsc` OK.

### C5. `parts` server accessors
- [x] Add `lib/data/parts.ts`: `listParts(filters)`, `getPartById(id)`, `createPart(input)`,
  `updatePart(id, input)`, `adjustStock(id, delta)` (guards non-negative stock).
- **Verify:** Round-trip create/get/update works; `adjustStock` changes `quantity_on_hand`; an
  adjustment that would go negative is rejected (no row change).
  → `lib/data/parts.ts` · five accessors + `runPartsAccessorSmokeTest()` · only `@/lib/supabase/server` ·
  `adjustStock` pre-check before update (10→7; −100 throws, qty unchanged) · live CRUD parity ·
  `npm run lint` 0 errors · `tsc` OK.

### C6. `part_compatibility` accessors
- [x] Add `linkPartToAppliance`, `unlinkPart`, `listCompatibleParts(applianceId)`,
  `listCompatibleAppliances(partId)`.
- **Verify:** Link then `listCompatibleParts` returns the part; duplicate link rejected; unlink
  removes it; lookups resolve both directions.
  → `lib/data/part-compatibility.ts` · link/unlink/list both directions · duplicate `23505` ·
  `runPartCompatibilityAccessorSmokeTest()` · live link count=1 · `lint` 0 errors · `tsc` OK.

### C7. `/api/parts` route handler
- [x] Add `app/api/parts/route.ts` (GET list / POST create) following the existing
  `app/api/inventory/route.ts` shape: typed success/error JSON, auth required, validation
  errors → HTTP 400.
- **Verify:** `POST` valid body creates a part → `{success:true, partId}`; `POST` missing a
  required field → `400` with message; `GET` returns the created part; unauthenticated rejected.
  → `app/api/parts/route.ts` · GET `?id=` / list · POST `{success,partId}` · 400 validation · 401 auth ·
  `tsc` OK · unauthenticated GET → 401 when dev server up.

### C8. Client hooks for Admin UI consumption
- [x] Add `useAppliances`, `useParts` hooks wrapping the browser client / route handlers with
  loading + error state, mirroring existing fetch patterns. No new pages/UI wiring.
- **Verify:** From a temporary probe, hooks return data with correct `loading`/`error`
  transitions and surface errors without throwing; `npm run lint` passes.
  → `lib/hooks/use-appliances.ts` (browser client) · `lib/hooks/use-parts.ts` (`/api/parts`) ·
  `lib/hooks/c8-probe.tsx` (unwired) · loading→settled, errors via `error` not throw · `lint` 0 errors · `tsc` OK.

---

## Phase D — Data Migration: `products` → `appliances` (GATED · requires Phase 0)

> Optional within Wave 1 and **strictly gated**. Runs only after Phase 0 (clean `status`,
> baseline migration) and Phases A–B (target table + constraints + RLS) are verified.
> `products`/`product_images` remain intact until both apps cut over (separate, later task).

### D1. Backfill dry-run (read-only)
- [ ] Produce a non-writing mapping of every `products` row to an `appliances` row (incl. `age`,
  `features` json→jsonb cast, canonical `status`, derived initial `lifecycle_state`).
- **Verify:** The dry-run reports 29 source rows mapped, **zero** rows that would violate any
  A2 CHECK (proving 0.4 cleanup worked), and a deterministic `lifecycle_state` for each row.

### D2. Execute idempotent backfill
- [ ] Insert mapped rows into `appliances` (and images into `appliance_images`) idempotently
  (safe to re-run; keyed to avoid duplicates).
- **Verify:** `appliances` count = `products` count (29); `appliance_images` count =
  `product_images` count (84); re-running inserts 0 additional rows; spot-checked rows match
  source field-for-field; no CHECK/RLS errors.

---

## Wave 1 Exit Criteria
- [ ] **Phase 0 complete & verified:** baseline migration captured, DDL un-stale (`age`),
  `status` data normalized to canonical casing, and legacy RLS enabled **policy-first** with
  the storefront confirmed unaffected.
- [ ] All Phase A tables exist with constraints, triggers, indexes (idempotent, additive DDL).
- [ ] RLS enabled and verified on every new table (Phase B).
- [ ] Typed accessors/hooks/route handlers for appliances and parts exist and are verified (Phase C).
- [ ] Lifecycle transitions enforced in DB + backend; storefront still reads only permitted rows.
- [ ] Any data migration (Phase D) ran only after the Phase 0 gate, with row counts conserved.
- [ ] Each task above was completed individually and **human-verified** before the next began.
