# Phase D Task D2 — Backfill Execute

**Executed:** 2026-05-29  
**Migration:** `supabase_postgresql/migrations/20260529200000_d2_backfill_products_to_appliances.sql`  
**Applied:** `d2_backfill_products_to_appliances` (live)

---

## Counts

| Table | Source | Target | Match |
|---|---|---|---|
| Catalog | `products` 29 | `appliances` 29 | ✓ |
| Images | `product_images` 84 | `appliance_images` 84 | ✓ |

## Idempotency (re-run)

| Insert pass | Rows returned |
|---|---|
| `appliances` ON CONFLICT DO NOTHING | **0** |
| `appliance_images` ON CONFLICT DO NOTHING | **0** |

## Spot-check

| Check | Result |
|---|---|
| Field-for-field join (`products` ↔ `appliances`) | **0 mismatches** |
| A2 / RLS errors on apply | **none** |

`products` / `product_images` left intact (no cutover).
