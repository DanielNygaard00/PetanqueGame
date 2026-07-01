## Fix: controlled inputs

**Changes made:**

1. **Fix 1 — controlled count/volume inputs** (`DrinksEditor.tsx`): Reverted `Antal` and `Volumen (cl)` inputs from `defaultValue=` back to controlled `value=`. This is the correct approach when the parent provides a stateful wrapper (as in real usage and the updated test).

2. **Fix 2 — clear wineRegion on type change** (`DrinksEditor.tsx`): Changed the Type SelectOrAdd `onChange` from the previous logic (`d.type === "Vin" || v === "Vin"`) to `v === "Vin" ? { type: v } : { type: v, wineRegion: undefined }`. Non-Vin types now clear any stale `wineRegion` rather than preserving it. The `Drink` type already defines `wineRegion?: string | null` so `undefined` is valid.

3. **Fix 3 — stateful wrapper in test** (`DrinksEditor.test.tsx`): Replaced the static-render "edits count for a row" test with a `Wrapper` component that owns state via `React.useState`. On each keystroke the parent re-renders with the updated prop, making the controlled `value=` receive the correct current value. Added `import React from "react"` at the top of the test file.

**Type check:** `Drink.volumeCl` is `number | null` (confirmed in `types.ts` line 13) — no widening needed.

**Test result:** 3/3 in `DrinksEditor.test.tsx`; full suite 16/16 across 9 test files — all green.

**Build result:** Clean — `tsc -b && vite build` completed with no errors. Pre-existing chunk-size warning (>500 kB) unrelated to these changes.
