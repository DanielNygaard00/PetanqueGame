# Pétanque Game — Backend Rewrite + Frontend Visual Boost

**Date:** 2026-07-01
**Status:** Approved design

## Summary

PétanqueGame is a small social app used by a handful of friends to log pétanque
matches — and, distinctively, what everyone drank during each match. The current
repository contains a backend only: an Express + TypeScript API backed by Firebase
Firestore, with JWT authentication. There is no frontend in the repository, even
though the server is wired to serve a React SPA from a `client/dist` directory that
does not exist.

This project does two things:

1. **Rewrites the backend** from Express + Firestore to **Hono running on Cloudflare
   Workers, backed by Cloudflare D1 (SQLite)**. This removes all Firebase credential
   and setup friction, lets the app run locally with zero credentials, and hosts for
   free.
2. **Builds a new frontend** — a Vite + React + TypeScript + Tailwind single-page app
   with a deliberate "French apéro / terrace" visual identity. This is the "visual
   boost."

Both are deployed as a **single Cloudflare Worker** that serves the API under `/api/*`
and the SPA for every other route, and both host on Cloudflare's free tier.

## Goals

- Remove Firebase; make the app runnable locally with no credentials.
- Host the whole application for free, with persistent data and no meaningful cold
  starts.
- Preserve the existing API contract and CSV export format exactly.
- Give the app a polished, characterful visual design befitting a pétanque-and-drinks
  club app.

## Non-goals

- Multi-tenant accounts, roles, or password-reset flows. It is a friends' app; the
  existing low-friction auth (optional email, empty passwords allowed) is retained.
- Real-time/live features.
- Migrating any existing Firestore data. The D1 database starts empty.

## Architecture

### Runtime

A single Cloudflare Worker handles everything:

- Requests to `/api/*` are routed through a Hono application.
- All other requests are served from the SPA static assets (`client/dist`) via the
  Worker `assets` binding, with single-page-app fallback so client-side routes resolve
  to `index.html`.

This mirrors the current single-service model (Express served both the API and the
SPA) while running entirely on Cloudflare's free tier.

### Backend (Hono on Workers)

- **Framework:** Hono. Its built-in `cors()` and `logger()` middleware replace the
  current `cors`/`morgan`; `helmet` is dropped (limited relevance on Workers).
- **Auth:** `hono/jwt` middleware replaces `jsonwebtoken` plus the hand-written
  `authenticateToken` middleware. Tokens carry `{ userId, username }` and expire in
  24 hours, matching current behavior.
- **Password hashing:** `bcryptjs` (pure JavaScript, Workers-compatible) replaces the
  native `bcrypt`. The empty-password-allowed behavior is preserved.
- **Database:** Cloudflare D1 (SQLite), accessed via `c.env.DB` using prepared
  statements.
- **CSV export:** the `csv-stringify` dependency (Node-oriented) is replaced with a
  small hand-rolled CSV writer that preserves the UTF-8 BOM and the exact Danish
  column headers used today.

### API contract (unchanged)

All routes, request shapes, and response shapes are preserved so the CSV export and
the frontend speak the same language as before:

- `POST /api/auth/signup` — `{ username, password?, email? }` → `{ token, user }`
- `POST /api/auth/login` — `{ username, password? }` → `{ token, user }`
- `GET  /api/users` (auth) → `[{ id, name }]`
- `POST /api/matches` (auth) — create; body is the match payload with Danish keys
- `GET  /api/matches` (auth) → matches, newest first by `Dato`
- `PUT  /api/matches/:id` (auth) — update
- `DELETE /api/matches/:id` (auth) — delete
- `GET  /api/export` (auth) → `text/csv` with the fixed Danish column order
- `GET  /api/options/:collection` (auth) → `[{ id, name, ... }]`
- `POST /api/options/:collection` (auth) — add an option
- `GET  /api/options/drinks/hierarchy` (auth) → `{ types, categories, brands, names }`

The API continues to accept and return the Danish field keys. Internally these map to
clean snake_case columns; the mapping is applied at the controller boundary so the
wire contract and CSV headers stay byte-identical.

### Data model (D1 / SQLite)

Three tables replace the Firestore collections.

**`users`**

| column | type | notes |
| --- | --- | --- |
| id | TEXT PRIMARY KEY | UUID |
| username | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | bcryptjs hash of possibly-empty password |
| email | TEXT | empty string when not provided |
| created_at | TEXT NOT NULL | ISO 8601 |

**`matches`** — typed columns (not a JSON blob) so the stats dashboard can query
directly. Danish API key → column mapping:

| API key (Danish) | column |
| --- | --- |
| — | id (TEXT PK, UUID) |
| — | created_by (TEXT, FK users.id) |
| — | created_at / updated_at (TEXT ISO) |
| Dato | date |
| Gruppe_Bool | is_group (INTEGER 0/1) |
| Gruppe_medlemmer | group_members (TEXT) |
| Konsekutive spil | consecutive_games (INTEGER) |
| Spiller | player (TEXT) |
| Arena | arena (TEXT) |
| Modstander | opponent (TEXT) |
| Vundet | won (INTEGER 0/1) |
| Point | points (INTEGER) |
| Drik_Type | drink_type (TEXT) |
| Drik_Kategori | drink_category (TEXT) |
| Drik_Brand | drink_brand (TEXT) |
| Drik_Land | drink_country (TEXT) |
| Drik_Navn | drink_name (TEXT) |
| Vin_Region | wine_region (TEXT) |
| Spillets genstande | game_items (TEXT) |

