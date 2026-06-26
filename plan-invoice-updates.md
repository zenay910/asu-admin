# Invoice Form Updates — Implementation Plan

**Scope:** Three features added to the appliance-sale invoice creation flow.
**Design constraint:** Industrial Monastic — high-signal, minimalist, functional density.
**Execution rule:** One task at a time. Stop and await human verification after each task.

---

## Context Snapshot

| File | Role |
|---|---|
| `app/dashboard/invoices/new/appliance-sale/appliance-sale-invoice-form.tsx` | Client form component (554 lines) |
| `components/customer-picker.tsx` | Customer search + select dropdown |
| `lib/operations/create-appliance-sale-invoice.ts` | Server operation — orchestrates invoice creation |
| `app/dashboard/invoices/actions.ts` | Server action bridge → `/api/invoices` |
| `app/api/invoices/route.ts` | POST handler — parses body, dispatches to operation |
| `lib/data/invoices.ts` | Data accessors — `createInvoice`, `addLineItem`, `recomputeInvoiceTotals` |
| `lib/types/operations.ts` | Canonical types: `LineItemKind`, `Invoice`, `InvoiceLineItem` |
| `app/dashboard/customers/actions.ts` | `createCustomerItem` server action |
| `app/dashboard/customers/types.ts` | `CustomerFormState`, `CustomerFormValues` |

### Current Tax Semantics (being replaced)
`tax` on `invoices` is a raw dollar amount entered by the operator. `total = subtotal + tax`. There is no rate-based formula today.

### Current `LineItemKind` (being extended)
```
'labor' | 'part' | 'appliance' | 'fee'
```
Enforced by `invoice_line_items_kind_check` DB constraint AND the `LineItemKind` TypeScript type.

---

## Feature 1 — Inline Customer Creation

### Problem
`CustomerPicker` already imports `Dialog` and `CustomerForm` but they are not wired. `CustomerForm` uses `useActionState` and shows a "View customer" link on success — it is designed for the standalone creation page, not an embedded modal.

### Approach
Create a new `components/quick-add-customer-dialog.tsx` component that:
- Renders a `DialogTrigger` button labeled "New customer" inside `CustomerPicker`
- Contains a focused form (full_name required, email + phone optional — minimal footprint)
- Calls the existing `createCustomerItem` server action via `useActionState` (zero new server code)
- Uses a `useEffect` watching `state.customerId`: when it becomes non-null, calls the `onSuccess(id, fullName)` callback, resets state, closes the dialog via a controlled `open` boolean
- Accepts props: `onSuccess: (customerId: string, fullName: string) => void`

### CustomerPicker changes
- Add `open` / `setOpen` state for the dialog
- Pass `onSuccess` that calls `onChange(customerId)` and appends the new customer to a local `pinnedCustomers` state list (avoids needing a network refetch to see the selection)
- The pinned entry is merged with `customers` in the dropdown so the new customer is immediately selectable

### Files touched
| File | Change |
|---|---|
| `components/quick-add-customer-dialog.tsx` | **New** — dialog + embedded form |
| `components/customer-picker.tsx` | Wire dialog, add `pinnedCustomers` state, remove broken existing `<Dialog>` stub |

### Verify metric
Open the invoice form, click "New customer", fill name + email, submit. The dialog closes, the new customer appears selected in the picker, the invoice can be submitted with that customer linked.

---

## Feature 2 — Line-Item Reductions (Discounts & Trade-ins)

### Sub-feature 2a — Schema: extend `invoice_line_items.kind`

**Problem:** The DB constraint `invoice_line_items_kind_check` only allows `labor | part | appliance | fee`. Inserting a `discount` or `trade_in` row will be rejected.

**Change:** Additive migration — drop the old constraint, add a new one with two extra values.

```sql
-- supabase_postgresql/add_reduction_line_item_kinds.sql
ALTER TABLE invoice_line_items
  DROP CONSTRAINT IF EXISTS invoice_line_items_kind_check;

ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_line_items_kind_check
    CHECK (kind IN ('labor', 'part', 'appliance', 'fee', 'discount', 'trade_in'));
```

**Type update:** `lib/types/operations.ts` — extend `LineItemKind`:
```typescript
export type LineItemKind = 'labor' | 'part' | 'appliance' | 'fee' | 'discount' | 'trade_in'
```

