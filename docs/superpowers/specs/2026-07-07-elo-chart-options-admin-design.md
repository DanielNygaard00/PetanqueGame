# Design: Elo History Chart + Option Management

Date: 2026-07-07
Status: Approved

## Overview

- **Elo history chart:** a "Elo over tid" dashboard section charting the selected player's rating over their games.
- **Option management:** rename (with cascade) and delete for arenas and drink options, on a new `/options` page. This is the first feature in the series with backend changes.

## Backend (`src/options.ts`)

Collection → historical-text column mapping:

| collection | table.column |
|---|---|
| `arenas` | `matches.Arena` |
| `drink_types` | `match_drinks.drink_type` |
| `drink_categories` | `match_drinks.drink_category` |
| `drink_brands` | `match_drinks.drink_brand` |
| `drink_names` | `match_drinks.drink_name` |

Unmapped collections behave as before with `uses: 0` and no cascade.

- **`GET /api/options/:collection`** — each row gains `uses`: the count of rows in the mapped column equal to the option's name. Additive change; existing consumers read `id`/`name` only.
- **`PATCH /api/options/:collection/:id`** with `{ name }`:
  - 400 when the trimmed name is empty; 404 when the id does not exist in that collection.
  - Case-insensitive collision with a DIFFERENT option in the same collection = merge (same semantics as player rename): cascade the old text to the surviving option's name, delete the renamed row, return the survivor `{ id, name }`.
  - Otherwise: update the option's name and cascade — `UPDATE <table> SET <column> = ? WHERE <column> = ?` (new, old) — in a `DB.batch` with the option update.
- **`DELETE /api/options/:collection/:id`** — 404 unknown id; deletes the option row only. Historical matches keep their text; the option merely leaves dropdowns. Returns `{ ok: true }`.

## Client hooks and types

- `Option` type gains `uses?: number` (`client/src/api/types.ts`).
- New hooks in `client/src/api/hooks.ts`:
  - `useRenameOption(collection)` — `mutationFn({ id, name })` → `api.patch(/options/${collection}/${id}, { name })`; invalidates `["options", collection]` and `["matches"]` (cascade changes match data).
  - `useDeleteOption(collection)` — `mutationFn(id)` → `api.delete(/options/${collection}/${id})`; invalidates `["options", collection]`.

## Options page (`client/src/pages/OptionsPage.tsx`, route `/options`)

- Title "Indstillinger". Five collection sections with Danish headings: Arenaer (`arenas`), Drikketyper (`drink_types`), Kategorier (`drink_categories`), Mærker (`drink_brands`), Navne (`drink_names`).
- Each section is a Card listing options: name, muted usage line ("bruges i N kampe" / "bruges ikke"), and two actions:
  - **Rediger:** swaps the row to an inline input + Gem/Annuller (same interaction pattern as RosterPage player rename).
  - **Slet:** `confirm()` dialog including the usage count: `Slet "<name>"? Bruges i <N> kampe — kampene beholder teksten.` then deletes.
- Empty collection → muted "Ingen endnu" line. Loading → `SkeletonCards`.
- Entry point: ghost button "Indstillinger" with lucide `Settings` icon in the RosterPage header row.

## Elo history chart (dashboard)

- New export in `client/src/stats/elo.ts`:
  ```ts
  export type EloPoint = { game: number; elo: number; dato?: string };
  export function eloTimeline(matches: Match[], player: string): EloPoint[];
  ```
  Replays the same eligible-match ordering as `computeEloWithHistory` (sorted by `Dato`+`Tid`), accumulating the player's per-match deltas from base 1000. One point per match the player was rated in; `dato` is the match's `Dato`.
- Dashboard section "Elo over tid" placed directly after the "Point over tid" card: recharts `LineChart` (x = `game`, y = `elo`, terracotta line, dot, tooltip showing `dato` and rating; y-axis `domain={["auto", "auto"]}`).
- Computed from the FULL match list (`data`), not the date-range-scoped slice — Elo is cumulative and a range-sliced rating would mislead. Renders only when the timeline has ≥ 2 points.

## Error handling

- Backend PATCH/DELETE guard 404/400 as above; cascade statements are batched so option row and historical text stay consistent.
- Client mutations surface failures via the existing mutation-error patterns (no optimistic updates); the page re-renders from invalidated queries.
- `eloTimeline` for an unknown player returns `[]` (section hidden).

## Testing

- Backend (`test/options.test.ts`, existing Workers-pool suite): usage counts in GET; PATCH renames + cascades into `matches.Arena` and `match_drinks.drink_type`; PATCH merge on case-insensitive collision; PATCH 404/400; DELETE removes option, keeps match text, 404 unknown.
- Client: `eloTimeline` unit tests (base start, cumulative deltas, ordering, unknown player); `OptionsPage` tests (renders sections + usage, rename flow calls PATCH, delete flow calls DELETE after confirm — `vi.spyOn(window, "confirm")`); RosterPage header link assertion.
