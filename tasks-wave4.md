# tasks-wave4.md — Wave 4: Constrained Booking Pipeline

Itemized, **one-task-at-a-time** checklist for **Wave 4 only** (see `ROADMAP.md` and
`booking-system-spec.md`).

**Goal:** Allow controlled customer-initiated bookings that feed the operations pipeline
without compromising the read-only safety of the storefront. A **constrained** booking request
flow (capacity/time/service-type limits) surfaced on `asu-frontend`, written through a
tightly-scoped, validated server boundary — not a broad customer write path. Booking requests
land as confirmed records the Admin App triages into jobs (Wave 2) and customers (Wave 3).

**Order of execution (hard requirement):**
**Phase A (DDL) → Phase B (RLS) → Phase C (asu-frontend booking API boundary) → Phase D
(asu-frontend booking UI) → Phase E (confirm-time integrations) → Phase F (cancellation &
refunds) → Phase G (Admin triage UI) → Phase H (route optimizer, last).**

> Wave 4 needs **no Phase 0**: Waves 1–3 exit criteria are met, RLS + tracked migrations are
> in place, and all new work is **strictly additive** (new `bookings`, `pending_bookings`,
> `serviceable_zips` tables + optional `sms_templates` / `booking_sms_log`). `products` /
> `product_images` / `appliances` storefront reads are never altered, so the live storefront
> keeps working throughout.

**Execution rules (from `AGENTS.md`):**
- Do **one** task at a time, touching only the files that task requires.
- A task is done only when its **`Verify`** metric is objectively met.
- After each task, **STOP and request human verification** before starting the next.
- Schema changes are idempotent SQL DDL committed to the repo under
  `supabase_postgresql/migrations/<YYYYMMDDHHMMSS>_<name>.sql` and applied via **tracked
  migrations**.
- Mirror the established Wave 1–3 patterns: internal-only RLS
  (`...130200_internal_tables_rls.sql`), accessors (`lib/data/parts.ts`), route handlers
  (`app/api/parts/route.ts`), hooks (`lib/hooks/use-parts.ts`), and the typed `useActionState`
  + `*FormState` form pattern for Admin UI mutations.
