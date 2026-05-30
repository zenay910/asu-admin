# Phase 0 — Code Reconciliation Flags (Task 0.5)

**Recorded:** 2026-05-29  
**Status:** Deferred — no code edited in Phase 0

---

## CR-001: Canonical `status` set out of sync

| Location | Current `status` values | Canonical (0.3) |
|---|---|---|
| `asu-admin/.../form_import.mjs` `ALLOWED.status` | `Draft`, `Published`, `Archived` | `Draft`, `Published`, `Sold`, `Archived` |
| `asu-admin/.../view/page.tsx` filter + mark-sold | writes `Sold` directly | ✓ uses `Sold` |
| `asu-frontend` storefront query | `.eq("status", "Published")` | ✓ read-only |

**Impact:** Re-saving a sold unit through the admin inventory **form** throws `Invalid status "Sold"`.

**Required fix (own gated task, post–Phase 0):**
1. Add `Sold` to `ALLOWED.status` in `form_import.mjs`.
2. Mirror canonical set in any duplicated validators / TypeScript unions.
3. Align admin form default options with `phase-0-status-vocabulary.md`.

**Blocked by:** nothing (data cleaned in 0.4). Safe to implement after Phase 0 exit gate.

---

## CR-002: `type` value `Electric Range` (informational)

| Location | Issue |
|---|---|
| Live DB | 1 row with `type = 'Electric Range'` |
| Storefront filter | maps `Stove` / `Range` only — row may not appear under "Stoves/Ranges" |

**Impact:** Non-blocking; inventory display/filter gap only.

**Required fix:** own task — normalize type or extend storefront filter mapping.
