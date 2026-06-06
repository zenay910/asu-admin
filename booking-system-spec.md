# Booking System — Technical Spec
## Context

This is a **planning session**. You are helping build a booking system for an appliance repair business. There are two apps that share one Supabase instance: a **public-facing booking app** (asu-frontend) and an **admin app** (asu-admin). Your job is to plan and implement the booking flow on the public app and the backend logic that feeds the admin app.

Read the existing Supabase schema, existing tables, and existing codebase structure before proposing anything. Fit into what already exists. Ask clarifying questions if the schema is ambiguous before writing migrations.

---

## Business Rules

- Services: Washer, Dryer, Oven/Stove repair only
- Field days: **Tuesday and Thursday, 10:00am – 5:00pm**
- Slot duration: 1 hour (max 1.5hr on-site, but book in 1hr blocks)
- ~3–4 jobs per day, first come first served (driving time in between slots)
- One shared calendar/slot pool (single technician assignment handled manually in admin app)
- Service area enforced by zip code allowlist (list to be provided or managed in Supabase)
- Diagnostic fee: **$70**, charged at booking, non-refundable except per cancellation policy
- Cancellation policy: **Full refund if cancelled 48+ hours before appointment. No refund under 48 hours.**
- If repair is completed same visit: diagnostic fee is **deducted from total invoice** (not refunded via Stripe — handled as a credit on the invoice in the admin app)
- If repair requires a second visit: diagnostic fee stands, second visit billed separately

---

## Booking Flow (Strict Order)

### Step 1 — Intake Form (multi-step, single page, no navigation between steps until current step is valid)

**Step 1: Appliance Type**
Large card/button UI (not a dropdown). Options: `Washer` | `Dryer` | `Oven/Stove`

**Step 2: Symptom** (conditional on Step 1)
Selectable chips, pick one. Include "Other" on every list.

- Washer: Not draining (water left in drum) | Drum won't spin or agitate | Leaking water | Loud banging or grinding noises | Other
- Dryer: Not heating (clothes take too long or stay damp) | Drum not turning | No power/lights | Squeaking or grinding noises | Other
- Oven/Stove: Cooktop burner won't ignite / heat | Oven won't heat up | Cooking unevenly / Burning food | Control panel / Display is unresponsive | Other

**Step 3: Specifics**
- Brand: Dropdown, strictly limited (Whirlpool, Kenmore, GE, Hotpoint, LG, Samsung, Maytag, Frigidaire, KitchenAid, Amana, Admiral, Speed Queen — confirm or adjust this list)
- Additional context: `textarea`, free text, optional but encouraged

**Step 4: Logistics**
- Address: street, city, state, zip — zip validated against serviceable zip code list in Supabase
- Name, phone number, email

### Step 2 — Slot Picker
- Only shown after Step 4 passes zip validation
- Fetch available Tuesday/Thursday 1hr slots from backend
- Backend checks Supabase `bookings` table (confirmed + pending, not expired) to determine availability
- User selects a slot → backend writes a `pending_bookings` row with `expires_at = now() + 15 minutes`
- If slot is taken or hold expired before payment, show a friendly message and return to slot picker

### Step 3 — Payment
- Stripe `PaymentElement` embedded in page
- Charge $70 on submission
- Display cancellation policy clearly above the Pay button before charging
- On Stripe payment success → fire backend confirmation handler

---

## Backend: On Payment Success (atomic, in order)

1. Delete the `pending_bookings` row
2. Insert confirmed row into `bookings` table (see schema below)
3. Write event to Google Calendar (Supabase is source of truth; Google Cal is a display mirror)
4. Trigger SMS confirmation to customer (Twilio)
5. Schedule follow-up SMS (~1hr later) requesting model number photo if not already uploaded
6. Admin app reflects new job immediately via Supabase real-time or on next load

---

## Supabase Schema Additions

Check existing schema first. Add only what's missing.

