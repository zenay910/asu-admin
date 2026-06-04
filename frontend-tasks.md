# frontend-tasks.md — Admin Frontend: Surface Wave 1 + Wave 2 in the UI

Itemized, **one-task-at-a-time** checklist for the **Admin App frontend** (`asu-admin`). It
maps every Wave 1 + Wave 2 backend capability (`ROADMAP.md`, `project.md`, `tasks.md`) to
admin UI built on the existing **shadcn UI** stack.

**Goal:** Give operators a UI for everything the backend already supports — appliances with
the full lifecycle, parts inventory + compatibility, jobs/work orders with standardized forms,
parts consumption, and invoices (job / appliance sale / retail) — plus an overview dashboard.

**Order of execution (hard requirement):**
**Phase F0 (UI foundation) → F1 (inventory cutover to appliances) → F2 (parts) →
F3 (jobs) → F4 (invoices) → F5 (overview) → F6 (polish/QA).**

> This is a **frontend-only** wave. The Wave 1 + Wave 2 database, RLS, accessors, hooks,
> server actions, and route handlers are complete and verified. No schema or backend contract
> changes are part of this work (one small exception is flagged in F4.6).

**Execution rules (from `AGENTS.md`):**
- Do **one** task at a time, touching only the files that task requires.
- A task is done only when its **`Verify`** metric is objectively met.
- After each task, **STOP and request human verification** before starting the next.
- Default to **Server Components**; add `"use client"` only where interactivity requires it.
- Mutations go through **Server Actions** / existing **route handlers** — never write Supabase
  directly from a client component. After a mutation, `revalidatePath(...)` affected routes.
- Reuse the established primitives: `cn()` (`lib/utils.ts`), `components/ui/*`,
  `lucide-react` icons, the typed `useActionState` + `*FormState` form pattern, and the typed
  hooks/accessors (`lib/hooks/*`, `lib/data/*`, `lib/operations/*`, `lib/inventory/*`).
- Keep the `@/*` path alias, TypeScript `strict`, and Tailwind v4 conventions.

---

## Backend surface this wave consumes (already built)

- **Hooks** (`lib/hooks/*`): `useAppliances(filters)` (reads `appliances` via browser client);
  `useParts`, `useJobs`, `useInvoices` (`{ id?, filters? }`, fetch `/api/{parts,jobs,invoices}`).
- **Server actions:** `transitionApplianceState` (`lib/inventory/transition-appliance-state.ts`),
  `transitionJobState`, `consumePartsForJob`, `generateInvoiceForJob`,
  `createApplianceSaleInvoice`, `createRetailInvoice` (`lib/operations/*`).
- **Pure helpers:** `lib/inventory/lifecycle.ts` (`getAllowedTransitions`, `canTransition`),
  `lib/operations/job-lifecycle.ts` (`getAllowedJobTransitions`, `canTransitionJob`,
  `JOB_TYPES_BY_CLASS`, `isValidJobTypeForClass`).
- **Accessors** (`lib/data/*`): appliances, parts, part-compatibility, jobs, invoices
  (incl. `recomputeInvoiceTotals`, `getInvoiceById` → `InvoiceWithLineItems`).
- **Route handlers:** `app/api/{parts,jobs,invoices}/route.ts`, `app/api/extract-appliance`.

## Current UI baseline (what exists today)

- App shell: `app/dashboard/layout.tsx` (auth-gated), `components/dashboard-navbar.tsx`,
  `app/dashboard/page.tsx` (placeholder cards).
- Legacy inventory: `app/dashboard/inventory/{new,edit,view}` — the list reads the legacy
  **`products`** table directly; writes go to `products`.
- shadcn installed (new-york / neutral / RSC): only `button`, `input`, `label`, `textarea`.

## Key decisions (ratified during planning)

- **Inventory cutover:** the admin inventory UI moves to **`appliances` + lifecycle**
  (Intake → Refurbishment → Listed → Retired) via the typed hooks/accessors.
- **Dual-write:** create/edit/delete write `appliances` (**source of truth**) **and mirror to
  `products` / `product_images`**, so the `asu-frontend` storefront (which still reads
  `products`, `Published`-only) keeps working until it is migrated in a separate, later task.
- Keep the existing `useActionState` + typed `*FormState` mutation pattern (not react-hook-form).

