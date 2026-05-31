# Phase D Task D1 — `products` → `appliances` Backfill Dry-Run

**Executed:** 2026-05-29 (read-only)  
**Source:** `public.products` (29 rows)  
**Mapping module:** `lib/migration/products-to-appliances.ts`  
**SQL mirror:** `supabase_postgresql/d1_products_to_appliances_dry_run.sql`

---

## Summary

| Metric | Value |
|---|---|
| Source rows (`products`) | **29** |
| Mapped rows | **29** |
| A2 CHECK violations | **0** |
| Preserved `id` (uuid) | Yes — 1:1 for D2 idempotent insert |

## Canonical `status` (post–Phase 0.4)

| Live `status` | Rows | Canonical | `lifecycle_state` |
|---|---|---|---|
| `Published` | 17 | `Published` | `Listed` |
| `Sold` | 12 | `Sold` | `Retired` |
| `SOLD` | 0 | — | (0.4 cleanup confirmed) |

## Lifecycle derivation (deterministic)

| Rule | `lifecycle_state` |
|---|---|
| `status = Published` | `Listed` |
| `status IN (Sold, Archived)` | `Retired` |
| `status = Draft` | `Intake` |
| `status` null / other | `Intake` |

**Result:** `Listed` × 17 · `Retired` × 12 · `Intake` × 0 · `Refurbishment` × 0

## Field transforms

| Source (`products`) | Target (`appliances`) |
|---|---|
| `id` | same uuid |
| `features` (`json`) | `features::jsonb` |
| `age` | `age` (15/29 non-null) |
| `status` | canonical via `canonicalStatus()` (`SOLD` → `Sold`) |
| `title` / `brand` / `model_number` | trimmed; empty → `''` (NOT NULL targets) |
| all other scalar columns | direct copy |

## A2 validation (all 29 rows pass)

- `appliances_status_check`
- `appliances_lifecycle_state_check`
- `appliances_condition_check`
- `appliances_configuration_check`
- `appliances_unit_type_check`
- `appliances_fuel_check`
- `appliances_published_requires_listed_check`

## Notes (non-blocking)

- `type = 'Electric Range'` on 1 row — no `type` CHECK on `appliances`; maps through unchanged.
- `product_images` (84 rows) — out of D1 scope; D2 maps to `appliance_images` with same `appliance_id = product_id`.

## Human approval (D1)

- [x] Dry-run mapping approved before D2 execute