- **Cross-repo discipline:** schema migrations live in `asu-admin`; booking intake API routes
  and UI live in `asu-frontend`; Admin triage UI lives in `asu-admin`. Both apps deploy
  independently; schema changes are additive and backward-compatible.

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` `created_at`/`updated_at`,
`numeric` money, RLS on every new table. Admin writes via authenticated session; booking
intake writes via server-only service-role routes in `asu-frontend` — **never** broad anon
write policies on booking tables.

---

## Confirmed scope decisions (ratified during planning)

### Write boundary — server-only API routes in `asu-frontend`
- Booking intake writes go through **server-only** route handlers under
  `asu-frontend/src/app/api/booking/*`, backed by a **new server-only Supabase service-role
  client** (`SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC`).
- Booking tables (`bookings`, `pending_bookings`) get **no anon write policies**. The anon
  key never inserts directly; all writes flow through validated API routes. This is the
  ROADMAP's "tightly-scoped, validated server boundary" and satisfies `AGENTS.md` §1.1
  (Customer App is read-only at the client layer; writes are server-gated).
- Stripe, Twilio, and Google Calendar credentials are **server-side only** in `asu-frontend`
  route handlers — never exposed to the browser.

### `bookings` is a standalone intake table — triaged into jobs
- `bookings` holds confirmed customer appointments (slot, appliance, symptom, payment, status).
- The Admin App **triages** a confirmed booking into the existing operations pipeline:
  find-or-create a `customers` row → `createJob({ job_class: 'Customer', job_type: 'Diagnostic',
  customer_id, details: { booking snapshot } })`.
- `bookings` does **not** replace `jobs`; it is the customer-facing intake record. A nullable
  `bookings.job_id → jobs(id) on delete set null` links a triaged booking to its job.

### Customer find-or-create at confirm time (not at hold time)
- On payment success (`/api/booking/confirm`), the server find-or-creates a `customers` row
  from intake form data (match on `email` or `phone` when present; else insert) and sets
  `bookings.customer_id`. Uses service-role client (customers table is internal-only RLS).

### Slot availability rules
- **Field days:** Tuesday and Thursday only.
- **Hours:** 10:00am – 5:00pm local (business timezone — confirm during A6).
- **Slot duration:** 1 hour blocks; max **4 slots per field day** (3–4 jobs/day per spec).
- **Availability subtracts:** confirmed `bookings` (status not `cancelled`) **plus**
  non-expired `pending_bookings` (`expires_at > now()`).
- **Hold duration:** 15 minutes (`expires_at = now() + interval '15 minutes'`).

### Diagnostic fee & cancellation policy
- **Fee:** $70 (7000 cents), charged at booking via Stripe straight charge.
- **Cancellation:** full Stripe refund if cancelled **48+ hours** before `slot_time`; no
  refund under 48 hours.
- **Same-visit repair:** diagnostic fee **deducted from total invoice** in Admin App
  (`bookings.diagnostic_waived = true` + invoice credit line item) — not refunded via Stripe.
- **Second visit:** diagnostic fee stands; second visit billed separately.

### Allowed values (app-enforced + DB CHECK where practical)
| Domain | Values |
|---|---|
| `appliance_type` | `washer`, `dryer`, `oven_stove` |
| `bookings.status` | `pending`, `scheduled`, `in_progress`, `completed`, `cancelled` |
| `brand` (intake dropdown) | Whirlpool, Kenmore, GE, Hotpoint, LG, Samsung, Maytag, Frigidaire, KitchenAid, Amana, Admiral, Speed Queen |
| Symptom chips | Per `booking-system-spec.md` §Booking Flow Step 1 (conditional on appliance type); always include "Other" |

> Brand and serviceable zip lists are seeded with spec defaults; human may adjust seed data
> before go-live.

### RLS on new tables
| Table | Pattern | Anon access |
|---|---|---|
| `bookings` | Internal-only | None |
| `pending_bookings` | Internal-only | None |
| `serviceable_zips` | Internal-only (service_role read for validate route) | None |
| `sms_templates` | Internal-only | None |

All writes to booking tables go through **service_role** in `asu-frontend` API routes.
Admin App reads/writes via **authenticated** session (existing pattern).

### Data flow added by Wave 4
```
asu-frontend /book intake form
  → POST /api/booking/validate-zip (serviceable_zips)
  → GET  /api/booking/slots (bookings + pending_bookings)
  → POST /api/booking/hold (pending_bookings, 15-min TTL)
  → Stripe PaymentElement ($70)
  → POST /api/booking/confirm
       ├─ delete pending_bookings row
       ├─ insert bookings row (+ find-or-create customers)
       ├─ Google Calendar event (mirror)
       └─ Twilio confirmation SMS
asu-admin dashboard/bookings
  → triage → find-or-create customer → createJob(Customer/Diagnostic)
  → optional: diagnostic_waived credit on invoice (same-visit repair)
```

---

## Phase A — Database Setup (DDL)

> Strictly **additive**: creates `serviceable_zips`, `pending_bookings`, `bookings`, and
> supporting indexes/triggers/cron. Does **not** alter `products` / `product_images` /
> existing storefront reads.

### A1. `serviceable_zips` table DDL + seed
- [ ] Create idempotent `create_serviceable_zips.sql` migration:
  `zip text primary key`, `label text null` (optional human label, e.g. "Salt Lake City").
- [ ] Include a seed migration (or inline seed in A1) with placeholder zips flagged
  `-- HUMAN: replace with live service area before go-live`.
- **Verify:** Running on a clean DB creates `serviceable_zips`; re-running is a no-op;
  seeded rows exist; `SELECT zip FROM serviceable_zips` returns expected count.

### A2. `pending_bookings` table DDL
- [ ] Create idempotent `create_pending_bookings.sql` migration:
  `id uuid pk default gen_random_uuid()`, `slot_time timestamptz not null`,
  `form_data jsonb null` (intake snapshot), `created_at timestamptz not null default now()`,
  `expires_at timestamptz not null`.
- **Verify:** Table exists; inserting a row with `expires_at = now() + interval '15 minutes'`
  succeeds; all columns/types confirmed via `information_schema.columns`; re-run is a no-op.

### A3. `bookings` table DDL
- [ ] Create idempotent `create_bookings.sql` migration per `booking-system-spec.md`:
  `id uuid pk default gen_random_uuid()`, `customer_id uuid null references customers(id)
  on delete set null`, `job_id uuid null references jobs(id) on delete set null`,
  `slot_time timestamptz not null`, `appliance_type text not null`, `brand text not null`,
  `symptom text not null`, `symptom_detail text null`, `address jsonb not null`
  (`{street, city, state, zip}`), `stripe_payment_intent_id text null`,
  `google_calendar_event_id text null`, `diagnostic_fee_paid boolean not null default true`,
  `diagnostic_fee_amount numeric not null default 70`, `diagnostic_waived boolean not null
  default false`, `status text not null default 'pending'`, `model_number_photo_url text null`,
  `cancellation_requested_at timestamptz null`, `refund_issued boolean not null default false`,
  `created_at timestamptz not null default now()`, `updated_at timestamptz null default now()`.
- **Verify:** Table exists with all columns; valid `customer_id` FK links; invalid FK rejected
  (`23503`); re-run is a no-op.

### A4. CHECK constraints on `bookings`
- [ ] Add idempotent CHECK constraints migration:
  `appliance_type IN ('washer', 'dryer', 'oven_stove')`;
  `status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')`;
  `diagnostic_fee_amount >= 0`.
- **Verify:** Insert with invalid `appliance_type` or `status` rejected; valid values insert;
  re-run is a no-op.

### A5. Indexes for query paths
- [ ] Add indexes: `bookings(slot_time)`, `bookings(status)`, `bookings(customer_id)`,
  `bookings(job_id)`, `pending_bookings(slot_time)`, `pending_bookings(expires_at)`.
- **Verify:** All indexes exist (`pg_indexes`); `EXPLAIN` on slot-availability query
  (filter by `slot_time` + `expires_at > now()`) shows Index Scan on seeded data.

### A6. `updated_at` maintenance on `bookings`
- [ ] Attach the existing shared `set_updated_at()` `before update` trigger to `bookings`
  (idempotent create).
- **Verify:** Updating a `bookings` row advances `updated_at` past `created_at` without the
  app setting it explicitly.

### A7. `pg_cron` cleanup job for expired `pending_bookings`
- [ ] Add idempotent migration enabling `pg_cron` (if not already) and scheduling:
  `cleanup-pending-bookings` every 5 minutes —
  `DELETE FROM pending_bookings WHERE expires_at < now()`.
- **Verify:** `cron.job` (or equivalent) lists the scheduled job; inserting a row with
  `expires_at` in the past and waiting for the next cron tick removes it (or manual invocation
  of the DELETE succeeds).

### A8. `sms_templates` table DDL (for Twilio message content)
- [ ] Create idempotent `create_sms_templates.sql` migration:
  `id uuid pk default gen_random_uuid()`, `key text not null unique`
  (e.g. `booking_confirmation`, `model_number_request`, `appointment_reminder_24hr`),
  `body text not null` (supports `{{placeholders}}`), `created_at`/`updated_at timestamptz`.
- [ ] Seed the three outbound template keys with spec-default message bodies (human-editable).
- **Verify:** Table exists; seed rows for all three keys present; duplicate `key` rejected;
  re-run is a no-op.

---

## Phase B — RLS on New Tables (must precede any consumption)

> All new tables ship RLS + policies together. Internal-only: authenticated + service_role
> full access, **no anon**. Follows `20260605110000_customers_rls.sql` pattern.

### B1. RLS on `bookings`
- [ ] Enable RLS on `bookings`. Authenticated + service_role full access; **no anon**.
- **Verify:** Anon `select` returns 0 rows / permission denied; authenticated context can
  read/write; `pg_policies` lists policies and `rls_enabled = true`.

### B2. RLS on `pending_bookings`
- [ ] Enable RLS on `pending_bookings`. Authenticated + service_role full access; **no anon**.
- **Verify:** Same as B1 for `pending_bookings`.

### B3. RLS on `serviceable_zips`
- [ ] Enable RLS on `serviceable_zips`. Authenticated + service_role full access; **no anon**.
- **Verify:** Same as B1 for `serviceable_zips`; service_role can `select` for validate-zip
  route; anon cannot read.

### B4. RLS on `sms_templates`
- [ ] Enable RLS on `sms_templates`. Authenticated + service_role full access; **no anon**.
- **Verify:** Same as B1 for `sms_templates`.

---

## Phase C — Booking API Boundary (`asu-frontend`)

> Server-only service-role client first, then shared types, then route handlers. All routes
> live under `asu-frontend/src/app/api/`. Reuse validation patterns from `asu-admin` where
> applicable; do not hand-roll Supabase clients in client components.

### C1. Server-only Supabase service-role client (`asu-frontend`)
- [ ] Add `src/lib/supabase/server.ts` (or `service.ts`): `createServiceClient()` using
  `SUPABASE_SERVICE_ROLE_KEY` (server-only env, never `NEXT_PUBLIC`). Document required env
  vars in a `.env.example` comment or README note.
- **Verify:** Importing the client in a Route Handler succeeds; the module throws or fails
  build if `SUPABASE_SERVICE_ROLE_KEY` is missing at runtime; key is not referenced in any
  `"use client"` file; `npm run lint` passes.

### C2. Shared booking TypeScript types (`asu-frontend`)
- [ ] Add `src/lib/types/booking.ts`: `ApplianceType`, `BookingStatus`, `BookingAddress`,
  `IntakeFormData`, `BookingSlot`, `PendingBooking`, `Booking` — matching Phase A DDL and
  spec intake fields (appliance type, symptom, brand, logistics).
- **Verify:** `npm run lint` and `tsc --noEmit` pass; enum/union values match DB CHECK
  constraints and spec symptom lists.

### C3. Slot availability logic (`asu-frontend`)
- [ ] Add `src/lib/booking/slot-availability.ts`: pure functions
  `generateFieldDaySlots(timezone, weeksAhead)`, `getOccupiedSlotTimes(serviceClient)`,
  `getAvailableSlots(...)` implementing Tuesday/Thursday 10:00–17:00, 1hr blocks, max 4/day,
  subtracting confirmed `bookings` (non-cancelled) + non-expired `pending_bookings`.
- **Verify:** Unit-style scratch test: a fully booked day returns 0 slots; a day with 2
  confirmed bookings + 1 active hold returns correct remainder; expired holds are ignored;
  non-field days return empty.

### C4. `POST /api/booking/validate-zip`
- [ ] Add `src/app/api/booking/validate-zip/route.ts`: accept `{ zip }`, query
  `serviceable_zips`, return `{ success: true, serviceable: boolean, label? }`; normalize
  zip (trim, 5-digit); rate-limit by IP (basic in-memory or header-based — keep simple).
- **Verify:** Known seeded zip → `{ serviceable: true }`; unknown zip → `{ serviceable: false }`;
  missing/invalid body → `400`; route uses service-role client only (no anon write).

### C5. `GET /api/booking/slots`
- [ ] Add `src/app/api/booking/slots/route.ts`: optional `?weeks=` (default 4), return
  `{ success: true, slots: BookingSlot[] }` using C3 logic.
- **Verify:** Returns only Tue/Thu slots in 10:00–17:00 window; occupied slots excluded;
  response JSON matches `BookingSlot` type; `npm run lint` passes.

### C6. `POST /api/booking/hold`
- [ ] Add `src/app/api/booking/hold/route.ts`: accept `{ slotTime, formData }`, verify slot
  still available (re-check C3), insert `pending_bookings` with `expires_at = now() + 15 min`,
  return `{ success: true, holdId, expiresAt }`; reject if slot taken → `409`.
- **Verify:** Valid available slot creates hold row; second concurrent hold on same slot gets
  `409`; hold row visible via service-role select; expired holds do not block re-hold.

### C7. Stripe PaymentIntent creation (`asu-frontend`)
- [ ] Install `stripe` (server-only). Add `src/lib/stripe/server.ts` with `createDiagnosticFeePaymentIntent({ holdId, customerEmail, slotTime })` — amount 7000 cents, metadata
  `{ holdId, customerEmail, slotTime }`. Add env `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- [ ] Add `POST /api/booking/create-payment-intent/route.ts`: validate hold exists and not
  expired, create PaymentIntent, return `{ clientSecret }`.
- **Verify:** Valid hold → `{ clientSecret }` returned; expired/missing hold → `400`/`404`;
  Stripe dashboard shows PI with correct amount and metadata; no Stripe secret in client bundle.

### C8. `POST /api/booking/confirm`
- [ ] Add `src/app/api/booking/confirm/route.ts`: accept `{ holdId, paymentIntentId }`;
  verify Stripe PI succeeded; atomically: delete `pending_bookings` row, find-or-create
  `customers` row from `form_data`, insert `bookings` row with `stripe_payment_intent_id` and
  `customer_id`, status `pending`. Return `{ success: true, bookingId }`.
  Side effects (Calendar, SMS) wired in Phase E — stub/no-op hooks acceptable at this task.
- **Verify:** End-to-end with test PI: `pending_bookings` row removed; `bookings` row exists
  with correct fields; `customer_id` links to matching customer; duplicate confirm on same hold
  → idempotent or `404`; slot no longer available in C5.

### C9. `POST /api/webhooks/stripe`
- [ ] Add `src/app/api/webhooks/stripe/route.ts`: verify Stripe signature, handle
  `payment_intent.succeeded` as backup confirmation path (idempotent with C8).
- **Verify:** Valid signed test event processes; invalid signature → `400`; duplicate event
  does not create duplicate booking.

---

## Phase D — Booking UI (`asu-frontend`)

> Multi-step intake → slot picker → payment. Default to client components for interactivity;
> all mutations via Phase C API routes — never Supabase directly from the browser.

### D1. Multi-step intake form (Steps 1–4, no payment)
- [ ] Add `src/app/book/page.tsx` + `src/components/booking/intake-form.tsx`: single-page
  multi-step wizard with forward-only navigation gated on step validation.
  - Step 1: appliance type cards (`Washer` | `Dryer` | `Oven/Stove`).
  - Step 2: conditional symptom chips per spec (include "Other" on every list).
  - Step 3: brand dropdown (spec allowlist) + optional additional context textarea.
  - Step 4: address (street, city, state, zip) + name, phone, email.
- [ ] Local form state only; no API calls beyond zip validation (D2).
- **Verify:** Cannot advance without valid current step; symptom options change with appliance
  type; all spec fields captured; brand restricted to allowlist; form state survives step
  back-navigation within session.

### D2. Zip validation gate in intake Step 4
- [ ] Wire Step 4 zip field to `POST /api/booking/validate-zip` on blur or continue; block
  progression to slot picker when `serviceable: false`; show friendly out-of-area message.
- **Verify:** Seeded serviceable zip allows continue; unknown zip shows error and blocks slot
  step; API error surfaces inline message without crash.

### D3. Slot picker UI
- [ ] Add `src/components/booking/slot-picker.tsx`: fetch `GET /api/booking/slots`, display
  available Tue/Thu slots grouped by date; on select call `POST /api/booking/hold`, store
  `holdId` + `expiresAt`; show hold countdown timer.
- **Verify:** Only available slots shown; selecting slot creates hold and advances to payment;
  `409` on taken slot shows friendly message and refreshes slots; timer visible.

### D4. Stripe PaymentElement + cancellation policy
- [ ] Install `@stripe/stripe-js` + `@stripe/react-stripe-js`. Add
  `src/components/booking/payment-step.tsx`: fetch `clientSecret` from create-payment-intent,
  render `PaymentElement`, display cancellation policy text above Pay button, on success call
  `POST /api/booking/confirm`.
- **Verify:** Test-mode payment completes; confirm route fires; booking created; Pay button
  disabled until policy text visible; Stripe publishable key is `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  only.

### D5. Confirmation / expired-hold recovery UI
- [ ] Add success state on `/book` showing booking summary (slot, appliance, address); handle
  expired hold (timer hits zero) with friendly message and return-to-slot-picker action; handle
  payment failure with retry-without-losing-intake-data.
- **Verify:** Successful payment shows confirmation summary; expired hold redirects to slot
  picker with intake data preserved; failed payment allows retry.

### D6. Navigation — `/book` route + CTA rewire
- [ ] Add `/book` to site nav; rewire all "Book a Repair" CTAs (home, services, navbar) from
  `/contact` to `/book`. Keep `/contact` as phone/email fallback.
- **Verify:** All booking CTAs route to `/book`; `/contact` still reachable; `npm run build`
  passes.

---

## Phase E — Confirm-Time Integrations (`asu-frontend` server)

> Side effects fired from confirm handler (C8) and scheduled jobs. Secrets server-side only.

### E1. Google Calendar write on confirm
- [ ] Add `src/lib/google-calendar/server.ts`: service-account auth, `createBookingEvent(booking)`
  on one shared calendar; store returned event ID in `bookings.google_calendar_event_id`.
  Env: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (or key file path).
- [ ] Wire into C8 confirm handler (after booking insert).
- **Verify:** Confirming a test booking creates a Calendar event with customer name, appliance,
  symptom, address; `google_calendar_event_id` persisted on booking row.

### E2. Google Calendar delete on cancel
- [ ] Extend calendar helper with `deleteBookingEvent(eventId)`; wire into Phase F cancel route.
- **Verify:** Cancelling a booking with a calendar event ID removes the event; missing event ID
  is a no-op (no crash).

### E3. SMS templates loader (`asu-frontend`)
- [ ] Add `src/lib/sms/templates.ts`: load template by `key` from `sms_templates` via
  service-role client; interpolate `{{placeholders}}` (name, slot_time, address, etc.).
- **Verify:** Each seeded template key resolves; missing placeholder leaves token or errors
  clearly in dev; no hardcoded message strings in send functions.

### E4. Twilio outbound — booking confirmation SMS
- [ ] Install `twilio`. Add `src/lib/sms/send.ts` with `sendBookingConfirmation(booking)`.
  Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- [ ] Wire into C8 confirm handler (after calendar write).
- **Verify:** Test confirm sends SMS to customer phone from intake form; uses `booking_confirmation`
  template; Twilio logs show delivered/failed status.

### E5. Twilio outbound — model number photo request (~1hr follow-up)
- [ ] Add scheduled send: pg_cron job or Supabase Edge Function (or Next cron route) that
  queries `bookings` where `created_at < now() - 1 hour`, `model_number_photo_url is null`,
  and confirmation SMS sent, then sends `model_number_request` template. Track sent state
  (e.g. `bookings.model_number_sms_sent_at timestamptz` column in additive migration, or
  `booking_sms_log` table).
- **Verify:** Seeded booking past 1hr without photo triggers SMS once; booking with photo
  skips; duplicate cron tick does not re-send.

### E6. Twilio inbound MMS webhook + photo storage
- [ ] Add `POST /api/webhooks/twilio/route.ts`: parse inbound MMS, match booking by customer
  phone + upcoming slot, upload image to Supabase Storage (`appliances` bucket or dedicated
  `booking-photos/` prefix), set `bookings.model_number_photo_url`.
- **Verify:** Simulated Twilio webhook with test image uploads to Storage and updates booking
  row; unmatched phone returns `200` without crash (log only).

### E7. Twilio outbound — 24hr appointment reminder
- [ ] Add scheduled job (pg_cron or cron route): query `bookings` where `slot_time` is
  tomorrow (local TZ), status not `cancelled`, reminder not yet sent; send
  `appointment_reminder_24hr` template. Track via `bookings.reminder_sms_sent_at` (additive
  column) or sms log.
- **Verify:** Seeded booking with slot_time ~24hr ahead receives reminder once; cancelled
  booking skipped; duplicate cron tick does not re-send.

---

## Phase F — Cancellation & Refunds (`asu-frontend`)

### F1. `POST /api/booking/cancel`
- [ ] Add `src/app/api/booking/cancel/route.ts`: accept `{ bookingId }` (and auth token or
  booking lookup by email+slot — keep simple for v1); enforce 48hr rule against `slot_time`;
  if eligible: `stripe.refunds.create({ payment_intent })`, set `refund_issued = true`,
  `status = 'cancelled'`, `cancellation_requested_at = now()`; call E2 calendar delete.
- **Verify:** Cancel 49hr before slot → refund issued + status cancelled; cancel 24hr before →
  no refund, status cancelled (or rejected with policy message — document chosen behavior);
  Stripe dashboard shows refund when eligible.

---

## Phase G — Admin Triage UI (`asu-admin`)

> Typed accessor → route handler → hook → dashboard UI. Reuse Wave 3 patterns.

### G1. Shared booking TypeScript types (`asu-admin`)
- [ ] Add `lib/types/booking.ts`: `Booking`, `BookingAddress`, `BookingStatus`, `ApplianceType`,
  `PendingBooking` — matching Phase A DDL 1:1.
- **Verify:** `npm run lint` and `tsc --noEmit` pass; fields match DB columns.

### G2. `bookings` server accessors
- [ ] Add `lib/data/bookings.ts`: `listBookings(filters)` (status, date range, search on
  customer name via join), `getBookingById(id)`, `updateBookingStatus(id, status)`,
  `setDiagnosticWaived(id, waived)`, `linkBookingToJob(id, jobId)`, `triageBooking(id)` —
  find-or-create customer from booking address/contact, `createJob({ job_class: 'Customer',
  job_type: 'Diagnostic', customer_id, details: { bookingId, appliance, symptom } })`, set
  `bookings.job_id` and status `scheduled`. Include `runBookingsAccessorSmokeTest()`.
- **Verify:** Smoke test: list returns seeded booking; triage creates customer + job and links
  `job_id`; duplicate triage is idempotent or rejected; `npm run lint` and `tsc` pass.

### G3. Diagnostic fee waiver → invoice credit
- [ ] Extend triage or add `applyDiagnosticFeeCredit(bookingId, invoiceId)`: when
  `diagnostic_waived = true`, add invoice line item `kind: 'fee'`, negative amount =
  `-diagnostic_fee_amount`, description "Diagnostic fee credit (same-visit repair)".
- **Verify:** Invoice total reflects credit; booking `diagnostic_waived` persists; line item
  visible on invoice detail.

### G4. `/api/bookings` route handler
- [ ] Add `app/api/bookings/route.ts` (GET list / `?id=` single, PATCH status/triage actions)
  following `app/api/customers/route.ts` shape: auth required, typed JSON, validation → `400`.
- **Verify:** Authenticated GET/PATCH succeed; unauthenticated → `401`; triage PATCH returns
  `{ success: true, jobId, customerId }`.

### G5. Client hook for Admin UI
- [ ] Add `lib/hooks/use-bookings.ts` wrapping the route handler with loading + error state,
  mirroring `lib/hooks/use-customers.ts`.
- **Verify:** Hook exposes correct `loading`/`error` transitions; `npm run lint` passes.

### G6. Bookings list page
- [ ] Add `app/dashboard/bookings/page.tsx`: `DataTable` with columns (slot_time, appliance_type,
  brand, symptom, status, customer) + status filter + skeleton loading + empty state via
  `useBookings`.
- **Verify:** Lists bookings from `/api/bookings`; status filter narrows results; loading and
  empty states render without throwing.

### G7. Booking detail + triage action
- [ ] Add `app/dashboard/bookings/[id]/page.tsx`: booking summary (intake fields, address,
  payment status, model photo if present, calendar link) + **Triage → Create Job** button
  (server action calling triage accessor) + **Waive diagnostic fee** toggle for same-visit
  repair.
- **Verify:** Detail renders seeded booking; triage creates linked job visible on job detail
  page; waive toggle persists `diagnostic_waived`.

### G8. Navigation + QA gate
- [ ] Add **Bookings** to `components/dashboard-navbar.tsx` (after Jobs or before Customers);
  ensure list + detail routes have loading/empty/error states; run `npm run lint` and
  `next build`.
- **Verify:** Nav link routes to `/dashboard/bookings` with correct active state; both routes
  handle loading/empty/error; `npm run lint` and `next build` pass with no type errors.

---

## Phase H — Route Optimization (Admin App, last / low priority)

> Implement only after Phase G is human-verified and end-to-end booking works.

### H1. Google Maps Routes Optimization API integration
- [ ] Add `lib/google-maps/route-optimizer.ts`: accept confirmed bookings for a given day
  (addresses from `bookings.address`), call Routes Optimization API, return ordered stop list.
  Env: `GOOGLE_MAPS_API_KEY` (server-only). Add `POST /api/bookings/optimize-route` (auth
  required, body `{ date }`).
- **Verify:** Seeded day with 3+ bookings returns ordered list minimizing drive time; API key
  not exposed client-side; unauthenticated → `401`.

### H2. "Optimize today's route" admin UI action
- [ ] Add manual action on `app/dashboard/bookings/page.tsx` (or day view): date picker +
  "Optimize route" button displaying ordered stops with addresses and slot times.
- **Verify:** Clicking optimize for a seeded day renders ordered stop list; empty day shows
  friendly empty state; errors surface via toast without crash.

---

## Wave 4 Exit Criteria
- [ ] `serviceable_zips`, `pending_bookings`, `bookings`, and `sms_templates` tables exist
  with constraints, indexes, triggers, and pg_cron cleanup (Phase A); `products` /
  `product_images` / storefront reads untouched.
- [ ] RLS enabled and verified **internal-only** on all new tables (Phase B); no anon access
  to booking data; writes flow only through service-role API routes in `asu-frontend`.
- [ ] Slot availability honors confirmed bookings + non-expired holds; max 4 slots per field
  day; Tue/Thu 10:00–17:00 only (Phase C3/C5/C6).
- [ ] End-to-end customer flow works: intake → zip validate → slot hold → Stripe $70 payment
  → confirm → booking row + customer row (Phase C/D).
- [ ] Confirm side effects fire: Google Calendar event, confirmation SMS, model-number
  follow-up, 24hr reminder (Phase E).
- [ ] Cancellation enforces 48hr refund rule via Stripe (Phase F).
- [ ] Admin bookings list, detail, triage → Customer/Diagnostic job, and diagnostic fee
  waiver credit on invoice are wired (Phase G).
- [ ] Route optimizer available as manual admin action (Phase H).
- [ ] Each task above was completed individually and **human-verified** before the next began.
