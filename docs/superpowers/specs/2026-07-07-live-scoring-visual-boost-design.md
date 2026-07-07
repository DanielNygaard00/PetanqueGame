# Design: Live Scoring Mode + Visual Boost

Date: 2026-07-07
Status: Approved

## Overview

Two approved workstreams, client-side only (no backend or schema changes):

- **Part A — Live scoring:** a phone-first scoreboard at `/live` that records a pétanque match end by end (mène by mène), survives refresh via localStorage, auto-finishes at the target score, and saves through the existing match API.
- **Part B — Visual boost:** icons and nav polish, a rankings podium, reusable empty states and skeleton loaders, and month grouping in the match list.

## Part A — Live scoring

### Architecture

One route, one page, three phases. `LiveMatchPage` at `/live` renders one of three phases from a single state object: `setup → playing → finished`. The state lives in localStorage (key `liveMatch:v1`) so the session survives refresh and app kill at the pitch. All game logic is pure functions in `client/src/live/liveMatch.ts`; the page is a thin view over them.

### Engine (`client/src/live/liveMatch.ts`)

```ts
type LiveTeam = { players: string[]; points: number };
type LiveEnd = { team: 0 | 1; points: number };            // points 1–6
type LiveState = {
  status: "setup" | "playing" | "finished";
  startedAt: string;                                        // ISO datetime, set when play starts
  arena?: string;
  target: number;                                           // default 13
  teams: [LiveTeam, LiveTeam];                              // exactly 2 teams
  ends: LiveEnd[];
};
```

Pure functions:
- `initialLiveState(): LiveState` — setup status, empty teams, target 13.
- `startMatch(state, now: string): LiveState` — validates (≥1 player per team, no duplicate players across teams, target ≥ 1); flips to `playing`, stamps `startedAt`. Throws on invalid input (the page validates first and shows Danish error copy).
- `scoreEnd(state, team, points): LiveState` — appends an end (points clamped to 1–6), recomputes team points from `ends`, flips to `finished` when a team reaches `target`. No-op if not `playing`.
- `undoEnd(state): LiveState` — removes the last end and recomputes; a `finished` state returns to `playing` (this is also the "Fortsæt" action). No-op with no ends.
- `winnerIndex(state): 0 | 1 | null` — leading team when `finished`, else null.
- `toMatchInput(state): MatchInput` — maps to the existing API type: `Dato`/`Tid` from `startedAt` (local date and HH:MM), `Arena`, `teams: [{ score, players }]`. End history is deliberately NOT persisted — the schema is unchanged; only final scores survive.

Team points are always derived from `ends` (single source of truth), never incremented separately.

### Page (`client/src/pages/LiveMatchPage.tsx`)

- **Persistence:** reuses `useFormDraft` with key `liveMatch:v1`, `enabled: true`, `hasSubstance: (s) => s.status !== "setup"` — an untouched setup screen never persists; any started match always does. Restore is silent (resumes the session).
- **Setup phase:** two team panels with chip-based add/remove of players (same visual pattern as TeamsEditor, but no score inputs and fixed at 2 teams), player options from `usePlayers` with `useAddPlayer` for new names, arena via `SelectOrAdd` (options `arenas`, prefilled from the latest match like MatchFormPage), target-score number input defaulting to 13. "Start kamp" validates and shows Danish errors ("Hvert hold skal have mindst én spiller", "En spiller kan ikke være på begge hold").
- **Playing phase:** two large tap-friendly team panels showing running scores. Tapping a panel reveals point chips 1–6 for that mène; tapping a chip records the end. Below: end history strip ("Runde 3 · Hold 1 +2"), "Fortryd" (undo last end), "Afslut" (manual finish before target — allowed only when scores are not level). A screen wake lock (`navigator.wakeLock.request("screen")`) is requested while `playing` and released on finish/unmount; all wake-lock calls are wrapped in try/catch (progressive enhancement, no-op where unsupported).
- **Finished phase:** winner banner ("Hold 1 vinder 13–7 · 9 runder"), three actions:
  - "Gem kamp" → `useCreateMatch.mutateAsync(toMatchInput(state))` → clear the live session → navigate to `/matches/{id}/edit` so drinks can be added (create returns the match with `id`).
  - "Fortsæt" → `undoEnd` (handles the fat-fingered final end).
  - "Kassér" → inline confirm ("Sikker?"), then clear session and return to setup.
  - Save failure keeps the session intact and shows the error; nothing is cleared until the POST succeeds.