### Target information architecture
```
Overview ──┬── Inventory (appliances + lifecycle)
           ├── Parts (inventory + compatibility)
           ├── Jobs / work orders ──┐ consume parts → Parts
           └── Invoices             └ generate → Invoices
   Inventory ── appliance sale ──▶ Invoices
   Parts ────── retail sale ─────▶ Invoices
```

---

## Phase F0 — UI Foundation

### F0.1 Install required shadcn primitives
- [x] Add `card`, `table`, `badge`, `dialog`, `select`, `tabs`, `dropdown-menu`, `sonner`,
  `skeleton`, `separator`, `sheet` via `npx shadcn@latest add ...` (new-york / neutral, per
  `components.json`).
- **Verify:** each component file lands in `components/ui/`; `npm run lint` and `next build`
  pass with no new errors.

### F0.2 Toast provider
- [x] Mount the sonner `<Toaster />` in `app/dashboard/layout.tsx` so mutations can surface
  success/error toasts.
- **Verify:** a temporary `toast()` call renders a visible toast on a dashboard page; removed
  after confirmation.

### F0.3 Shared presentational helpers
- [x] Add `components/status-badge.tsx` (variants for appliance `status`, `lifecycle_state`,
  job `state`/`job_class`, invoice `status`/`invoice_type`), `lib/format.ts` (money + date
  formatters), a small `DataTable` wrapper over the shadcn table, and a `PageHeader`.
- **Verify:** rendered in a scratch route with sample data; `npm run lint` and `tsc --noEmit`
  pass.

### F0.4 Navigation + landing IA
- [x] Expand `components/dashboard-navbar.tsx` to **Overview / Inventory / Parts / Jobs /
  Invoices**, and replace the placeholder cards in `app/dashboard/page.tsx` with section entry
  points.
- **Verify:** every nav link routes to its section and shows the correct active state on each
  route.

---

## Phase F0.5 — Brand Theme Port (asu-frontend → asu-admin)

> Intermission between foundation and feature build-out: adopt asu-frontend's fonts and brand
> palette in `asu-admin` **while keeping shadcn**. We re-skin the existing shadcn HSL token
> slots (so every `components/ui/*` primitive inherits the brand automatically) rather than
> replacing shadcn. **Dark mode is kept** — both a light and a dark variant of the palette are
> branded.

Source of truth for the brand: `asu-frontend/src/app/globals.css` +
`asu-frontend/src/app/layout.tsx` — fonts **Outfit** (sans) + **Roboto Mono** (mono); palette
crimson `#8C1F1F` (+ `crimson-dark`/`crimson-lt`/`crimson-pale`), charcoal `#1e1e1e`,
steel `#3d3d3d`, mid `#6b6b6b`, smoke `#f5f5f5`, rule `#e4e4e4`; the `.type-*` scale,
`.section-eyebrow`, `.divider-red`; sharp 2px corners. The asu-frontend `.btn-*`/`.card`
primitives are intentionally **not** ported (shadcn `Button`/`Card` own those).

**Token remap (brand → shadcn HSL slots in `app/globals.css`):**
- Light `:root` — `--background` `0 0% 96%` (smoke); `--foreground` `0 0% 12%` (charcoal);
  `--card`/`--popover` `0 0% 100%` (+ charcoal fg); `--primary` `0 64% 34%` (crimson) /
  `--primary-foreground` `0 0% 100%`; `--secondary`/`--muted` `0 0% 92%`,
  `--muted-foreground` `0 0% 42%` (mid); `--accent` `0 43% 96%` (crimson-pale) /
  `--accent-foreground` `0 64% 34%`; `--border`/`--input` `0 0% 89%` (rule); `--ring`
  `0 64% 34%`; `--destructive` `0 72% 45%` (+ `0 0% 100%` fg); `--radius` `0.125rem`.
- Dark `.dark` **and** `@media (prefers-color-scheme: dark)` — `--background` `0 0% 12%`
  (charcoal); `--foreground` `0 0% 96%` (smoke); `--card`/`--popover` `0 0% 15%`; `--primary`
  `0 65% 48%` (crimson-lt); `--secondary`/`--muted` `0 0% 20%`, `--muted-foreground`
  `0 0% 65%`; `--accent` `0 40% 22%` / `--accent-foreground` `0 0% 96%`; `--border`/`--input`
  `0 0% 24%` (steel); `--ring` `0 65% 48%`.
