# v4 Final Fix Report

## Fix 1 — Stop shipping stale assets in the Workbox precache

### Problem
`client/vite.config.ts` had `build: { emptyOutDir: false }`. Combined with vite-plugin-pwa/Workbox precaching everything in `client/dist`, incremental builds accumulated dead hashed `assets/index-*.js/css` from prior builds, leading to a bloated multi-MB precache and stale assets shipped to clients.

`client/.gitignore` used a `dist/*` + `!dist/.gitkeep` pattern to track a placeholder, which would conflict with a clean `emptyOutDir: true` build.

### Changes
1. `client/vite.config.ts`: `build: { emptyOutDir: false }` → `build: { emptyOutDir: true }`
2. `client/.gitignore`: replaced `dist/*` / `!dist/.gitkeep` lines with a plain `dist` entry (whole directory ignored)
3. `git rm --cached client/dist/.gitkeep` — untracked the placeholder; a fresh checkout will have no `dist/` until a build runs (which is the correct deploy/dev flow)

### Precache file count
- Before clean build: prior builds could accumulate many stale `assets/index-*.js` chunks (N/A on fresh clone)
- After clean build: **1** `assets/index-*.js` chunk (one main bundle)
- `dist/manifest.webmanifest`: present ✓
- `dist/sw.js`: present ✓
- Workbox reports: 9 precache entries, 723.78 KiB total

---

## Fix 2 — Consistent local date (kill UTC/local split)

### Problem
`client/src/stats/dateRange.ts` used `toISOString().slice(0,10)` for the `"30d"` range cutoff string. `toISOString()` returns UTC, while the date fields (`m.Dato`) are stored as local-calendar dates. Near midnight, a user in a UTC+ timezone would see `toISOString()` return the previous day's date, causing an off-by-one that excluded or included wrong matches.

`client/src/pages/MatchFormPage.tsx` used `new Date().toISOString().slice(0,10)` to prefill the form's `Dato` field, which could mismatch the local `Tid` prefill (which is always local time).

### Changes

**`client/src/stats/dateRange.ts`**
- Added exported `ymd(d: Date): string` helper that constructs `YYYY-MM-DD` from local `getFullYear()` / `getMonth()` / `getDate()`
- Replaced `cutoff.toISOString().slice(0,10)` and `now.toISOString().slice(0,10)` with `ymd(cutoff)` and `ymd(now)`

**`client/src/pages/MatchFormPage.tsx`**
- Imported `ymd` from `../stats/dateRange`
- Replaced `new Date().toISOString().slice(0,10)` with `ymd(new Date())` for the `today` prefill

---

## Test Results

### Backend (`npm test` at repo root)
- Test files: **11 passed**
- Tests: **42 passed**

### Client (`cd client && npm test`)
- Test files: **12 passed**
- Tests: **26 passed**

The `filterByRange` noon fixture (`2026-07-11T12:00:00`) is unaffected by the `ymd` change — at noon, UTC and local dates are identical for any timezone within ±12 hours, so no assertions shifted.
