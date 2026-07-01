# Frontend Task 1 Report — Scaffold Vite+React+Tailwind

## Summary

Scaffolded the Vite + React + TypeScript client in `client/` with Tailwind v3, apéro design tokens, Google Fonts (Fraunces + Inter), and a paper-grain background.

## Commands Run

### 1. Attempted in-place scaffold (failed — dist/ blocks create-vite)

```
cd /Users/danielnygaard/Developer/PetanqueGame/client
npm create vite@latest . -- --template react-ts
# → Operation cancelled (dist/ directory conflict)
```

### 2. Scaffold in temp dir, copy to client/

```
cd /tmp && npm create vite@latest petanque-client-scaffold -- --template react-ts
cp -r /tmp/petanque-client-scaffold/. /Users/danielnygaard/Developer/PetanqueGame/client/
```

`client/dist/.gitkeep` confirmed present after copy.

### 3. Install base deps

```
cd client && npm install
# → added 27 packages
```

### 4. Install runtime deps

```
npm install react-router-dom @tanstack/react-query axios react-hook-form zod @hookform/resolvers recharts
# → added 76 packages
```

### 5. Install dev deps (Tailwind v3 explicit)

```
npm install -D tailwindcss@^3.4.17 postcss autoprefixer vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw
# → added 208 packages
```

### 6. Init Tailwind

```
npx tailwindcss init -p --ts
# → Created tailwind.config.ts, postcss.config.js
```

### 7. Production build (verification)

```
npx vite build
# → ✓ 16 modules transformed. 0 errors.
# dist/assets/index-*.css   4.28 kB (gzip: 1.64 kB)
# dist/assets/index-*.js  190.49 kB (gzip: 60.01 kB)
# built in 1.26s
```

## Tailwind Version Installed

`tailwindcss@3.4.19` — Tailwind v3 syntax confirmed (`@tailwind base/components/utilities` + `tailwind.config.ts` with `theme.extend`).

## client/dist Survival

- Before scaffold: `client/dist/.gitkeep` existed.
- After copy from temp dir: `.gitkeep` survived (no conflict).
- After `npx vite build`: Vite emptied `dist/` (expected — Vite clears dist on each build). `.gitkeep` restored manually (`touch client/dist/.gitkeep`).
- **Note:** Future builds will erase `.gitkeep`. This is Vite's default behavior (`build.emptyOutDir: true`). If the Worker needs `.gitkeep` to be permanent, set `build.emptyOutDir: false` in `vite.config.ts` or add it to `.gitignore` under `!client/dist/.gitkeep`.

## Files Changed / Created

| File | Action |
|------|--------|
| `client/package.json` | Created by create-vite, deps added |
| `client/package-lock.json` | Created |
| `client/vite.config.ts` | Created, then replaced with brief's exact config (proxy + test env) |
| `client/tailwind.config.ts` | Created by init, then replaced with apéro tokens |
| `client/postcss.config.js` | Created by init (unchanged — correct) |
| `client/tsconfig.json` | Created by create-vite |
| `client/tsconfig.app.json` | Created by create-vite |
| `client/tsconfig.node.json` | Created by create-vite |
| `client/index.html` | Created by create-vite |
| `client/src/main.tsx` | Created by create-vite (unchanged — imports index.css + App.tsx correctly) |
| `client/src/App.tsx` | Replaced with brief's minimal terracotta heading |
| `client/src/index.css` | Replaced with Google Fonts import + Tailwind directives + base layer |
| `client/src/test/setup.ts` | Created: `import "@testing-library/jest-dom"` |
| `client/.gitignore` | Created by create-vite |
| `client/public/` | Created by create-vite |

## Self-Review

- All brief's exact file contents used verbatim (vite.config.ts, tailwind.config.ts, index.css, App.tsx, setup.ts).
- Tailwind v3 confirmed (`3.4.19`), not v4.
- `npx tailwindcss init -p --ts` worked correctly — confirms v3.
- Build succeeded cleanly, 0 errors, CSS and JS output present.
- Dev proxy configured: `/api` → `http://localhost:8787`.
- Test environment configured: jsdom + vitest globals + setup file.
- All 7 custom color tokens present: terracotta, olive, cream, ink, steel, bordeaux, gold.
- Font families `font-display` (Fraunces) and `font-sans` (Inter) configured.
- Paper-grain background via `radial-gradient` in `@layer base`.

## Concerns

1. **`dist/.gitkeep` erased on each build.** Vite clears `dist/` by default. The `.gitkeep` won't survive production builds. If the Worker's `assets` binding requires it to exist in git before first build, consider adding `build.emptyOutDir: false` to `vite.config.ts` or restructuring the `.gitkeep` approach.
2. **`src/App.css` and `src/assets/` not committed.** Left as untracked (scaffolded by create-vite, not referenced by brief's `App.tsx`). Not a problem — they're in `.gitignore`-compatible state.
3. **msw postinstall script skipped** (allowScripts not configured). MSW mock service worker setup won't run automatically — but this only affects the `msw init` step for browser mocking, not test-environment usage. No impact on Task 1.

## Commit

`332a69b feat(client): scaffold Vite+React+Tailwind with apéro design tokens`

---

## Fix: scaffold follow-ups

### What changed

| File | Change |
|------|--------|
| `client/.gitignore` | Replaced bare `dist` line with `dist/*` + `!dist/.gitkeep` so the directory is kept while its contents are ignored |
| `client/vite.config.ts` | Changed `defineConfig` import from `"vite"` to `"vitest/config"` (types the `test` block); added `build: { emptyOutDir: false }` sibling to `plugins`/`server`/`test` |
| `client/index.html` | Set `<title>` to `Pétanque · Apéro` (was scaffold placeholder `petanque-client-scaffold`) |
| `client/package.json` | Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts |

### Build output (`npx vite build`)

```
vite v8.1.2 building client environment for production...
✓ 16 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.31 kB
dist/assets/index-*.css           4.28 kB │ gzip:  1.64 kB
dist/assets/index-*.js          190.49 kB │ gzip: 60.01 kB
✓ built in 3.18s
```

### `client/dist/.gitkeep` after build

File present. `git status` shows no deleted-`.gitkeep` entry — the `emptyOutDir: false` fix prevents Vite from wiping the directory before writing new output.

### Vitest run

```
No test files found, exiting with code 1
```

Exit code 1 due to no test files — this is a vitest default. Not a config error; the config loads correctly.

### Concerns

1. **Vitest exits non-zero when no test files exist.** vitest v4 has no `--passWithNoTests` flag equivalent that's stable; consider adding `passWithNoTests: true` to the `test` block in `vite.config.ts` once the first test file is created, to keep CI green in the interim.
2. No other concerns — all four fixes applied cleanly.