**`options`** — backs the generic option endpoints and the drink hierarchy.

| column | type | notes |
| --- | --- | --- |
| id | TEXT PRIMARY KEY | UUID |
| collection | TEXT NOT NULL | e.g. `players`, `arenas`, `drink_types`, `drink_categories`, `drink_brands`, `drink_names`, `wine_regions` |
| name | TEXT NOT NULL | |
| created_at | TEXT NOT NULL | ISO 8601 |

`GET /api/options/drinks/hierarchy` reads the four `drink_*` collections and returns
them under `types`/`categories`/`brands`/`names`, matching today's flat shape.

### Frontend (Vite + React + TS + Tailwind)

**Aesthetic — "French apéro / terrace":**

- **Palette:** terracotta `#C65D3B` (primary), olive `#6B7A4F`, cream/parchment
  `#F5EFE1` (background), charcoal ink `#2B2622` (text), boule-steel `#8A8D91`,
  bordeaux `#7B2D3B` (drinks/wine accents), amber-gold `#D9A441` (wins/streaks).
- **Type:** Fraunces (serif display, headings) + Inter (body) — a café-menu feel.
- **Texture:** subtle paper/gravel grain background, soft shadows, medium-rounded
  cards. Boule iconography, score pills, streak markers, per-drink country accents.

**Stack & structure:**

- React Router with routes: `/login`, `/signup`, `/` (dashboard), `/matches`,
  `/matches/new`, `/matches/:id/edit`.
- Auth: JWT stored in `localStorage`, exposed through an `AuthContext`; an axios
  instance attaches the `Bearer` token via interceptor and redirects to `/login` on
  `401`/`403`.
- Data fetching: TanStack Query for caching matches, options, and the drink hierarchy,
  with mutation-driven cache invalidation.
- Forms: react-hook-form with zod validation.
- Charts: Recharts.
- A small reusable UI kit: Button, Card, Input, Select, **SelectOrAdd** (choose an
  existing value or type a new one — for player/arena/opponent/drinks), Badge
  (win/loss/group/streak), StatCard, and chart wrappers.

**Screens:**

- **Login / Signup:** split layout — an apéro/boules hero panel beside the form.
- **Dashboard (`/`):** stat cards (win-rate donut, total points, longest streak,
  matches played), a points-over-time line chart, top arenas, most-logged drinks,
  recent matches, a prominent "Log match" call to action, and CSV export.
- **Matches (`/matches`):** a filterable list of menu-card rows (filter by
  player/arena/won/group), each showing a drink chip.
- **Match form (new/edit):** date, player, arena, opponent (SelectOrAdd), win toggle,
  points, group toggle → group members, consecutive-games, a cascading drink picker
  (type → category → brand → name, plus wine region when the drink is wine), and
  "Spillets genstande" (game items).

## Deployment & local development (all free)

- **Deploy:** `wrangler deploy` ships the single Worker (API + SPA assets). D1 is
  created with `wrangler d1 create` and schema applied via SQL migrations under
  `migrations/`.
- **Local:** `wrangler dev` runs the Worker with a local SQLite D1 — no credentials
  needed. The Vite dev server on `:5173` proxies `/api` to the Worker on `:8787` for
  fast frontend iteration. Migrations apply locally with
  `wrangler d1 migrations apply <db> --local`.

## Repo shape

- `src/` becomes the Hono Worker entry and modules.
- Add `wrangler.toml`, `schema.sql` / `migrations/`, and a `client/` directory for the
  Vite app.
- **Remove** dependencies: `express`, `cors`, `helmet`, `morgan`, `firebase-admin`,
  `jsonwebtoken`, `bcrypt`, `csv-stringify`, `dotenv`.
- **Add** dependencies: `hono`, `bcryptjs` (+ types); dev: `wrangler`,
  `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`.

## Testing

- **Worker:** Vitest with `@cloudflare/vitest-pool-workers` (tests run in the workerd
  runtime against a real D1 instance). Cover signup/login, the JWT guard on protected
  routes, matches CRUD, options add/list, the drink hierarchy, and CSV export
  (headers, BOM, column order).
- **Client:** Vitest + React Testing Library, with MSW mocking the API. Cover the
  SelectOrAdd component, the cascading drink-picker logic, form/zod validation, the
  auth flow, and the axios `401` redirect.
- Development follows test-driven development throughout.

## Risks & mitigations

- **Workers runtime differences:** native modules do not run on Workers. Mitigated by
  choosing pure-JS/Workers-compatible replacements (`bcryptjs`, hand-rolled CSV) up
  front.
- **D1 write limits on the free tier:** far above a friends' app's usage; not a
  practical concern.
- **No data migration:** the D1 database starts empty by design; there is no existing
  production data to preserve.
