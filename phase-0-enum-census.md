# Phase 0 — Enum Data Census (Task 0.2)

**Captured:** 2026-05-29  
**Source:** live `public.products` (read-only query via Supabase)  
**Total products:** 29

This census satisfies Phase 0, Task 0.2. No data or schema was modified.

---

## Summary

| Field | Distinct values | Rows accounted | Drift notes |
|---|---|---|---|
| `status` | 3 | 29 | **Casing drift:** `SOLD` (5) vs canonical `Sold` (7) |
| `type` | 4 | 29 | `Electric Range` (1) not mapped in storefront filters |
| `condition` | 1 | 29 | All `Good`; no drift |
| `configuration` | 6 (+ 2 null) | 29 | All non-null values within app `ALLOWED` set |
| `fuel` | 2 (+ 1 null) | 29 | All non-null values within app `ALLOWED` set |
| `unit_type` | 2 | 29 | All values within app `ALLOWED` set |

---

## `status` (primary cleanup target for Task 0.4)

| Live value | Row count | Classification | Notes |
|---|---|---|---|
| `Published` | 17 | **Canonical** | Matches proposed vocabulary |
| `Sold` | 7 | **Canonical** | Title-case; matches proposed vocabulary |
| `SOLD` | 5 | **Needs cleanup** | Uppercase variant → normalize to `Sold` in Task 0.4 |

**Status row sum:** 17 + 7 + 5 = **29** ✓

**Absent from live data (no rows):** `Draft`, `Archived` — both are in the proposed canonical set and admin `ALLOWED.status` but unused live.

**Code drift (flagged for Task 0.5):** Admin `form_import.mjs` `ALLOWED.status` = `Draft`, `Published`, `Archived` — does **not** include `Sold`, yet 12 live rows are sold (`Sold` + `SOLD`).

---

## `type`

| Live value | Row count | Classification | Notes |
|---|---|---|---|
| `Washer` | 11 | Within vocabulary | Storefront maps under "Washers" filter |
| `Dryer` | 12 | Within vocabulary | Storefront maps under "Dryers" filter |
| `Range` | 5 | Within vocabulary | Storefront maps under "Stoves/Ranges" filter |
| `Electric Range` | 1 | **Drift (non-blocking)** | Not matched by storefront `Stove`/`Range` filter logic |

**Type row sum:** 11 + 12 + 5 + 1 = **29** ✓

---

## `condition`

| Live value | Row count | Classification | Notes |
|---|---|---|---|
| `Good` | 29 | Within vocabulary | App `ALLOWED`: New, Good, Fair, Poor |

**Condition row sum:** **29** ✓

---

## `configuration`

| Live value | Row count | Classification | Notes |
|---|---|---|---|
| `Top Load` | 10 | Within vocabulary | |
| `Front Load` | 9 | Within vocabulary | |
| `Glass Cooktop` | 4 | Within vocabulary | |
| `Coil Cooktop` | 2 | Within vocabulary | |
| `Standard` | 2 | Within vocabulary | |
| `<null>` | 2 | Acceptable null | Nullable column |

**Configuration row sum:** 10 + 9 + 4 + 2 + 2 + 2 = **29** ✓

**Absent from live data:** `Stacked Unit`, `Slide-In` (both in app `ALLOWED` set).

---

## `fuel`

| Live value | Row count | Classification | Notes |
|---|---|---|---|
| `Electric` | 27 | Within vocabulary | |
| `Gas` | 1 | Within vocabulary | |
| `<null>` | 1 | Acceptable null | Nullable column |

**Fuel row sum:** 27 + 1 + 1 = **29** ✓

---

## `unit_type`

| Live value | Row count | Classification | Notes |
|---|---|---|---|
| `Individual` | 16 | Within vocabulary | |
| `Set` | 13 | Within vocabulary | |

**Unit type row sum:** 16 + 13 = **29** ✓

---

## Casing / typo drift confirmed

| Issue | Scope | Task |
|---|---|---|
| `SOLD` vs `Sold` | 5 rows need normalization | **0.4** (data cleanup) |
| `Sold` missing from admin `ALLOWED.status` | Code reconciliation | **0.5** (flag-only, deferred) |
| `Electric Range` vs `Range` | 1 row; storefront filter gap | Informational; not Phase 0 blocking |
