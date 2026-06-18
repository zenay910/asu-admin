# Active Bay Refurbishment Workflow — Schema & Execution Plan

> Execution doctrine (AGENTS.md §3): one task at a time. After each task, state how the
> `Verify` metric was met, then **STOP and wait for human review/approval** before starting
> the next task. No drive-by refactors. Schema → backend → UI ordering.

---

## Phase 0: Decoupling Boundary (the contract)

The customer-facing Jobs system (`jobs`, `job_state_history`, `job_parts`) stays **completely
untouched** and continues to serve `Customer` service tickets. The internal refurbishment
lifecycle is a **separate set of tables** linked to `appliances`. No edits to the Jobs form,
actions, API, or accessors.

```
Customer tickets (UNCHANGED)          Internal refurbishment (NEW)
  jobs                                   appliances ──┐
   ├─ job_state_history                  bays ────────┤
   └─ job_parts ──┐                      refurbishments
                  ├─> part_stock_movements   ├─ refurbishment_parts ──┘ (shared audit)
                  │                           └─ refurbishment_state_history
```

`part_stock_movements` is the **one shared table**: it gains a nullable
`refurbishment_part_id` alongside the existing `job_part_id` (additive, non-breaking).

### Lifecycle mapping (coexist)

`refurbishments.status` (`staging → diagnostic → repair → testing → completed`) is the granular
sub-state of the existing `appliances.lifecycle_state = 'Refurbishment'`. On `completed`, the
appliance is auto-promoted `Refurbishment → Listed` via the existing
`lib/inventory/transition-appliance-state.ts` (which keeps `status='Published'` gated to
`Listed`). Publishing (photos + retail price) remains a separate, manual step.

### Strict rules

- AI extraction **never** populates `price` or `status` (already true of
  `app/api/extract-appliance/route.ts`; the intake form must keep it that way).
- The Customer App stays read-only; none of these tables are exposed to anon (internal-only RLS).

---

## Phase 1: Database & Schema (DO FIRST)

New idempotent migrations under `supabase_postgresql/migrations/` with prefix `20260618...`,
following existing conventions (uuid PK `gen_random_uuid()`, `timestamptz` defaults, explicit
FKs, internal-only RLS, `drop ... if exists` before re-create).

### 1.1 `bays` (seeded reference table)

```sql
create table if not exists public.bays (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  name text not null,
  machine_type text not null,
  position int not null,
  constraint bays_pkey primary key (id),
  constraint bays_machine_type_check check (machine_type in ('Dryer', 'Washer')),
  constraint bays_machine_type_position_key unique (machine_type, position)
) tablespace pg_default;
```

Seed exactly 6 rows (idempotent on the unique key): Dryer Bay 1–3, Washer Bay 1–3.

### 1.2 `refurbishments` (1:1 with appliance)

```sql
create table if not exists public.refurbishments (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  appliance_id uuid not null,
  bay_id uuid null,
  status text not null default 'staging',
  -- intake
  source text null,
  cost numeric null,
  -- diagnostic
  initial_symptoms text null,
  error_codes text null,
  -- repair
  work_needed text null,
  cleaning_status text null,
  -- testing
  test_mode_used text null,
  final_results text null,
  constraint refurbishments_pkey primary key (id),
  constraint refurbishments_appliance_id_key unique (appliance_id),
  constraint refurbishments_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete cascade,
  constraint refurbishments_bay_id_fkey
    foreign key (bay_id) references public.bays (id) on delete set null,
  constraint refurbishments_status_check
    check (status in ('staging', 'diagnostic', 'repair', 'testing', 'completed'))
) tablespace pg_default;
```

`cost` is the acquisition cost; it lives here (not on the shared `appliances` contract table).

### 1.3 Bay integrity (two safeguards)

```sql
-- one active unit per bay
create unique index if not exists refurbishments_one_active_per_bay
  on public.refurbishments (bay_id)
  where bay_id is not null and status <> 'completed';

-- no washers in dryer bays (and vice versa): appliances.type must match bays.machine_type
create or replace function public.check_bay_type_match() returns trigger as $$
declare
  bay_type text;
  appl_type text;
begin
  if new.bay_id is null then
    return new;
  end if;
  select machine_type into bay_type from public.bays where id = new.bay_id;
  select type into appl_type from public.appliances where id = new.appliance_id;
  if appl_type is distinct from bay_type then
    raise exception 'Bay type mismatch: appliance type % cannot occupy a % bay', appl_type, bay_type;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists check_bay_type_match on public.refurbishments;
create trigger check_bay_type_match
  before insert or update of bay_id, appliance_id on public.refurbishments
  for each row execute function public.check_bay_type_match();
```

