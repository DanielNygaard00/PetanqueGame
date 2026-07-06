# Match Players Model — Design

**Date:** 2026-07-06
**Status:** Approved (pending implementation plan)

## Problem

The match model is fundamentally 1v1: one `player`, one `opponent`, one points pair, plus a boolean `is_group` flag with a free-text `group_members` field. Real games do not fit:

- **Team games** (2v2, 2v3) collapse into a single player versus a comma-joined opponent string.
- **Free-for-all games** (three or more sides) cannot be represented at all — the second and third sides get flattened into notes.
- **Elo rankings skip every group game**, so players who only appear in team games earn no rating.
- **Opponents are free text**, not real player records, so there is no head-to-head, roster link, or per-player stat for them.
- **Drinks attach to the match, not to a player**, so "who drank what" survives only as free text in the `Spillets genstande` field and cannot be queried.

The six games already logged demonstrate all four gaps: three 1v1 games, one 2v2, one three-way free-for-all, and one 2v3.

## Goal

Introduce a `match_players` participant model as the single source of truth for who played, on which team, and the resulting score. Migrate the existing six games onto it, drop the flat 1v1 columns, and generalize Elo so every game — 1v1, team, and N-way — contributes to the rankings.

## Decisions

These were settled during brainstorming:

1. **Full migration.** `match_players` replaces the flat columns entirely. The six seeded games are backfilled onto the new model; the client form and Elo are rewritten to use it.
2. **Team index + score per row.** One `match_players` row per player carries a team index and the team's score (denormalized — teammates share the same score value). One table handles 1v1, 2v2, and N-way uniformly.
3. **Generalized team Elo.** Two-team games use average-member-rating expected scores; every member shifts by the same delta. Three-or-more-team games decompose into all pairwise team matchups ranked by score. Every player is rated from every game.
4. **Drinks attributed to players.** Each drink row gains a nullable player link, and the drinks editor gains a "who drank it" picker.

## Data Model

### New table: `match_players`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `match_id` | TEXT NOT NULL | references `matches(id)` |
| `player_id` | TEXT NOT NULL | references `players(id)` |
| `team` | INTEGER NOT NULL | 0, 1, 2, … |
| `score` | INTEGER | team score; same value on all teammate rows; nullable |
| `position` | INTEGER NOT NULL DEFAULT 0 | ordering within the match |

Indexes on `match_id` and `player_id`.

### Changed: `match_drinks`

- Add nullable `player_id` (references `players(id)`) — the player who consumed the drink. Null means unassigned.

### Slimmed: `matches`

Keep: `id, created_by, created_at, updated_at, date, time, arena, consecutive_games, game_items`.

Drop: `is_group, group_members, player, opponent, won, points, opponent_points`. All are now derived:

- **Group game** = any team has more than one player, or there are more than two teams.
- **Winner** = the team(s) with the maximum score. Ties yield co-winners.

SQLite `DROP COLUMN` is available and already used in migration `0002`.

### Migration `0004` (structure only)

1. Create `match_players`.
2. Add `match_drinks.player_id`.
3. Drop the flat columns from `matches`.

### Backfill (one-time, not a committed migration)

A separate `backfill_participants.sql`, generated from the known ground truth of the six games and keyed on `(date, time)`, inserts the `match_players` rows and sets `match_drinks.player_id`. It relies on the ground truth, not on parsing the old free-text columns, so it is order-independent relative to the column drop. Run once against the local D1 and once against the remote D1.

## API

`src/matches.ts` and `src/mapping.ts` change shape.

### Request body (`POST` / `PUT`)

```json
{
  "Dato": "2026-04-22",
  "Tid": "18:00",
  "Arena": "",
  "Konsekutive spil": null,
  "Spillets genstande": "optional notes",
  "teams": [
    { "score": 18, "players": ["Daniel", "Rasmus"] },
    { "score": 21, "players": ["Marcus", "Søren"] }
  ],
  "drinks": [
    { "type": "Øl", "brand": "Royal", "name": "Brun", "count": 1, "player": "Daniel" }
  ]
}
```

Team index is the array position. Drinks carry an optional `player` name.

Server validation: at least two teams, at least one player per team, scores in the range 0–50, and each player name resolved through `upsertPlayer` to a player id.

### Response (`GET`)

Each match reconstructs `teams[]` (players rendered as `{ id, name }`), a derived winner flag, and drinks that carry the consuming player's name. Group-ness and winner are computed, not stored.

## Roster (`src/players.ts`)

Referencing players by id rather than name simplifies both operations:

- **Rename** updates `players.name` only. Matches follow automatically because they reference the player id.
- **Merge** repoints `match_players.player_id` and `match_drinks.player_id` from the loser to the winner, then deletes the loser.
- **Games count** becomes `COUNT(*) FROM match_players WHERE player_id = ?`.

## Client

### Match form (`MatchFormPage`)

Replace the single player / opponent / points fields with a teams editor:

- Starts with two teams; an "Add team" button supports N-way games.
- Each team is a multi-player picker (`SelectOrAdd`, allowing multiple players) plus a score input.
- A remove-team control appears when there are more than two teams.
- The winning team (highest score) is highlighted automatically.
- The drinks editor gains a per-drink "who drank it" picker listing the match's participants plus an "unassigned" option.
- Quick-log prefill still seeds team 0 with the last player and the last arena.

Keep `Dato`, `Tid`, `Arena`, `Konsekutive spil`, `Spillets genstande`, and the drinks list.

### Match card (`MatchCard`)

Render teams, e.g. `Daniel + Rasmus (18) vs Marcus + Søren (21)`, with winner and group badges and the drink count.

### Types (`api/types.ts`)

`Match` gains `teams: { team: number; score: number | null; players: { id: string; name: string }[] }[]`. `Drink` gains an optional `player`.

## Stats

- **`elo.ts`**: generalized team Elo. Two teams use average-member-rating expected scores, and every member shifts by the result. Three-or-more teams decompose into pairwise team matchups ranked by score. All games are now rated.
- **`headToHead.ts`, dashboard, insights**: adapt to participants — teammates and opponents are derived from team membership.
- **New**: a compact per-player drink stats section — total litres (from `volumeCl × count`), beers-per-win, and top drinker.

## Testing

- **Backend**: create and read a match with teams and drink attribution; validation (team count, players per team, score range); roster merge repointing.
- **`elo.ts`**: 1v1, 2v2, and three-way pairwise cases, including the average-rating expected score.
- **Frontend**: the teams-editor form and the match card rendering.

## Scope cuts (YAGNI)

- No named or persistent team entities — teams are ad-hoc per match.
- No per-game target-score field.
- Drink stats are one compact section, not a new page.