**No other files change in this task.**

### Verify metric
Run the migration against the live DB. Confirm `\d invoice_line_items` shows the new constraint. `npm run lint` passes (type change is additive — no existing callers break).

---

### Sub-feature 2b — Tax formula and `recomputeInvoiceTotals`

**Problem:** Tax is currently a user-entered absolute dollar value. The requirement mandates a structured formula:
```
taxable_base = (sum of positive line totals) − (sum of discount line totals) − (sum of trade_in line totals)
tax          = taxable_base × TAX_RATE   // TAX_RATE = 0.00
total        = taxable_base + tax
subtotal     = taxable_base              // stored as net-of-reductions
```

With `TAX_RATE = 0.00`, `tax = 0` and `total = taxable_base` always, but the structure must be in place.

**Changes — `lib/data/invoices.ts`:**
- Export `export const TAX_RATE = 0.00`
- Rewrite `recomputeInvoiceTotals`:
  - Partition `line_items` by kind: positive kinds (`appliance`, `fee`, `part`, `labor`) vs reduction kinds (`discount`, `trade_in`)
  - `grossSubtotal = sum of positive line_totals`
  - `discountsTotal = sum of discount line_totals` (these are stored as negative values — see 2c)
  - `tradeInsTotal = sum of trade_in line_totals` (also negative)
  - `taxableBase = grossSubtotal + discountsTotal + tradeInsTotal` (additions because they are already negative)
  - `tax = taxableBase * TAX_RATE`
  - `subtotal = taxableBase`, `total = taxableBase + tax`
  - Write `{ subtotal, tax, total }` to the `invoices` row

**Changes — `lib/operations/create-appliance-sale-invoice.ts`:**
- Remove `tax` from `CreateApplianceSaleInvoiceInput` (it is now computed, not accepted)
- Remove the `tax` pass-through to `createInvoice` (pass `tax: 0` as initial placeholder; `recomputeInvoiceTotals` overwrites it)

**Changes — `app/dashboard/invoices/actions.ts`:**
- Remove `tax` from `CreateApplianceSaleInvoicePayload`

**Changes — `app/api/invoices/route.ts`:**
- Remove `tax` extraction from the `appliance_sale` dispatch branch (no longer accepted from caller)

### Verify metric
Create an invoice with no reductions — `tax` and `total` are both `0` beyond the appliance price. Confirm `recomputeInvoiceTotals` no longer reads the old `tax` field.

---

### Sub-feature 2c — Operation layer: discount + trade-in line items

**Problem:** `createApplianceSaleInvoice` has no knowledge of reductions.

**Changes — `lib/operations/create-appliance-sale-invoice.ts`:**

Add input types:
```typescript
export type ApplianceSaleDiscountInput = {
  description: string   // e.g. "Washer markdown"
  amount: number        // positive dollar amount, stored as negative unit_price
}

export type ApplianceSaleTradeInInput = {
  description: string   // e.g. "Old washer trade-in"
  amount: number        // positive dollar amount, stored as negative unit_price
}
```

Extend `CreateApplianceSaleInvoiceInput`:
```typescript
discounts?: ApplianceSaleDiscountInput[]
tradeIns?:  ApplianceSaleTradeInInput[]
```

In the operation body, after fee and accessory line items, loop over discounts and trade-ins, calling `addLineItem` with `unit_price: -amount` so `line_total` is negative and automatically reduces the subtotal in `recomputeInvoiceTotals`.

**Changes — `app/dashboard/invoices/actions.ts`:**

Add payload types:
```typescript
export type ApplianceSaleDiscountPayload = { description: string; amount: number }
export type ApplianceSaleTradeInPayload  = { description: string; amount: number }
```

Extend `CreateApplianceSaleInvoicePayload`:
```typescript
discounts?: ApplianceSaleDiscountPayload[]
tradeIns?:  ApplianceSaleTradeInPayload[]
```

Pass them through `invoicesApiPost`.

**Changes — `app/api/invoices/route.ts`:**
- Add `parseReductions(raw: unknown, label: string)` helper (mirrors `parseFees` pattern)
- Extract `discounts` and `tradeIns` arrays from body in the `appliance_sale` dispatch branch
- Pass to `createApplianceSaleInvoice`