- Also expose raw brand vars (`--crimson`, `--crimson-dark`, `--crimson-lt`, `--crimson-pale`,
  `--charcoal`, `--steel`, `--mid`, `--smoke`, `--rule`) for direct use.

### F0.5.1 Fonts → Outfit + Roboto Mono
- [x] In `app/layout.tsx`, replace `Geist`/`Geist_Mono` with `Outfit({ variable: '--font-sans' })`
  and `Roboto_Mono({ variable: '--font-mono' })` (mirroring asu-frontend), and update the
  `@theme inline { --font-sans / --font-mono }` block in `app/globals.css` to reference them.
- **Verify:** the computed `body` font-family resolves to **Outfit** and mono/code elements use
  **Roboto Mono**; `next build` passes.

### F0.5.2 Re-skin shadcn tokens (light + dark)
- [x] Rewrite the `:root`, `@media (prefers-color-scheme: dark)`, and `.dark` token blocks in
  `app/globals.css` per the remap table above; add the raw brand vars; set `--radius` to the
  sharp 2px value. Keep shadcn — only token **values** change.
- **Verify:** a shadcn `Button` renders crimson `primary`; `bg-background` is smoke (light) /
  charcoal (dark); `border-border` uses rule/steel; adding `.dark` flips the full palette;
  text/background contrast is legible in both themes.

### F0.5.3 Port typography scale + brand utilities
- [x] Add `.type-display`, `.type-heading`, `.type-subheading`, `.type-body`, `.type-label`,
  `.type-caption`, `.section-eyebrow`, and `.divider-red` to `app/globals.css` (token-aware).
  Do **not** port `.btn-*`/`.card` (shadcn provides those).
- **Verify:** a scratch element using `type-display` and `type-label` renders with the correct
  Outfit / Roboto-Mono weights, sizes, and letter-spacing.

