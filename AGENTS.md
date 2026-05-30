# AGENTS.md — Operational Doctrine

This document is the binding operational doctrine for any execution model (AI agent or
automated contributor) working inside the **ASU dual-repo appliance platform**:

- **`asu-admin`** — the internal Admin App (authenticated operators). Next.js 16 App
  Router, React 19, `@supabase/ssr`, runs on port `3001`.
- **`asu-frontend`** — the public Customer App (anonymous storefront). Next.js 15 App
  Router, React 19, `@supabase/supabase-js` anon read-only client, runs on port `3000`.

Both apps share **one Supabase Postgres database, one Auth instance, and one Storage
bucket (`appliances`)**. Treat the database as a shared contract between two independently
deployed clients. Read this file in full before touching any code.

---

## 1. Core Tenets

Every change is judged against these five tenets. If a change violates one, it is wrong
even if it "works".

### 1.1 Well-Defined Boundaries
- The **database schema is the contract** between `asu-admin` and `asu-frontend`. Neither
  app may assume private knowledge of the other's runtime.
- Writes are **Admin-only**. The Customer App is **read-only** and may only read
  customer-visible rows (`status = 'Published'`). Never introduce a write path in
  `asu-frontend`.
  > **Live reality (reconciled 2026-05-29):** this `Published`-only restriction is currently
  > enforced **in `asu-frontend` application code** (`.eq("status","Published")`), **not** by
  > database RLS. RLS is **disabled** on the live `products` / `product_images` tables and no
  > policies exist — meaning the anon key can technically read/write every row. Closing this
  > gap is a Wave 1, policy-first, human-gated task (see `tasks.md` Phase 0); it must **not**
  > be done by simply enabling RLS, which would blank the storefront.
- Data access lives behind a defined layer: `lib/supabase/*` (admin) and
  `src/lib/*` (frontend). UI components and pages must not hand-roll Supabase clients or
  embed raw table queries when a typed accessor/hook is available.
- Server-only secrets (`GEMINI_API_KEY`, service-role keys) never cross into client
  components or into `asu-frontend`. Only `NEXT_PUBLIC_*` values may reach the browser.

### 1.2 Composability
- Build small, single-purpose units: one server action, one route handler, one hook, one
  table accessor per concern. Compose features from these rather than writing monoliths.
- Reuse the established primitives instead of reinventing them:
  - `lib/supabase/server.ts` → server components / actions / route handlers.
  - `lib/supabase/client.ts` → client components.
  - `cn()` from `lib/utils.ts` for class merging; `components/ui/*` for primitives.
  - The `InventoryFormState` + `useActionState` pattern for form mutations.
- New domain logic that both apps need (validation enums, lifecycle transitions, type
  shapes) must be expressed so it can be mirrored across repos without divergence.

### 1.3 Independence
- The two repos deploy and version **independently**. A change to one app must not require
  a simultaneous, breaking change to the other.
- Schema changes must be **additive and backward-compatible by default** (add nullable
  columns / new tables; do not rename or drop columns the other app reads).
- Do not create build-time or import-time coupling between the repos. They communicate
  only through the database, Storage, and Auth — never through shared local imports.

### 1.4 Replaceability
- Any module should be swappable without rewriting its callers. Keep external
  dependencies (Supabase SDK, Gemini SDK) behind the existing wrapper layers so they can
  be replaced.
- Favor explicit inputs/outputs and pure functions (see `form_import.mjs` parsing/validation
  helpers) so units can be tested and replaced in isolation.
- No hidden global state. A module's behavior must be derivable from its inputs and the
  documented schema.

### 1.5 State Isolation
- **Single source of truth is the database.** Do not duplicate authoritative state into
  client memory beyond ephemeral UI state.
- Server state and client state are separate: mutate on the server (server actions / route
  handlers), then `revalidatePath` — do not mutate shared caches by hand.
- Each task owns its own state surface. Do not reach into another feature's tables,
  storage paths, or React state. Storage objects follow the existing
  `${productId}/original/${index}.${ext}` convention and must stay scoped to their owning row.
- Lifecycle/status is owned by the Admin App. The Customer App observes status; it never sets it.

---

## 2. Stack-Specific Execution Rules

### 2.1 Next.js App Router
- Default to **Server Components**. Add `"use client"` only when interactivity requires it.
- Mutations are **Server Actions** (`"use server"`) or **Route Handlers** under
  `app/api/*`. Never mutate Supabase directly from a client component.
- After a successful mutation, call `revalidatePath(...)` for every affected route (follow
  the pattern in `app/dashboard/inventory/new/actions.ts`).
- Forms use the `useActionState` + typed `*FormState` pattern with field-level errors and a
  friendly-message mapper. Preserve user input on error.