### Verify metric
Create an invoice with a $29 discount and $60 trade-in on a $519 appliance. `subtotal` = $519 − $29 − $60 = $430. `tax = 0`. `total = $430`. Confirm line items in DB contain two rows with negative `line_total`.

---

### Sub-feature 2d — Form UI: Discounts & Trade-ins sections

**Files touched:** `app/dashboard/invoices/new/appliance-sale/appliance-sale-invoice-form.tsx`

**State additions:**
```typescript
type DiscountRow = { key: string; description: string; amount: string }
type TradeInRow  = { key: string; description: string; amount: string }

const [discounts, setDiscounts] = useState<DiscountRow[]>([])
const [tradeIns, setTradeIns]   = useState<TradeInRow[]>([])
```

**Parser functions** (mirrors `parseFees` pattern):
- `parseDiscounts(rows: DiscountRow[]): ApplianceSaleDiscountPayload[] | string`
- `parseTradeIns(rows: TradeInRow[]): ApplianceSaleTradeInPayload[] | string`

**Preview subtotal update:**
```
previewGross     = appliance price + fees + accessories
previewDiscounts = sum of valid discount amounts
previewTradeIns  = sum of valid trade-in amounts
previewSubtotal  = previewGross − previewDiscounts − previewTradeIns
previewTax       = previewSubtotal * TAX_RATE (= 0)
previewTotal     = previewSubtotal + previewTax
```

Display in summary panel:
- Gross subtotal line (if reductions exist)
- Discounts line (if any)
- Trade-ins line (if any)
- Net subtotal / Total line

**UI sections (after Accessories, before the summary panel):**

*Discounts section* — header "Discounts", "Add discount" button, row grid matching fee layout: description | amount | Remove.

*Trade-ins section* — header "Trade-ins", "Add trade-in" button, same row layout.

**Remove:** The `<section>` containing the manual `Tax` input (replaced by computed value).

**`handleSubmit` update:** validate + parse discounts and trade-ins; remove `tax` from payload; pass `discounts` and `tradeIns`.

### Verify metric
Add a $29 discount and a $60 trade-in on a $519 appliance. Summary panel shows Gross $519, Discounts −$29, Trade-ins −$60, Total $430. Submit → invoice detail page shows correct line items and totals.

---

## Feature 3 — Tax Calculation Placeholder

This feature is **fully satisfied by Sub-feature 2b**. The `TAX_RATE = 0.00` constant, the formula structure in `recomputeInvoiceTotals`, and the removal of the manual tax input together constitute the complete implementation. No additional task is required.

---

## Task Execution Order

| # | Task | Primary files | Verify |
|---|---|---|---|
| 1 | Schema: extend `kind` constraint | `supabase_postgresql/add_reduction_line_item_kinds.sql`, `lib/types/operations.ts` | Migration applied; lint passes |
| 2 | Tax formula: `recomputeInvoiceTotals` + remove user-supplied tax | `lib/data/invoices.ts`, `lib/operations/create-appliance-sale-invoice.ts`, `app/dashboard/invoices/actions.ts`, `app/api/invoices/route.ts` | New invoice has tax=0, total=subtotal; lint passes |
| 3 | Operation: discount + trade-in line items | `lib/operations/create-appliance-sale-invoice.ts`, `app/dashboard/invoices/actions.ts`, `app/api/invoices/route.ts` | DB rows show negative line_totals; subtotal correct |
| 4 | UI: Discounts & Trade-ins sections | `appliance-sale-invoice-form.tsx` | Preview math correct; end-to-end submit works |
| 5 | UI: Inline customer creation | `components/quick-add-customer-dialog.tsx` (new), `components/customer-picker.tsx` | Dialog creates customer, auto-selects, invoice submits with customer_id |

Tasks 1 → 2 → 3 → 4 are strictly ordered (each builds on the previous). Task 5 is independent and can be done after Task 4 or in parallel review.

---

## Non-Goals / Deferred

- Tax rate UI (rate is hardcoded `0.00` — entering a non-zero rate is a future task)
- Partial discounts that apply only to a specific line item (current plan: free-text description)
- Trade-in inventory tracking (trade-ins are credit lines only — no inventory creation)
- RLS on `invoice_line_items` (pre-existing gap documented in AGENTS.md — not in scope)
