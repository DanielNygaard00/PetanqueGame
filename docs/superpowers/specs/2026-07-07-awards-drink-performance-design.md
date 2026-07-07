# Design: Awards Page + Drink-Type Performance

Date: 2026-07-07
Status: Approved

## Overview

Two client-side features, no backend changes:

- **Awards page** at `/awards`: nine auto-derived superlatives over a selectable period (calendar month / calendar year / all time), linked from the rankings page.
- **Drink-type performance:** a "Drikke & præstation" dashboard section showing the selected player's win rate per drink type.

## Awards engine (`client/src/stats/awards.ts`)

```ts
export type AwardPeriod = "month" | "year" | "all";
export function filterByPeriod(matches: Match[], period: AwardPeriod, now: Date): Match[];

export type Award = { key: string; emoji: string; title: string; winner: string; detail: string };
export function computeAwards(periodMatches: Match[], allMatches: Match[]): Award[];
```

- `filterByPeriod` matches on the `Dato` prefix: month = `YYYY-MM` of `now`, year = `YYYY`, all = everything. Matches without `Dato` only appear in `all`.
- `computeAwards` receives the period slice for winner selection and the full match list for Elo context (`computeEloWithHistory(allMatches)` — per-match deltas are summed only over period matches). Minimum-games threshold `MIN = 3` throughout. An award with no qualifying winner is omitted from the result.
- Only decided matches count for win-rate awards (same rule as `headToHead`: `matchPerspective(...).won !== null`).

The nine awards, in output order:

1. `player` 🏅 **Periodens spiller** — best win rate, min 3 decided games; tiebreak: more games, then name (locale compare) for determinism. Detail: "67% sejre i 6 kampe".
2. `improved` 📈 **Mest forbedret** — biggest positive sum of per-match Elo deltas over period matches. Omitted if no player has a positive sum. Detail: "+34 Elo".
3. `upset` 💥 **Største upset** — biggest single-match Elo gain in the period (min +13, i.e. strictly more than the even-match K/2 = 12, so only genuine underdog wins qualify). Detail: "+18 Elo i én kamp".
4. `streak` 🔥 **Sejrsstime** — longest run of consecutive wins within the period (per player, over their decided period matches in chronological order), min 3. Detail: "5 sejre i træk".
5. `thirst` 🍺 **Tørstigst** — most attributed drink units, min 1 unit. Detail: "23 genstande".
6. `tipsy` 🥴 **Bedst på promille** — best win rate in matches where the player logged 3+ own units, min 3 such decided matches. Detail: "75% sejre med 3+ genstande".
7. `arena` 🏟️ **Banekonge** — at the period's most-played arena (most matches with `Arena` set; ties broken by name), the player with the best win rate there, min 3 decided games at that arena. Detail: "80% sejre på Fælledparken".
8. `wooden` 🥄 **Træskallen** — worst win rate, min 3 decided games; tiebreak: more games, then name. Detail: "20% sejre i 5 kampe".
9. `cold` 🧊 **Kold tørn** — longest run of consecutive losses within the period, min 3. Detail: "4 nederlag i træk".

## Awards page (`client/src/pages/AwardsPage.tsx`, route `/awards`)

- Header "Priser" (font-display) + period toggle of three ghost/filled buttons: "Måned" (default), "År", "Altid" — visually consistent with the dashboard's range filter buttons.
- Loading → `SkeletonCards`.
- Zero awards for the period → `EmptyState` 🏆 "Ikke nok kampe i perioden endnu" hint "Der skal mindst 3 kampe til en pris.".
- Otherwise a responsive grid (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`) of award cards: big emoji, title, winner name (font-display, terracotta), muted detail line.
- Entry point: ghost button "Priser" with lucide `Award` icon in the RankingsPage header row (flex row with the existing `<h2>`).

## Drink-type performance (`client/src/stats/drinkPerformance.ts` + dashboard section)

```ts
export type TypePerf = { type: string; games: number; wins: number; winRate: number };
export function winRateByDrinkType(matches: Match[], player: string): TypePerf[];
```

- Per decided match the player participated in: collect the distinct `type` values of the player's own attributed drinks (`d.player === player`); the match counts once under each distinct type. A match where the player logged no drinks counts under the bucket "Ingen".
- Drinks without a `type` fall under "Andet".
- Result sorted by games descending.

Dashboard: new section card "Drikke & præstation" for the selected player, rendered after the existing sober/tipsy chart. Recharts `BarChart` of `winRate` per type filtered to `games >= 2`, terracotta bars, `Tooltip` showing win rate and games. The section renders only when at least one type passes the filter. (The drink-count curve already exists as the sober/tipsy chart and is not duplicated.)

## Error handling

- All engines are pure over already-fetched data; no new failure modes. Missing `Dato`, missing `Arena`, unattributed drinks, and undecided matches are excluded per the rules above rather than crashing.

## Testing

Vitest, existing patterns:
- `filterByPeriod`: month boundary, year, all (dateless matches only in all).
- `computeAwards`: each award's winner on a crafted fixture; MIN thresholds (award omitted below threshold); upset floor (+13); deterministic tiebreaks.
- `winRateByDrinkType`: multi-type counting, "Ingen" and "Andet" buckets, decided-only.
- `AwardsPage`: renders award cards, toggle switches period, empty state.
- `RankingsPage`: header link to `/awards` exists.