```sql
-- Slot holds (ephemeral, cleaned up by pg_cron)
pending_bookings (
  id uuid primary key,
  slot_time timestamptz not null,
  form_data jsonb,          -- snapshot of intake form
  created_at timestamptz default now(),
  expires_at timestamptz not null
)

-- Confirmed bookings (integrate with existing jobs table if appropriate)
bookings (
  id uuid primary key,
  customer_id uuid references customers(id),
  slot_time timestamptz not null,
  appliance_type text not null,       -- washer | dryer | oven_stove
  brand text not null,
  symptom text not null,
  symptom_detail text,
  address jsonb not null,             -- {street, city, state, zip}
  stripe_payment_intent_id text,
  diagnostic_fee_paid boolean default true,
  diagnostic_fee_amount numeric default 70,
  diagnostic_waived boolean default false,  -- set in admin app if repaired same visit
  status text default 'pending',      -- pending | scheduled | in_progress | completed | cancelled
  model_number_photo_url text,        -- populated after customer sends MMS
  cancellation_requested_at timestamptz,
  refund_issued boolean default false,
  created_at timestamptz default now()
)

-- Serviceable zip codes
serviceable_zips (
  zip text primary key,
  label text    -- optional human label e.g. "Salt Lake City"
)
```

Add a `pg_cron` job to delete expired `pending_bookings`:
```sql
SELECT cron.schedule('cleanup-pending-bookings', '*/5 * * * *',
  $$DELETE FROM pending_bookings WHERE expires_at < now()$$
);
```

---

## Integrations

### Google Calendar API
- Use a service account (no OAuth user flow needed)
- One shared calendar for all bookings
- On confirmed booking: create event with customer name, appliance, symptom, address
- On cancellation: delete event
- Read events only to cross-check (Supabase is truth)

### Stripe
- Straight charge (no Payment Intent capture-later needed)
- Amount: $70 (7000 cents)
- Metadata: `{ booking_id, customer_email, slot_time }`
- Store `payment_intent_id` on the booking row
- Refund API used for cancellations 48hrs+: `stripe.refunds.create({ payment_intent: id })`

### Twilio (SMS)
- Send from business phone number
- Messages to plan:
  1. **Booking confirmation** — sent immediately on payment success
  2. **Model number photo request** — sent ~1hr after booking if `model_number_photo_url` is null
  3. **24hr reminder** — sent the day before the appointment
  4. **Inbound MMS handler** — Twilio webhook receives customer photo reply, uploads to Supabase Storage, attaches URL to booking row
- All SMS content should be stored as templates (not hardcoded strings)

### Google Maps — Route Optimization (admin app, low priority)
- Use Routes Optimization API (not Directions API)
- Input: confirmed bookings for a given day with addresses
- Output: ordered stop list minimizing drive time
- Trigger: manual action in admin app ("Optimize today's route")
- Implement after everything else is working

---

## API Routes (Next.js `/app/api/` or `/pages/api/`)

| Route | Method | Purpose |
|---|---|---|
| `/api/booking/validate-zip` | POST | Check zip against `serviceable_zips` |
| `/api/booking/slots` | GET | Return available slots for next N weeks |
| `/api/booking/hold` | POST | Create `pending_bookings` row, return hold ID |
| `/api/booking/confirm` | POST | Called after Stripe success — full confirmation handler |
| `/api/booking/cancel` | POST | Cancel booking, trigger refund if 48hr rule met |
| `/api/webhooks/twilio` | POST | Receive inbound MMS, attach photo to booking |
| `/api/webhooks/stripe` | POST | Stripe event listener (backup/redundancy) |

---

## Build Order

1. Supabase schema additions + zip seed data
2. Multi-step intake form UI (no payment yet, just form state)
3. Zip validation API route + slot availability logic
4. Slot hold mechanism (pending_bookings + pg_cron)
5. Stripe payment integration
6. Booking confirmation handler (all side effects)
7. Google Calendar write on confirm
8. Twilio SMS — outbound confirmation + follow-up
9. Twilio inbound MMS webhook + photo storage
10. Cancellation flow + Stripe refund
11. 24hr reminder SMS (cron or scheduled function)
12. Route optimizer in admin app (last)

---

## Constraints & Notes

- Do not over-engineer. 3–4 jobs per day. Optimize for simplicity and reliability.
- All business logic lives in the backend (API routes or Supabase Edge Functions). The frontend only collects and displays.
- The admin app already has customer, job, parts, and invoice tables. Do not duplicate that logic — integrate with it.
- Never store Stripe keys or Twilio credentials in the frontend. Server-side only.
- Slot availability must account for both `bookings` (confirmed) and `pending_bookings` (held, not expired).
