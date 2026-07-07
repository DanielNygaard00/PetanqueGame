# Design: Match Detail View, Elo Change Badges, Form Draft Auto-Save

Date: 2026-07-07
Status: Approved

## Overview

Three client-side improvements to the Pétanque tracker, approved after brainstorming:

1. A per-match Elo delta engine (shared foundation).
2. Elo change chips on match cards for the logged-in user.
3. A match detail page at `/matches/:id`.
4. Draft auto-save for the new-match form.

No backend or schema changes are required; everything derives from existing API data.

## 1. Elo engine: per-match deltas

File: `client/src/stats/elo.ts`

- Add exported `computeEloWithHistory(matches, opts)` returning:
  ```ts
  {
    ratings: PlayerRating[];
    deltas: Map<string /* matchId */, Map<string /* playerName */, number /* rounded delta */>>;
  }
  ```
- `computeElo(matches, opts)` becomes a thin wrapper returning `.ratings`, so existing callers and behavior are unchanged.
- Delta semantics: a player's total rounded rating change from that match (sum across pairwise team comparisons). Deltas are zero-sum per pairwise comparison. Match ordering and eligibility rules are identical to the existing implementation (sorted by `Dato` + `Tid`, teams need numeric scores and at least one player, at least two scored teams).
- Matches that produce no rating change (ineligible) simply have no entry in `deltas`.

## 2. Elo chips on MatchCard

Files: `client/src/pages/MatchesPage.tsx`, `client/src/components/MatchCard.tsx`

- `MatchesPage` computes `computeEloWithHistory` once over all matches and passes an optional `eloDelta?: number` prop to each `MatchCard`, set to the logged-in user's delta for that match when the user participated.
- `MatchCard` renders a chip next to the existing Gruppe badge: positive deltas as `+N` in olive, negative as `−N` in bordeaux. The chip is hidden when `eloDelta` is undefined (user not a participant, or match has no scores). A delta of exactly 0 renders as `±0` in the muted ink tone.
- Dashboard recent-matches list is out of scope for chips in this iteration (it reuses MatchCard, so it gains the capability for free if wired later).

## 3. Match detail page: `/matches/:id`

Files: new `client/src/pages/MatchDetailPage.tsx`, `client/src/App.tsx`, `client/src/components/MatchCard.tsx`

- New route `/matches/:id` registered in `App.tsx` inside the authenticated layout. React Router v6 ranks the static `/matches/new` above the dynamic segment, so there is no conflict.
- The whole `MatchCard` becomes a link to the detail page. The card's inline "Rediger" link moves to the detail page as a button linking to `/matches/:id/edit`.
- Detail page contents:
  - Header: date, time, arena, "Spillets genstande" when present.
  - Teams: each team with its players, score, and winner highlight (olive), consistent with MatchCard styling.
  - Per-player Elo deltas for this match (all participants), from `computeEloWithHistory`.
  - Drinks grouped by attributed player (unattributed drinks in an "Fælles" group), showing type/brand/name, count, and volume.
  - A "Rediger" button. No delete UI (out of scope).
- Unknown match id renders a friendly "Kamp ikke fundet" state with a link back to `/matches`.

## 4. Draft auto-save for the new-match form

Files: new `client/src/hooks/useFormDraft.ts` (or colocated under `client/src`), `client/src/pages/MatchFormPage.tsx`

- Applies only to `/matches/new` (no `id` param). Edit mode never reads or writes drafts.
- Hook `useFormDraft` persists `FormState` to `localStorage` under key `matchFormDraft:v1`, debounced ~500 ms.
- Substance gate: a draft is only written when the form has meaningful content — any team has players beyond the auto-prefilled logged-in user alone with no other data, any drinks exist, or Arena/"Spillets genstande" is set. Rationale: prevents an untouched default form from persisting as a junk draft.
- Restore happens on mount, before user interaction. The existing defaults effect uses `??` and an empty-team check, so restored values are not overwritten.
- When a draft is restored, the form shows a small note "Kladde gendannet" with a "Ryd" action that clears storage and resets the form to defaults.
- The draft is cleared on successful submit. Storage failures (quota, disabled) are swallowed silently — drafts are best-effort.

## Error handling

- Elo deltas: derived purely from already-fetched match data; no new failure modes. Missing/unscored matches yield no delta entry and no chip.
- Detail page: guards against unknown id (not-found state) and matches still loading (reuses the existing loading pattern from MatchesPage).
- Draft storage: all `localStorage` access wrapped in try/catch; malformed stored JSON is discarded.

## Testing

Vitest, following existing patterns (jsdom + MSW where a page needs API data):

- `elo` deltas: winner delta positive / loser negative, zero-sum per match in 1v1, chronological ordering affects deltas, ineligible matches absent from the map, wrapper `computeElo` output unchanged against existing expectations.
- `useFormDraft`: writes after debounce when substantial, skips junk drafts, restores on mount, clear removes the key, malformed JSON ignored.
- `MatchCard`: chip renders for positive/negative/zero delta, hidden when prop absent; card links to `/matches/:id`.
- `MatchDetailPage`: renders teams, winner highlight, drinks grouping, Elo deltas, and the not-found state.