- **Entry point:** "Start live kamp" button on MatchesPage next to the CSV export. Route `/live` registered inside the authenticated layout.

### Error handling

- localStorage unavailability degrades to in-memory play (useFormDraft already swallows storage errors).
- A malformed stored session is discarded by useFormDraft's JSON guard.
- Manual "Afslut" with level scores is blocked with "Uafgjort — spil en runde mere eller fortryd" (the matches API derives `won` from scores; a deliberate tie can still be logged via the normal form).

## Part B — Visual boost

### B1. Icons + nav polish

- Add dependency `lucide-react`.
- `Layout.tsx`: the NAV array gains an `icon` per entry — Home (Oversigt), List (Kampe), CirclePlus (Log), Trophy (Rangliste), Users (Spillere). Bottom nav shows icon above label; active tab is terracotta with `strokeWidth={2.5}`, inactive `text-ink/60`. Desktop nav shows icon beside label.
- MatchesPage "Start live kamp" button gets a Play icon; "Eksportér CSV" gets Download.

### B2. Rankings podium

- `RankingsPage`: when ≥3 rated players, the top 3 render as podium cards in visual order 2–1–3 (grid, middle card raised/larger), with accents gold (#1, theme `gold`), silver (`ink/30`), bronze (`terracotta/60`), medal emoji, big Elo in font-display, name, and games count. The desktop table and the mobile card list below then start at rank 4 (no duplication). With 1–2 rated players, skip the podium and list everyone as today.

### B3. Empty states + skeletons

- New `client/src/ui/EmptyState.tsx`: `{ emoji, title, hint?, cta?: { label, to } }` — centered card with large emoji, font-display title, muted hint, optional Link button. Used on:
  - MatchesPage (no matches at all): 🎯 "Ingen kampe endnu" / "Grib kuglerne og log jeres første kamp." / CTA "Log kamp" → `/matches/new`.
  - MatchesPage (filter yields nothing): 🔍 "Ingen kampe matcher" / "Prøv en anden søgning." (no CTA)
  - RankingsPage (no ratings): 🏆 "Ranglisten er tom" / "Log kampe med point for at se Elo-ratings." / CTA "Log kamp".
- New `client/src/ui/Skeleton.tsx`: `Skeleton` (an `animate-pulse` rounded block, `className` for sizing) and `SkeletonCards({ count })` (a stack of card-shaped skeletons). Replaces every `"Henter…"` on MatchesPage, RankingsPage, MatchDetailPage, and DashboardPage.

### B4. Month grouping in match list

- New pure util `groupMatchesByMonth(matches, username)` in `client/src/stats/monthGroups.ts`: groups by `Dato.slice(0, 7)` (YYYY-MM), preserves the incoming match order within and across groups (list arrives newest-first), returns `{ key, label, matches, wins }[]` where `label` is the Danish month + year ("juni 2026") and `wins` counts matches the given user won (via `matchPerspective`). Matches without `Dato` group under label "Uden dato" (sorted last).
- MatchesPage renders sticky group headers (`sticky top-0`, cream background): "juni 2026 · 8 kampe · 5 sejre" (wins segment only when the user participated in at least one match that month).

## Testing

Vitest, existing patterns:
- **Engine:** startMatch validation, scoreEnd accumulates and clamps, auto-finish at target, undoEnd reopens a finished match, winnerIndex, toMatchInput mapping (date/time split, scores, players).
- **LiveMatchPage:** full flow — setup two teams, start, score to 13, save posts the correct MatchInput and navigates to the edit page (spy on `api.post`); session restore renders playing phase directly.
- **monthGroups:** grouping, Danish labels, wins per user, undated fallback, order preserved.
- **EmptyState / Skeleton / podium:** render tests (podium order and rank-4 table start; empty-state CTA link).
- Existing suites must stay green; MatchesPage loading/empty markup changes are covered by updating any affected assertions.
