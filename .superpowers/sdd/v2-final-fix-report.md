# v2 Final Fix Report

Date: 2026-07-01  
Branch: feature/v2-analytics  
Commit: a0e718f6af79c5f1a703c8f716c3db600dcecd1f

## Fixes Applied

### Fix 1 — Blank numeric fields must be undefined, not 0

**File:** `client/src/pages/MatchFormPage.tsx`

- **Point** `onChange` changed from `Number(e.target.value)` to `e.target.value === "" ? undefined : Number(e.target.value)`
- **Konsekutive spil** `onChange` changed from `Number(e.target.value)` to `e.target.value === "" ? undefined : Number(e.target.value)`

Both fields now emit `undefined` when cleared, matching the existing pattern already used for `Modstander_Point`.

### Fix 2 — DrinksEditor persists new option values (onAdd)

**Files:** `client/src/components/DrinksEditor.tsx`, `client/src/pages/MatchFormPage.tsx`

**2a — DrinksEditor:**
- Added four optional props to the `Props` type: `onAddType`, `onAddCategory`, `onAddBrand`, `onAddName` (all `(v: string) => void`)
- Destructured all four in the function signature
- Passed `onAdd={onAddType}` to Type `SelectOrAdd`, `onAdd={onAddCategory}` to Kategori, `onAdd={onAddBrand}` to Brand, `onAdd={onAddName}` to Navn

**2b — MatchFormPage:**
- Added four `useAddOption` hooks: `addDrinkType`, `addDrinkCategory`, `addDrinkBrand`, `addDrinkName`
- Wired all four as `onAdd*` props on `<DrinksEditor />`

### Fix 3 — Recent matches respects player filter

**File:** `client/src/pages/DashboardPage.tsx`

Changed `data.slice(0, 5)` to `filtered.slice(0, 5)` in the "Seneste kampe" section so the list honours the active player filter.

### Fix 4 — Danish labels for time-of-day buckets

**File:** `client/src/pages/DashboardPage.tsx`

Added a `TIME_LABELS` constant mapping English bucket keys to Danish display strings:

```
morning   → "Morgen (5–11)"
afternoon → "Eftermiddag (12–16)"
evening   → "Aften (17–21)"
night     → "Nat (22–4)"
unknown   → "Ukendt tid"
```

The "Sejrsrate efter tidspunkt" `InsightsBar` now maps rows through `TIME_LABELS` before rendering.

### Fix 5 — Drop dead const in InsightsBar

**File:** `client/src/components/InsightsBar.tsx`

Removed `const max = 100;` and replaced `${(r.winRate / max) * 100}%` with `${r.winRate}%` directly. Because `winRate` is already a 0–100 value, the division was a no-op.

## Test Results

| Suite    | Files | Tests | Status |
|----------|-------|-------|--------|
| Client   | 8     | 16    | All passed |
| Backend  | 10    | 34    | All passed |

## Build Result

Client production build: **clean** (`tsc -b` + `vite build` both succeeded with no errors).  
One non-blocking chunk size warning (recharts bundle >500 kB) — pre-existing, unrelated to these changes.

## Concerns

None. All fixes are minimal and targeted; no new tests are needed as the changed logic is covered by existing test suites and TypeScript type checking.
