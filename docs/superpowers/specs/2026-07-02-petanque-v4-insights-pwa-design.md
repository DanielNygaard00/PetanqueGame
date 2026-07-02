# Pétanque v4 — Auto-Insights, Head-to-Head, Date-Range & PWA Quick-Log

**Date:** 2026-07-02
**Status:** Approved design
**Builds on:** v1–v3. Ships together with the (not-yet-pushed) v3 branch.

## Summary

Make the collected data *speak* and make logging *effortless* so more data flows in. Frontend-only — every input already exists in the API; no backend, schema, or contract change.

1. **Auto-insight callouts** — plain-language Danish findings generated from the computed stats, shown on the dashboard.
2. **Head-to-head + date-range** — per-opponent record for a selected player, and a date-range scope (Alt / I år / Seneste 30 dage) applied to the dashboard stats, insights, and head-to-head.
3. **PWA + quick-log** — installable to home screen (offline app shell), plus match-form prefills (today/now/last-used player+arena) and a "repeat last session's drinks" button.

## Goals

- Surface 3–8 readable findings ("Bedst om formiddagen: 71% sejre", "Bedste bane: Fælleden (+4.2)") without the user reading charts.
- Let users scope the dashboard to a time window and see how they fare against each opponent.
- Cut match logging to a few taps on a phone; make the app installable.

## Non-goals

- No date-range on the Elo rankings (Elo is a cumulative running rating; slicing it by date would mislead). Rankings stay all-time.
- No offline *writes* (logging needs the server); the PWA caches the app shell for fast load / installability, not offline mutations.
- No backend/schema changes.

## 1. Auto-insight callouts

- Pure module `client/src/stats/insights.ts`: `deriveInsights(matches): Insight[]` where `Insight = { text: string; tone?: "good" | "bad" | "neutral" }`.
- Internally reuses `deriveStats` (and its `byTimeOfDay`, `byWeekday`, `byArena`, `byOpponent`, `byUnitsBucket`, `topDrinksByUnits`, `longestStreak`, `winRate`, `total`).
- Each finding is emitted only when it has enough support (a bucket/arena/opponent with **≥ 3 games**); otherwise skipped, so sparse data doesn't produce noise.
- Rule set (Danish text): overall win-rate; best time-of-day by win%; sober-vs-tipsy win-rate gap (bucket "0" vs "3–4"+"5+"); best arena by avg margin; toughest opponent by lowest win%; most-logged drink; longest win streak.
- Rendered on the dashboard as a row of callout chips/cards, honoring the active player filter + date range.

## 2. Head-to-head + date-range

- Pure module `client/src/stats/headToHead.ts`: `headToHead(matches, player): H2HRow[]` where `H2HRow = { opponent, games, wins, losses, winRate, avgMargin }`. Considers non-group, decisive matches in which `player` appears as `Spiller` (result = `Vundet`, margin = `Point − Modstander_Point`) **or** `Modstander` (result = `!Vundet`, margin inverted), aggregated per opposing player, sorted by games desc.
- Pure module `client/src/stats/dateRange.ts`: `filterByRange(matches, preset, now)` with presets `"all" | "year" | "30d"`; `now` is injectable for testing. `"year"` = same calendar year as `now`; `"30d"` = `Dato` within the last 30 days.
- Dashboard: a date-range `<select>` (Alt / I år / Seneste 30 dage) filters matches **before** `deriveStats`/`deriveInsights`/`headToHead`. The existing player filter still applies. When a player is selected, a "Head-to-head" section shows the `H2HRow[]` table (mobile: card list).

## 3. PWA + quick-log

### PWA

- Add `vite-plugin-pwa` (+ an asset generator for icons). `registerType: "autoUpdate"`, offline app-shell precache via Workbox.
- `manifest`: name "Pétanque · Apéro", short_name "Pétanque", `theme_color` `#C65D3B`, `background_color` `#F5EFE1`, `display: "standalone"`, start_url `/`.
- **Icon:** a generated apéro icon (terracotta boule motif) at 192×192 and 512×512 (maskable), plus a 180×180 apple-touch-icon. Generated from a source SVG; if PNG generation can't run in the environment, fall back to an SVG manifest icon (`sizes: "any"`, `purpose: "any maskable"`) and note the iOS limitation.

### Quick-log

- Match form (create mode) prefills: `Dato` = today, `Tid` = now (HH:MM), `Spiller` and `Arena` = the most recent match's values (from `useMatches`, newest first).
- A **"Gentag sidste omgang"** button loads the previous match's `drinks` into the form's drinks list (one tap to reuse a typical session). Only shown in create mode when a previous match with drinks exists.
- Edit mode is unchanged (loads the specific match).

## Mobile-first

All v4 UI follows the project's mobile-first rule: date-range/player selects full-width on mobile; insight callouts stack; head-to-head reflows to a card list on small screens; the quick-log button is a full-width tap target on mobile.

## Sequencing

1. `insights.ts` (pure, tested).
2. `headToHead.ts` + `dateRange.ts` (pure, tested).
3. Dashboard wiring — date-range selector, insight callouts, head-to-head section.
4. PWA — plugin + manifest + generated icons + offline shell.
5. Quick-log — form prefills + "Gentag sidste omgang".
6. E2E verify + deploy everything (v3 + v4): set `SIGNUP_CODE`, apply migrations to live D1, build, deploy.

## Risks & mitigations

- **Insight noise on sparse data:** ≥3-game support gate per finding.
- **PWA icon generation环境 fragility:** fall back to an SVG manifest icon; wire everything else regardless.
- **Date math / timezones:** `filterByRange` takes an injectable `now` and compares `YYYY-MM-DD` strings / calendar year to keep it deterministic and test-covered.
- **Stale service worker:** `registerType: "autoUpdate"` so clients pick up new deploys.
