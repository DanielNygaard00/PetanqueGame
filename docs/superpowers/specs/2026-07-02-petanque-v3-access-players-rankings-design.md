# Pétanque v3 — Access Gate, Player Roster & Elo Rankings

**Date:** 2026-07-02
**Status:** Approved design
**Builds on:** v1 (Workers/Hono/D1 + React SPA) and v2 (drinks/sessions/analytics). Live at petanque.danielnygaard00.workers.dev.

## Summary

The app is now public with open signup. v3 (a) gates registration behind a shared code, (b) turns players into a first-class shared roster (so opponents are real players, and duplicates can be fixed), and (c) ranks players with an Elo rating. These are sequenced because the gate protects data integrity, identity makes rankings meaningful, and rankings are the payoff.

Production data is a clean slate (empty), so schema and contract may evolve freely.

## Goals

- Require a shared **signup code** to register; existing login is unaffected.
- Maintain a **shared player roster**; both `Spiller` and `Modstander` are chosen from it; roster stays in sync with match data; duplicates can be renamed/merged.
- Rank players by **Elo**, computed from 1v1 match history, with a leaderboard.

## Non-goals

- No per-user-account player identity (a logged-in user may record matches for any roster player).
- No margin-weighted Elo, no team/doubles Elo in v3 (group matches excluded from Elo; still counted in general stats).
- No player profile pages beyond the roster list and the leaderboard (future).

## 1. Access gate

- Add Worker secret **`SIGNUP_CODE`**. `POST /api/auth/signup` requires a `code` field; if `SIGNUP_CODE` is unset **or** `code !== SIGNUP_CODE` → `403 { message: "Invalid signup code" }`. **Fail closed.** All other signup rules (unique username, optional password/email, JWT issue) are unchanged. Login is untouched.
- `Env` gains `SIGNUP_CODE: string`. Test pool binds `SIGNUP_CODE: "test-code"`. Local dev reads it from gitignored `.dev.vars`; production via `wrangler secret put SIGNUP_CODE`.
- Signup page gains a "Tilmeldingskode" field, sent as `code`.

## 2. Player roster

### `players` table (new)

| column | type | notes |
| --- | --- | --- |
| id | TEXT PRIMARY KEY | UUID |
| name | TEXT NOT NULL UNIQUE | canonical display name |
| created_at | TEXT NOT NULL | ISO 8601 |

Exact-`UNIQUE` on `name` is a backstop; the app does case-insensitive (Unicode-aware) find-or-create, matching the options-dedupe approach.

### Behavior

- Matches keep storing player **names** in `Spiller` (`player` column) and `Modstander` (`opponent` column). Names correspond 1:1 to roster players.
- **Auto-upsert:** on match create/update, each non-empty `Spiller`/`Modstander` name is upserted into `players` (trim + case-insensitive dedupe). The roster therefore always reflects the data.
- The match form's `Spiller` and `Modstander` are both roster pickers (SelectOrAdd backed by `players`; a typed-new name creates a roster player via the players endpoint).

### Endpoints (all guarded)

- `GET /api/players` → `[{ id, name, games }]` where `games` = count of matches with `player = name OR opponent = name`.
- `POST /api/players` → `{ name }`; upsert; returns `{ id, name }`.
- `PATCH /api/players/:id` → `{ name }`; **rename**: set the roster name and rewrite `matches.player`/`matches.opponent` from the old name to the new. If the new name already belongs to another roster player, this is treated as a **merge** into that player.
- `POST /api/players/:id/merge` → `{ intoId }`; rewrite matches from the source player's name to the target's name, then delete the source roster row.

## 3. Elo rankings

### Computation (client-side, pure module `client/src/stats/elo.ts`)

- `computeElo(matches, opts?) → PlayerRating[]` sorted by `elo` descending.
- Options: `base = 1000`, `k = 24`, `provisionalGames = 5`.
- **Eligible match:** not a group match (`!Gruppe_Bool`), both `Spiller` and `Modstander` non-empty, and `Vundet` is a boolean (decisive result).
- **Replay order:** ascending by `Dato`, then `Tid`, then original array index (stable).
- **Update per match:** with A = `Spiller`, B = `Modstander`, `scoreA = Vundet ? 1 : 0`:
  - `expectedA = 1 / (1 + 10^((eloB − eloA) / 400))`
  - `eloA += k · (scoreA − expectedA)`; `eloB += k · ((1 − scoreA) − (1 − expectedA))`
- Per player track: `elo`, `games`, `wins`, `losses`, `winRate`, `avgMargin` (from that player's perspective: `Point − Modstander_Point` when they were `Spiller`, inverse when `Modstander`; averaged over eligible matches with both scores present), `form` (last 5 results as `"W"|"L"`), `provisional` (`games < provisionalGames`).

### Rankings page

- Route `/rankings` + nav ("Rangliste"). Reads `useMatches`, runs `computeElo`.
- Leaderboard columns: rank · player · **Elo** (rounded) · games · W–L · win% · avg margin · recent form. Provisional players flagged (badge or muted). Empty-state when no eligible matches.

### Roster page

- Route `/roster` + nav ("Spillere"). Lists players (name + games) from `GET /api/players`. **Rename** (inline → `PATCH`). **Merge** (pick source + target → confirm → `POST merge`). Both invalidate the matches + players queries so rankings refresh.

## Frontend wiring

- Signup code field (Task in FE plan).
- `Modstander` → roster SelectOrAdd with `onAdd` creating a roster player (via `useAddPlayer`); `Spiller` likewise sourced from `GET /api/players`.
- Hooks: `usePlayers`, `useAddPlayer`, `useRenamePlayer`, `useMergePlayers` (TanStack Query; mutations invalidate `["players"]` and `["matches"]`).
- Nav gains "Rangliste" and "Spillere".

## Sequencing

1. **Backend:** signup-code gate; `players` migration; players endpoints (list-with-counts, upsert, rename, merge); match create/update auto-upsert.
2. **Frontend:** signup code field; player hooks; `Modstander` roster picker; `elo.ts` + Rankings page; Roster page; nav links.

Each phase ships working + tested. After both: set the `SIGNUP_CODE` secret, apply the migration to the live D1, rebuild, redeploy.

## Risks & mitigations

- **Fail-closed signup:** if `SIGNUP_CODE` is unset in prod, all signups break — mitigated by setting the secret as part of deploy and a test asserting the 403 path.
- **Name-as-key fragility:** rename/merge rewrite names across matches in one statement each; covered by tests. Auto-upsert + Unicode dedupe keep the roster canonical.
- **Elo with sparse data:** provisional flag communicates low confidence; group/indecisive matches excluded to avoid skew.
- **Existing testers:** login unchanged; only registration now needs the code.