### 1.4 `refurbishment_parts` (mirror of `job_parts`)

```sql
create table if not exists public.refurbishment_parts (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  refurbishment_id uuid not null,
  part_id uuid not null,
  quantity int not null,
  unit_price numeric not null,
  constraint refurbishment_parts_pkey primary key (id),
  constraint refurbishment_parts_refurbishment_id_fkey
    foreign key (refurbishment_id) references public.refurbishments (id) on delete cascade,
  constraint refurbishment_parts_part_id_fkey
    foreign key (part_id) references public.parts (id) on delete restrict,
  constraint refurbishment_parts_quantity_check check (quantity > 0)
) tablespace pg_default;
```

### 1.5 Extend `part_stock_movements` (additive)

```sql
alter table public.part_stock_movements
  add column if not exists refurbishment_part_id uuid null;

alter table public.part_stock_movements
  drop constraint if exists part_stock_movements_refurbishment_part_id_fkey;
alter table public.part_stock_movements
  add constraint part_stock_movements_refurbishment_part_id_fkey
    foreign key (refurbishment_part_id)
    references public.refurbishment_parts (id) on delete set null;
```

### 1.6 `refurbishment_state_history` (mirror of `job_state_history`)

```sql
create table if not exists public.refurbishment_state_history (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  refurbishment_id uuid not null,
  from_state text null,
  to_state text not null,
  changed_by uuid null,
  reason text null,
  constraint refurbishment_state_history_pkey primary key (id),
  constraint refurbishment_state_history_refurbishment_id_fkey
    foreign key (refurbishment_id) references public.refurbishments (id) on delete cascade
) tablespace pg_default;
```

### 1.7 `updated_at` trigger + indexes

```sql
drop trigger if exists set_refurbishments_updated_at on public.refurbishments;
create trigger set_refurbishments_updated_at
  before update on public.refurbishments
  for each row execute function public.set_updated_at();

create index if not exists refurbishments_status_idx on public.refurbishments (status);
create index if not exists refurbishments_bay_id_idx on public.refurbishments (bay_id);
create index if not exists refurbishments_appliance_id_idx on public.refurbishments (appliance_id);
create index if not exists refurbishment_parts_refurbishment_id_idx
  on public.refurbishment_parts (refurbishment_id);
create index if not exists refurbishment_parts_part_id_idx
  on public.refurbishment_parts (part_id);
create index if not exists part_stock_movements_refurbishment_part_id_idx
  on public.part_stock_movements (refurbishment_part_id);
```

### 1.8 RLS (internal-only, no anon)

Enable RLS on `bays`, `refurbishments`, `refurbishment_parts`, `refurbishment_state_history`,
each with full access for `authenticated` + `service_role`, copying the pattern in
`supabase_postgresql/migrations/20260601101100_job_parts_part_stock_movements_rls.sql`.

**Verify (Phase 1):** All migrations apply cleanly and are idempotent (re-run = no error). Tables
exist with constraints; `bays` has exactly 6 seeded rows; inserting a `refurbishment` whose
appliance `type` mismatches the bay raises; a second active unit in the same bay is rejected by
the partial unique index; RLS enabled on all four new tables with no anon policy.

---

## Phase 1b: Types & Data Layer (no UI)

- `lib/types/refurbishment.ts`: `RefurbishmentStatus`, `MachineType`, `Bay`, `Refurbishment`,
  `RefurbishmentPart`. Add `refurbishment_part_id: string | null` to `PartStockMovement` in
  `lib/types/operations.ts`.
- `lib/operations/refurbishment-lifecycle.ts`: ordered `REFURB_STATES`, `canAdvance(from, to)`,
  `nextStatus(from)`, `previousStatus(from)` (linear; mirrors `lib/operations/job-lifecycle.ts`).
- `lib/data/bays.ts`: `listBays()`, `getBayById(id)`.
- `lib/data/refurbishments.ts`: `createRefurbishment`, `getRefurbishmentById`,
  `getRefurbishmentByAppliance`, `listRefurbishmentsByStatus`, `listActiveBayAssignments`,
  `updateRefurbishmentFields`.

