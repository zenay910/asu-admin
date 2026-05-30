# Phase 0 — Canonical `status` Vocabulary (Task 0.3)

**Ratified:** 2026-05-29  
**Scope:** `public.products.status` only  
**Source census:** `phase-0-enum-census.md` (Task 0.2)

---

## Canonical set (title-case)

| Value | Meaning |
|---|---|
| `Draft` | Internal only; not customer-visible |
| `Published` | Customer-visible on storefront |
| `Sold` | Terminal; removed from storefront |
| `Archived` | Terminal; removed from storefront (non-sale removal) |

**Rules:**
- Title-case only. No uppercase variants (e.g. `SOLD` is invalid).
- Storefront visibility: only `Published`.
- Target DB CHECK (Phase A2, after 0.4): `status IN ('Draft','Published','Sold','Archived')`.

---

## Live → canonical mapping (every value from Task 0.2)

| Live value | Rows | Maps to | Action |
|---|---|---|---|
| `Published` | 17 | `Published` | None (identity) |
| `Sold` | 7 | `Sold` | None (identity) |
| `SOLD` | 5 | `Sold` | **Normalize in Task 0.4** |

**Observed values:** 3 · **Unmapped:** 0 · **Row sum:** 29

---

## Post-cleanup expected state (Task 0.4 target)

| Value | Expected rows |
|---|---|
| `Published` | 17 |
| `Sold` | 12 (7 + 5) |
| `Draft` | 0 |
| `Archived` | 0 |

**SQL (Task 0.4):** `UPDATE products SET status = 'Sold' WHERE status = 'SOLD';`

**Executed:** 2026-05-29 · 5 rows updated · idempotent (re-run affects 0 rows)

---

## Human approval

- [x] Canonical set approved
- [x] Mapping approved for Task 0.4 execution