- Respect route protection in `middleware.ts`: everything under `/dashboard` requires an
  authenticated user. Do not weaken the matcher or auth check.
- Honor existing conventions: `@/*` path alias, TypeScript `strict`, Tailwind v4,
  `components/ui/*` primitives, `lucide-react` icons.

### 2.2 Supabase
- Use the correct client for the context:
  - Admin server: `createClient()` from `lib/supabase/server.ts` (cookie-bound).
  - Admin browser: `createClient()` from `lib/supabase/client.ts`.
  - Customer: the shared anon client in `src/lib/supabaseClient.ts` (read-only).
- **RLS is mandatory for new tables.** Every new table ships with RLS enabled and explicit
  policies **before** it is used: public read only for customer-visible,
  `Published`-equivalent rows; write access restricted to authenticated/service contexts.
  > **Legacy exception (live reality):** RLS is currently **disabled** with **no policies** on
  > `products` / `product_images`, and `setup_rls_policies.sql` was **never applied**. Do
  > **not** enable RLS on these tables on its own — with the storefront using the anon key and
  > no policies, that returns zero rows and blanks the storefront. Legacy RLS is remediated
  > **policy-first** (create + verify policies, then enable RLS) as its own human-gated task.
- All schema changes are written as **idempotent, reviewable SQL DDL** committed to the repo
  (mirror `asu-frontend/supabase_postgresql/*.sql`) and applied via tracked migrations.
  > Live note: the database currently has **no migration history** and the committed DDL is
  > stale (e.g. it omits the live `products.age numeric` column). Going forward, schema
  > changes are tracked migrations — never applied only through the dashboard with no
  > source-of-record.
- Enums are enforced in app code today (`ALLOWED` sets in `form_import.mjs`); **no DB CHECK
  constraints exist live**. When adding values, update the validator and any mirrored copy;
  prefer promoting to DB-level check constraints where it strengthens the contract — but only
  **after** existing data is cleaned to satisfy them (e.g. the live `SOLD`/`Sold` `status`
  casing drift must be normalized first).
- Use `uuid` primary keys (`gen_random_uuid()`), `timestamptz` `created_at`/`updated_at`
  defaulting to `now()`, and declare foreign keys explicitly, consistent with existing tables.
- Storage stays in the `appliances` bucket using the established path convention; clean up
  storage objects when their owning rows are deleted (see the admin delete flow).

### 2.3 Cross-App Discipline
- When a change touches shared schema, state in the PR/notes exactly how **both** apps are
  affected and confirm the Customer App still reads only customer-visible (`Published`) rows —
  whether that is enforced by application code (legacy tables today) or by RLS (new tables).
- Keep duplicated shapes (e.g. the `Product` / `ProductImage` types defined in both repos)
  in sync; when one changes, the other must be updated in a separate, isolated task.

---

## 3. Execution Model Protocol (NON-NEGOTIABLE)

> An execution model may work on **exactly one isolated task at a time** and **must obtain
> explicit human verification before starting the next task.**

1. **One task at a time.** Pull the single next unchecked item from `tasks.md`. Do not begin,
   bundle, or "pre-work" any other task — even trivially related ones.
2. **Isolation.** A task changes only the files required for that task. No drive-by
   refactors, renames, reformatting, or unrelated fixes. If you discover other problems,
   record them; do not fix them in this task.
3. **Respect the tenets.** Validate the change against Section 1 before considering it done.
4. **Self-check against the Verify metric.** Every task in `tasks.md` has an explicit
   `Verify` metric. The task is not complete until that metric is objectively met.
5. **STOP and request human verification.** After completing the task and stating how the
   `Verify` metric was satisfied, halt. Do **not** proceed to the next task until a human
   explicitly approves and tells you to continue.
6. **No scope expansion.** If a task is ambiguous or appears to require schema/contract
   changes beyond its description, stop and ask before acting.
7. **No destructive actions** (dropping columns/tables, deleting storage en masse, force
   pushes, history rewrites) without explicit, specific human authorization.
8. **Schema before backend before UI.** Within the approved task, follow the platform
   ordering: database/RLS first, then typed accessors/hooks/APIs, then UI.

Working ahead, batching tasks, or skipping the human verification gate is a doctrine
violation regardless of outcome.

---

## 4. Definition of Done (per task)
- Change is limited to one task and its required files only.
- Conforms to all five Core Tenets and the stack rules in Section 2.
- RLS/policies present for any new table; secrets never exposed client-side.
- `npm run lint` passes in the affected repo; no type errors introduced.
- The task's `Verify` metric is demonstrably met, with evidence stated.
- Execution model has **stopped** and requested human verification before continuing.