### F0.5.4 Migrate shared chrome to semantic tokens
- [x] Convert `app/dashboard/layout.tsx`, `components/dashboard-navbar.tsx`, and
  `app/dashboard/page.tsx` from hardcoded `zinc-*`/`dark:` classes to semantic tokens
  (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`;
  active nav uses `bg-primary text-primary-foreground`).
- **Verify:** the three files contain **no** hardcoded `zinc-*`/`dark:` classes; the dashboard
  shell, navbar active state, and landing cards render branded in both light and dark;
  `npm run lint` + `next build` pass.

### F0.5.5 Theme QA gate
- [x] Visual + build check of the rebrand against asu-frontend.
- **Verify:** side-by-side, admin fonts and the crimson/charcoal/smoke palette visually match
  asu-frontend; the F0 primitives (toast, table, badge) inherit the brand; `npm run lint` and
  `next build` are clean.

---

## Phase F1 — Inventory Cutover to `appliances` + Lifecycle (dual-write)

> Biggest cross-app risk lives here. Every write task's Verify metric explicitly checks
> `products` parity so the storefront never goes stale.

### F1.1 Dual-write appliance server actions
- [x] Add `"use server"` create/update/delete appliance actions that write `appliances` +
  `appliance_images` (source of truth) **and mirror** the corresponding row(s) to `products` +
  `product_images`, with explicit field mapping and image-storage handling (reuse
  `lib/supabase/storage.ts` and the upload pattern in
  `app/dashboard/inventory/new/actions.ts`). Use `lib/data/appliances.ts` for the appliance
  side. `revalidatePath` the inventory routes.
- **Verify:** creating one item inserts into **both** `appliances` and `products` (row-count
  parity, matching key fields); `status='Published'` is mirrored only when
  `lifecycle_state='Listed'`; re-running an edit keeps both tables consistent.

### F1.2 Appliance list page
- [x] Replace the `products` read in `app/dashboard/inventory/view/page.tsx` with
  `useAppliances`; render a `DataTable` with `StatusBadge` + lifecycle badge columns and
  filters (status, lifecycle_state, type, brand) + skeleton loading.
- **Verify:** the page lists all live `appliances` rows (29) sourced from `appliances` (not
  `products`); each filter narrows results correctly.

### F1.3 Appliance detail page
- [x] Add `app/dashboard/inventory/[id]/page.tsx`: specs, image gallery, current
  `lifecycle_state` + `status`, and an `appliance_state_history` timeline.
- **Verify:** renders a real appliance with all fields and its ordered state history.

### F1.4 Lifecycle transition control
- [x] On the detail page, render transition buttons gated by `getAllowedTransitions`, with a
  reason input, calling `transitionApplianceState`; toast the result.
- **Verify:** a valid transition updates `lifecycle_state` **and** writes one
  `appliance_state_history` row and toasts success; disallowed targets are hidden/disabled;
  `Published` is only offered when the unit is `Listed`.

### F1.5 New appliance form cutover
- [x] Point `app/dashboard/inventory/new` at the F1.1 dual-write create action; reuse the
  Gemini extraction (`app/api/extract-appliance`) and image upload; default
  `lifecycle_state='Intake'`.
- **Verify:** a newly created appliance appears in the appliances list **and** as a
  storefront-eligible `products` row (subject to the Published/Listed rule).

### F1.6 Edit + delete appliance
- [x] Wire the edit form to the dual-write update action; implement delete with storage cleanup
  and image cascade, mirrored to `products`/`product_images`.
- **Verify:** edits persist to **both** tables; delete removes the row from both tables and the
  associated storage objects are gone.

---

## Phase F2 — Parts Inventory & Compatibility

### F2.1 Parts list page
- [x] Add `app/dashboard/parts/page.tsx` via `useParts`: columns (part_number, name, category,
  quantity_on_hand, reorder_threshold, status), low-stock highlight, filters (status, category,
  brand).
- **Verify:** lists parts from `/api/parts`; rows where `quantity_on_hand <= reorder_threshold`
  are visibly flagged.

### F2.2 Part detail page
- [x] Add `app/dashboard/parts/[id]/page.tsx`: part fields + compatible appliances
  (`listCompatibleAppliances`) + `part_stock_movements` history.
- **Verify:** shows correct data for a seeded part, including its compatibility links and
  movement history.

### F2.3 New/edit part form
- [x] Add create/edit forms posting to `/api/parts` (POST) and the update accessor.
- **Verify:** create returns a `partId` and the part appears in the list; edit persists; a
  duplicate `part_number` surfaces a friendly 400 message (no crash).

### F2.4 Stock adjustment control
- [x] Add an adjust-stock dialog (delta + reason) that writes a `part_stock_movements` row
  (reuse the generalized stock-movement path / `adjustStock`).
- **Verify:** quantity changes by the delta and a movement row is recorded; an adjustment that
  would go below 0 is rejected with no change.

### F2.5 Compatibility manager
- [x] Add link/unlink UI between a part and appliances (`linkPartToAppliance` / `unlinkPart`).
- **Verify:** a created link appears on both the part and the appliance detail views; a
  duplicate link is rejected; unlink removes it.

---

## Phase F3 — Jobs / Work Orders (standardized forms)

### F3.1 Jobs list page
- [x] Add `app/dashboard/jobs/page.tsx` via `useJobs` with **Internal / Customer** tabs, a
  `state` filter, and `job_class`/`job_type`/`state` badges.
- **Verify:** lists jobs from `/api/jobs`; tab + state filtering narrows results correctly.

### F3.2 New job form (standardized by type)
- [x] Add a create-job form whose fields switch by `job_class` + `job_type` (Internal requires
  an appliance; Customer optional), capturing the standardized `details` payload; validate the
  class↔type pairing with `isValidJobTypeForClass`; POST `/api/jobs`.
- **Verify:** valid Internal and Customer jobs are created; an invalid class↔type pair, or an
  Internal job without an appliance, is blocked in the UI **and** rejected by the API (400).

### F3.3 Job detail page
- [x] Add `app/dashboard/jobs/[id]/page.tsx`: summary, state, `job_state_history`, consumed
  `job_parts`, and the linked appliance (if any).
- **Verify:** renders a real job with its ordered history and consumed-parts list.

### F3.4 Job state transition UI
- [x] Add transition controls gated by `canTransitionJob` / `getAllowedJobTransitions`, calling
  `transitionJobState` with a reason; toast the result.
- **Verify:** a valid transition updates `state` and writes one `job_state_history` row;
  disallowed targets are disabled (`Closed` terminal).

### F3.5 Parts consumption on a job
- [x] Add a "consume part" control (pick part + quantity) calling `consumePartsForJob`.
- **Verify:** a `job_parts` row is added, `parts.quantity_on_hand` drops by the quantity, and a
  `part_stock_movements` row is written; consuming more than available stock is rejected with no
  change.

---

## Phase F4 — Invoices (job / appliance-sale / retail)

### F4.1 Invoices list page
- [x] Add `app/dashboard/invoices/page.tsx` via `useInvoices`: columns (invoice_number,
  invoice_type, status, total) + type/status filters.
- **Verify:** lists invoices from `/api/invoices`; type and status filters work.

### F4.2 Invoice detail / print view
- [x] Add `app/dashboard/invoices/[id]/page.tsx` rendering `InvoiceWithLineItems`: line items
  (labor/part/appliance/fee), `subtotal`/`tax`/`total`, `status`, `invoice_number`, and a
  print-friendly layout.
- **Verify:** renders an invoice with line items and totals where `subtotal = Σ line_total` and
  `total = subtotal + tax`; the print layout is clean.

### F4.3 Generate invoice from job
- [x] Add a "Generate invoice" action on a Customer-job detail calling `generateInvoiceForJob`
  (POST `/api/invoices`, `invoice_type='job'`), then link to the new invoice.
- **Verify:** generating from a Customer job with labor + parts produces a `job` invoice with a
  labor line + one part line per `job_parts` row and correct totals; an Internal/ineligible job
  is rejected.

### F4.4 Appliance-sale invoice builder
- [x] Add a builder (appliance line + delivery/installation `fee` lines + accessory `part`
  lines) calling `createApplianceSaleInvoice`.
- **Verify:** creates an `appliance_sale` invoice with the correct line kinds and total **and**
  transitions the appliance to `Retired` (`status='Sold'`); selling an already-`Retired`
  appliance is rejected with no invoice created.

### F4.5 Retail invoice builder
- [x] Add a counter-sale builder (parts only, optional `fee` lines) calling
  `createRetailInvoice`.
- **Verify:** creates a `retail` invoice, draws down stock for each part, and writes a
  `part_stock_movements` row with no `job_part`; an oversell is rejected with no invoice/stock
  change.

### F4.6 Invoice status transitions
- [x] Add status controls (Draft → Issued → Paid / Void), setting `issued_at` on Issue.
- **Verify:** status updates persist and the badge reflects the new status.
  > Sub-step: if `lib/data/invoices.ts` has no status-update path, add a minimal
  > `updateInvoiceStatus` accessor (+ a thin server action) **first** as its own gated step
  > before wiring the UI.

---

## Phase F5 — Overview Dashboard

### F5.1 Stats cards
- [x] Replace the placeholder cards in `app/dashboard/page.tsx` with live stats: appliance
  counts by `lifecycle_state`, low-stock parts count, open jobs, draft/issued invoices, and
  revenue (sum of `Issued`/`Paid` invoice totals), via accessors/hooks.
- **Verify:** each figure matches a direct DB count/sum for the same query.

### F5.2 Recent activity
- [x] Add a recent-activity panel (latest jobs, invoices, and appliance/job state changes).
- **Verify:** shows the most recent records ordered by recency.

---

## Phase F6 — Polish & QA

### F6.1 Loading / empty / error states
- [x] Ensure every list/detail page has skeletons, empty states, and toasts for errors.
- **Verify:** each page handles loading, empty, and error conditions without throwing.

### F6.2 Responsive + accessibility pass
- [x] Review nav, tables, dialogs, and forms for responsiveness and a11y (labels, roles, focus).
- **Verify:** pages are usable at mobile and desktop widths; interactive controls have
  accessible labels.

### F6.3 Final gate
- [x] Full lint/type/build sweep.
- **Verify:** `npm run lint` and `next build` pass with no type errors.

---

## Frontend Wave Exit Criteria
- [ ] shadcn foundation, navigation, and shared helpers in place (Phase F0).
- [ ] Inventory UI runs on `appliances` + lifecycle with verified **dual-write** parity to
  `products`/`product_images`; the storefront still shows the same published inventory (F1).
- [ ] Parts inventory, stock adjustments (audited), and compatibility are manageable (F2).
- [ ] Jobs support standardized Internal/Customer forms, state transitions (audited), and
  audited parts consumption (F3).
- [ ] Invoices can be generated from jobs, appliance sales (with lifecycle → Sold), and retail
  sales, with detail/print and status transitions (F4).
- [ ] Overview dashboard reflects live operational + financial figures (F5).
- [ ] Lint/build clean; loading/empty/error and responsive/a11y handled (F6).
- [ ] Each task above was completed individually and **human-verified** before the next began.