**Verify (Phase 1b):** `npm run lint` passes, no type errors; accessors compile and typecheck
against the new tables; a dev smoke (create → read → update → list) round-trips.

---

## Phase 1c: Operations / Server Actions (no UI)

- `lib/operations/transition-refurbishment-state.ts` → `advanceRefurbishment(id, fields)`:
  auth → load → validate `canAdvance` → PATCH current-stage fields + advance `status` →
  insert `refurbishment_state_history` (rollback on failure) → on `completed`: clear `bay_id`
  and call `transitionApplianceState(applianceId, 'Listed')`. Mirrors
  `lib/inventory/transition-appliance-state.ts`.
- `lib/operations/consume-parts-for-refurbishment.ts`: clone of
  `lib/operations/consume-parts.ts` writing `refurbishment_parts` +
  `recordStockMovement(..., { refurbishmentPartId })`. Add a `refurbishmentPartId` option to
  `recordStockMovement` in `lib/data/parts.ts` (additive; `job_part_id` path unaffected).
- Bay assign/unassign actions: validate bay type vs appliance type; assigning advances
  `staging → diagnostic`.

**Verify (Phase 1c):** Dev smoke proves: advancing saves fields + writes history; invalid
advance is a no-op; consuming parts decrements stock and writes a movement row carrying
`refurbishment_part_id`; completing a refurbishment frees the bay and sets the appliance to
`Listed`.

---

## Phase 2: AI-First Intake

Reuse `app/api/extract-appliance/route.ts` as-is (already never populates `price`/`status`).

- New route `app/dashboard/refurbishments/new/` — minimal intake form: `Source`, `Cost`,
  `Model Number` + "Extract Specs" button → POST the existing API → auto-fill technical specs
  (brand, fuel, capacity, age, dimensions, features, description) for review/confirm.
- On save: create appliance (`lifecycle_state='Refurbishment'`, `status='Draft'`) via the
  dual-write in `lib/inventory/appliance-dual-write.ts`, then create the `refurbishments` row
  (`status='staging'`, with `source`/`cost`). Use the `useActionState` + typed `*FormState`
  pattern from `app/dashboard/inventory/new/inventory-form.tsx`.

**Verify (Phase 2):** Entering a model number extracts specs; price/status are not AI-filled;
saving creates one appliance (Refurbishment/Draft) and one `staging` refurbishment.

---

## Phase 3: Active Bay Dashboard (mobile-first)

- New `app/dashboard/refurbishments/page.tsx` (server) loads bays + active assignments; client
  `active-bay-dashboard.tsx`.
- Two horizontal snap carousels (`snap-x snap-mandatory overflow-x-auto`, `snap-center` cards):
  top = 3 Dryer bays, bottom = 3 Washer bays.
- Empty bay → "Assign" button opens a dialog listing `staging` appliances whose `type` matches
  the bay's `machine_type`.
- Occupied bay → summary card (title, brand, model, current stage badge).
- Add a nav entry in the dashboard layout.

**Verify (Phase 3):** Dashboard renders 3+3 bays; Assign only lists type-matching staging units;
assigning fills the bay and the unit advances to `diagnostic`; occupied bays show the summary.

---

## Phase 4: Progressive Repair Modal (state-driven)

- `repair-modal.tsx`: full-screen modal opened by tapping an occupied bay; Stepper
  `Diagnostic → Repair → Testing` driven by `refurbishments.status`.
- Fields per step (exactly): Diagnostic (`initial_symptoms`, `error_codes`); Repair
  (`work_needed`, parts used via the refurbishment consume dialog, `cleaning_status`); Testing
  (`test_mode_used`, `final_results`).
- Sticky footer `[< Previous]` / `[Save & Next >]`. `Save & Next` → `advanceRefurbishment`
  (server action: PATCH Supabase, advance enum, `revalidatePath`).

**Verify (Phase 4):** Modal opens at the current stage; Save & Next persists the stage's fields
and advances the enum; Previous navigates back without data loss; parts attach to the
refurbishment.

---

## Phase 5: Graduation

- `Save & Next` on Testing sets `status='completed'`, clears `bay_id` (frees the bay), and
  promotes the appliance `Refurbishment → Listed`. The unit then flows into the existing,
  separate publishing path on the appliance detail page.

**Verify (Phase 5):** Completing Testing removes the unit from its bay, sets the refurbishment
to `completed`, and the appliance is `Listed` (ready to publish), all atomically.
