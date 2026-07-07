# Design: Rivalry Pages + Match Predictions

Date: 2026-07-07
Status: Approved

## Overview

Two client-side features, no backend changes:

- **Rivalry pages:** a head-to-head deep dive between two players at `/rivalry/:a/:b` — record, streak, Elo comparison, a cumulative wins-difference chart, and the full meeting list. Linked from the dashboard head-to-head table, match detail player names, and rankings rows.
- **Match predictions:** an Elo-based win-probability bar in the new-match form once both teams have players.

## Rivalry engine (`client/src/stats/rivalry.ts`)

```ts
export type Rivalry = {
  a: string;
  b: string;
  games: number;
  aWins: number;
  bWins: number;
  avgMarginA: number;                                   // mean score margin from a's perspective
  streak: { player: string; count: number } | null;     // current run of consecutive wins, newest backwards
  meetings: Match[];                                    // newest first (input order preserved)
  series: { game: number; diff: number }[];             // cumulative aWins - bWins, oldest -> newest
};

export function computeRivalry(matches: Match[], a: string, b: string): Rivalry
```

- A meeting is a match where `matchPerspective(matches, a)` resolves, `b` is in `p.opponents`, and `p.won !== null` (only decided matches count — same rule as `headToHead`).
- Input arrives newest-first (API order); `meetings` preserves that. `series` is computed oldest → newest so the chart reads left to right chronologically.
- `streak` walks meetings from newest backwards while the same player keeps winning; null when there are no meetings.
- `avgMarginA` averages `myScore - oppScore` from a's perspective over meetings where both scores are present.

## Prediction engine (`client/src/stats/predict.ts`)

```ts
export function winProbability(matches: Match[], teamA: string[], teamB: string[]): number | null
```

- Returns the Elo expectation that team A beats team B: `1 / (1 + 10^((rB - rA) / 400))` where `rX` is the average current Elo of the team's players.
- Player ratings come from `computeElo(matches)`; players with no rating (new names) count as the base 1000.
- Returns null when either team has no players.

## Rivalry page (`client/src/pages/RivalryPage.tsx`, route `/rivalry/:a/:b`)

- Route registered inside the authenticated layout; `:a`/`:b` are URL-encoded player names, decoded with `decodeURIComponent`.
- Loading → `SkeletonCards`; no meetings → `EmptyState` 🤝 "Ingen indbyrdes kampe endnu" with hint "Spil en kamp mod hinanden for at starte rivaliseringen." (no CTA).
- Content, top to bottom:
  - Header "A mod B" (font-display) with the record big: "5–3" (a's wins first).
  - Streak + margin line: "A har vundet de sidste 3 · gns. margin +2,4" (margin from a's perspective, Danish decimal comma, signed).
  - Elo comparison card: both players' current Elo side by side with the difference between them ("+24" on the leader's side, using `EloDeltaChip` tones).
  - Recharts `LineChart` of `series` (`diff` over `game`), with a zero `ReferenceLine`; above zero = A leads. Height ~200, `ResponsiveContainer`.
  - Meeting list: `MatchCard` per meeting (no `eloDelta` prop).

## Entry points (all viewer-relative: `/rivalry/<viewer>/<other>`, names URL-encoded)

- **DashboardPage** head-to-head: opponent cell (desktop table) and opponent title (mobile card) become `Link`s to the rivalry with the currently selected dashboard player as viewer.
- **MatchDetailPage:** player names in team cards other than the logged-in user become `Link`s (`text-terracotta` on hover); the viewer's own name stays plain text.
- **RankingsPage:** player names in the desktop table and mobile list become `Link`s for names other than the logged-in user. Podium cards stay plain (visual cleanliness).

## Prediction in the match form (`client/src/pages/MatchFormPage.tsx`)

- New component `client/src/components/PredictionBar.tsx`: `{ probA: number; labelA: string; labelB: string }` — a split horizontal bar (terracotta for A, steel for B), each side showing team label and rounded percentage. Heading "Forudsigelse".
- Shown only when: creating (`!id`), exactly 2 teams, both teams have ≥1 player. Probability from `winProbability(matches, teams[0].players, teams[1].players)`; hidden when it returns null.
- Team labels are the joined player names ("Ida + Ann").

## Error handling

- Unknown player names in the URL simply produce zero meetings → empty state (no crash).
- `decodeURIComponent` failures are impossible for names produced by `encodeURIComponent`; route params are used as-is after decoding.
- Chart renders only when `series.length >= 2` (a single point draws no meaningful line).

## Testing

Vitest, existing patterns (`vi.spyOn(api, "get")`, MemoryRouter):
- `computeRivalry`: counts only opposing decided meetings; record and margin; streak newest-backwards; series cumulative ordering; empty result for strangers.
- `winProbability`: 0.5 for equal ratings, >0.5 for the stronger team, base-1000 fallback for unknown names, null for empty teams.
- `RivalryPage`: renders record, streak, meetings; empty state for no meetings.
- `PredictionBar`: renders labels and percentages.
- `MatchFormPage`: prediction appears for a new match with two filled teams (extends existing behavior without breaking the draft tests).
