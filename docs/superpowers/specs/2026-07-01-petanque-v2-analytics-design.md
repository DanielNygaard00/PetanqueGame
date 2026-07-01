# Pétanque v2 — Analytics: Sessions, Drinks & Performance

**Date:** 2026-07-01
**Status:** Approved design
**Builds on:** `2026-07-01-petanque-rewrite-visual-boost-design.md` (v1 — Hono/Workers/D1 backend + React SPA, now live at petanque.danielnygaard00.workers.dev)

## Summary

v1 logs pétanque matches with a single drink and no quantity. The goal now is real
data analysis: **what** the friends drink, **how much**, and **when they play best**.
This requires capturing data v1 cannot (drink quantity, time of day, opponent score,
multiple drinks per session) and then surfacing the correlations.

Because production holds no data (the D1 database was wiped after deploy) and we own the
only client, the data model and API contract evolve freely — no migration of existing
records is required.

## Goals

- Capture **multiple drinks per session, each with a count** (and optional volume) → answers *what* and *how much*.
- Capture match **time of day** and **opponent score** → answers *when we play* and *how well* (margin, not just win/loss).
- Provide an **insights dashboard**: sober-vs-tipsy win-rate, performance by time/weekday/arena/opponent, consumption over time, per-player comparison.
- Keep **data trustworthy**: normalized option lists, input validation, a per-player analytic key.
- Provide a **tidy long-format CSV** export suited to external analysis (Excel/Sheets/Python).

## Non-goals

- No standard-alcohol-unit ("genstande") computation from ABV — count and optional volume only.
- No accounts-linked player identity graph; the analytic player key is the normalized `Spiller` name.
- No server-side analytics engine — the dataset is tiny; the dashboard aggregates client-side from the matches already fetched.

## Data model (D1)

### `matches` (modified)

Add:

| column | type | notes |
| --- | --- | --- |
| time | TEXT | `HH:MM`, nullable |
| opponent_points | INTEGER | opponent's score; own score stays `points` |

Remove the embedded single-drink columns (drinks move to `match_drinks`):
`drink_type, drink_category, drink_brand, drink_country, drink_name, wine_region`.
`game_items` (Spillets genstande) stays on the match.

### `match_drinks` (new)

One row per drink logged in a match.

| column | type | notes |
| --- | --- | --- |
| id | TEXT PK | UUID |
| match_id | TEXT NOT NULL | FK → matches.id; deleted with the match (app-level cascade) |
| drink_type | TEXT | |
| drink_category | TEXT | |
| drink_brand | TEXT | |
| drink_name | TEXT | |
| drink_country | TEXT | |
| wine_region | TEXT | |
| count | INTEGER NOT NULL DEFAULT 1 | number of units (e.g. 3 beers) |
| volume_cl | REAL | optional cl per unit |
| position | INTEGER NOT NULL DEFAULT 0 | display order within the match |

Index: `match_drinks(match_id)`.

## API (contract evolves)

Match-level Danish keys are retained to minimise frontend churn; drinks are a nested array.

- Match JSON keys: existing (`Dato, Gruppe_Bool, Gruppe_medlemmer, "Konsekutive spil", Spiller, Arena, Modstander, Vundet, Point, "Spillets genstande"`) **plus** `Tid` (time) and `Modstander_Point` (opponent_points), **plus** `drinks`.
- `drinks: [{ type, category, brand, name, country, wineRegion, count, volumeCl }]` — clean English sub-keys; `count` defaults to 1, `volumeCl` optional.
- `POST /api/matches` and `PUT /api/matches/:id`: write the match row, then **replace** its drinks (delete existing for the id, insert the array in `position` order). Respond with the match + nested `drinks`.
- `GET /api/matches`: matches newest-first by date, each with its `drinks` array (ordered by `position`).
- `DELETE /api/matches/:id`: delete the match's drinks, then the match.
- **Validation** (400 on failure): `Dato` required, `Spiller` required, `Point`/`Modstander_Point` integers in `0..50` when present, each drink `count >= 1`.
- **Option normalization**: `POST /api/options/:collection` trims the name and, if a case-insensitive match already exists in that collection, returns the existing option instead of inserting a duplicate.

## Frontend

### Match form (capture)

- A **"Drikkevarer i denne omgang"** list: add/remove drink rows; each row = cascading SelectOrAdd (type→category→brand→name, wine-region when Vin) + a `count` number + optional `volume (cl)`.
- A **time** input (`Tid`) and an **opponent score** input (`Modstander_Point`).
- Client-side mirror of the server validation (required date/player, score ranges, count ≥ 1).

### Insights dashboard

Computed client-side (`deriveStats` v2) from the fetched matches (+drinks):

- **Sober vs. tipsy**: `totalUnits(match) = Σ drink.count`; buckets `0 / 1–2 / 3–4 / 5+`; win-rate and average **margin** (`Point − Modstander_Point`) per bucket.
- Win-rate & avg margin **by time-of-day bucket** (morning/afternoon/evening/night), **weekday**, **arena**, **opponent**.
- **Consumption over time**: units and top drinks per month.
- **Per-player**: comparison table + a **player filter** (analytic key = normalized `Spiller`) applied across the dashboard.

### Data quality

- Normalization handled server-side on option add (above); the form uses the normalized option lists as suggestions.
- Client validation mirrors server rules with inline messages.

## Export (tidy long format)

`GET /api/export` → CSV, one row per **match × drink** (a match with no drinks emits one row with blank drink cells). UTF-8 with BOM, filename `petanque_data.csv`. Columns in order:

`Dato, Tid, Spiller, Arena, Modstander, Vundet, Point, Modstander_Point, Margin, Gruppe_Bool, Gruppe_medlemmer, Konsekutive spil, Spillets genstande, Drik_Type, Drik_Kategori, Drik_Brand, Drik_Land, Drik_Navn, Vin_Region, Antal, Volumen_cl`

Booleans render as `1`/empty (as v1). `Margin = Point − Modstander_Point` when both present, else blank.

## Sequencing

1. **Backend**: migration, drinks-nested CRUD, `Tid`/`Modstander_Point`, validation, option normalization, tidy CSV export.
2. **Frontend**: drinks-list form editor + time/opponent fields; extended `deriveStats`; insights dashboard + player filter.

Each phase ships working and tested. After both, rebuild and redeploy to Cloudflare (prod is empty, so nothing is lost).

## Risks & mitigations

- **Contract change vs. the live site**: acceptable — prod D1 is empty; redeploy replaces the client. No data migration.
- **`match_drinks` orphan rows**: cascade is app-level (delete drinks before/with the match); covered by tests.
- **Client-side aggregation scale**: dataset is a few friends' matches — trivial; no server analytics needed.
- **Free-text player fragmentation**: mitigated by option normalization + normalized analytic key; not a hard accounts linkage.
