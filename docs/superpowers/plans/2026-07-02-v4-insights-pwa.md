# v4 — Auto-Insights, Head-to-Head, Date-Range & PWA Quick-Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the computed stats into plain-language insights + per-opponent head-to-head with a date-range scope, and make the app an installable PWA with fast phone quick-logging. Frontend-only.

**Architecture:** New pure, tested stat modules (`insights.ts`, `headToHead.ts`, `dateRange.ts`) consumed by the dashboard. `vite-plugin-pwa` for installability/offline shell. Match-form prefills + a repeat-drinks button. No backend/contract change.

**Tech Stack:** React, TypeScript, Tailwind, Vitest + RTL, vite-plugin-pwa.

## Global Constraints

- Frontend only; runs against the existing v3 API. Tests under `client/` (jsdom).
- Danish UI; apéro palette; **mobile-first** (selects full-width on mobile, insights/H2H reflow, quick-log button full-width tap target).
- Insight findings require ≥3 games of support or are omitted.
- Date-range presets: `all` (Alt), `year` (I år = same calendar year as now), `30d` (Seneste 30 dage). Applies to dashboard stats + insights + head-to-head; **NOT** to Elo rankings.
- Head-to-head: per selected player, non-group decisive matches, both `Spiller` and `Modstander` directions.
- PWA: `registerType: "autoUpdate"`, manifest name "Pétanque · Apéro" / short_name "Pétanque" / theme `#C65D3B` / background `#F5EFE1` / standalone; apéro icon 192+512 (maskable) + apple-touch 180.

---

### Task 1: dateRange + headToHead pure modules

**Files:**
- Create: `client/src/stats/dateRange.ts`, `client/src/stats/headToHead.ts`
- Test: `client/src/stats/dateRange.test.ts`, `client/src/stats/headToHead.test.ts`

**Interfaces:**
- `RangePreset = "all" | "year" | "30d"`; `filterByRange(matches, preset, now: Date): Match[]`.
- `H2HRow = { opponent, games, wins, losses, winRate, avgMargin }`; `headToHead(matches, player): H2HRow[]` sorted by games desc.

- [ ] **Step 1: Write the failing tests**

```typescript
// client/src/stats/dateRange.test.ts
import { describe, it, expect } from "vitest";
import { filterByRange } from "./dateRange";
const M = [
  { id: "1", Dato: "2026-07-01" }, { id: "2", Dato: "2026-06-01" },
  { id: "3", Dato: "2025-12-31" }, { id: "4", Dato: "2026-07-10" },
] as any;
const now = new Date("2026-07-11T12:00:00");
describe("filterByRange", () => {
  it("all → everything", () => expect(filterByRange(M, "all", now)).toHaveLength(4));
  it("year → same calendar year", () => expect(filterByRange(M, "year", now).map((m) => m.id).sort()).toEqual(["1", "2", "4"]));
  it("30d → within last 30 days", () => expect(filterByRange(M, "30d", now).map((m) => m.id).sort()).toEqual(["1", "4"]));
});
```

```typescript
// client/src/stats/headToHead.test.ts
import { describe, it, expect } from "vitest";
import { headToHead } from "./headToHead";
const M = [
  { id: "1", Spiller: "Ida", Modstander: "Bo", Vundet: true, Point: 13, Modstander_Point: 5, Gruppe_Bool: false },
  { id: "2", Spiller: "Bo", Modstander: "Ida", Vundet: true, Point: 13, Modstander_Point: 9, Gruppe_Bool: false },
  { id: "3", Spiller: "Ida", Modstander: "Cae", Vundet: false, Point: 7, Modstander_Point: 13, Gruppe_Bool: false },
  { id: "4", Spiller: "Ida", Modstander: "Bo", Vundet: true, Gruppe_Bool: true }, // group excluded
] as any;
describe("headToHead", () => {
  it("aggregates Ida's record per opponent (both directions, non-group)", () => {
    const rows = headToHead(M, "Ida");
    const vsBo = rows.find((r) => r.opponent === "Bo")!;
    expect(vsBo.games).toBe(2);      // match 1 (win) + match 2 (Ida was Modstander, Bo won → Ida loss)
    expect(vsBo.wins).toBe(1);
    expect(vsBo.losses).toBe(1);
    expect(vsBo.avgMargin).toBe(0);  // (+8) and (9-13=-4 from Ida's view on match2) → (8 + -4)/2 = 2 ... see impl
    const vsCae = rows.find((r) => r.opponent === "Cae")!;
    expect(vsCae.games).toBe(1);
    expect(vsCae.losses).toBe(1);
  });
});
```
NOTE for the implementer: compute `vsBo.avgMargin` from the fixture and assert the actual value your implementation produces (match1 margin = 13−5 = +8 for Ida; match2 Ida was Modstander so margin = Modstander_Point − Point = 9−13 = −4; avg = (8 + −4)/2 = **2**). Correct the assertion to `toBe(2)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/stats/dateRange.test.ts src/stats/headToHead.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```typescript
// client/src/stats/dateRange.ts
import type { Match } from "../api/types";
export type RangePreset = "all" | "year" | "30d";
export function filterByRange(matches: Match[], preset: RangePreset, now: Date): Match[] {
  if (preset === "all") return matches;
  if (preset === "year") {
    const y = String(now.getFullYear());
    return matches.filter((m) => (m.Dato ?? "").slice(0, 4) === y);
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const nowStr = now.toISOString().slice(0, 10);
  return matches.filter((m) => { const d = m.Dato ?? ""; return d >= cutoffStr && d <= nowStr; });
}
```

```typescript
// client/src/stats/headToHead.ts
import type { Match } from "../api/types";
export type H2HRow = { opponent: string; games: number; wins: number; losses: number; winRate: number; avgMargin: number };
export function headToHead(matches: Match[], player: string): H2HRow[] {
  const agg = new Map<string, { games: number; wins: number; marginSum: number; marginN: number }>();
  const bothScores = (m: Match) => typeof m.Point === "number" && typeof m.Modstander_Point === "number";
  for (const m of matches) {
    if (m.Gruppe_Bool || typeof m.Vundet !== "boolean" || !m.Spiller || !m.Modstander) continue;
    let opp: string, won: boolean, margin: number | null;
    if (m.Spiller === player) { opp = m.Modstander; won = m.Vundet; margin = bothScores(m) ? (m.Point! - m.Modstander_Point!) : null; }
    else if (m.Modstander === player) { opp = m.Spiller; won = !m.Vundet; margin = bothScores(m) ? (m.Modstander_Point! - m.Point!) : null; }
    else continue;
    const g = agg.get(opp) ?? { games: 0, wins: 0, marginSum: 0, marginN: 0 };
    g.games++; if (won) g.wins++;
    if (margin !== null) { g.marginSum += margin; g.marginN++; }
    agg.set(opp, g);
  }
  return [...agg.entries()].map(([opponent, g]) => ({
    opponent, games: g.games, wins: g.wins, losses: g.games - g.wins,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd client && npx vitest run src/stats/dateRange.test.ts src/stats/headToHead.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/dateRange.ts client/src/stats/headToHead.ts client/src/stats/dateRange.test.ts client/src/stats/headToHead.test.ts
git commit -m "feat(client): date-range filter + head-to-head pure modules"
```

---

### Task 2: insights module

**Files:**
- Create: `client/src/stats/insights.ts`
- Test: `client/src/stats/insights.test.ts`

**Interfaces:**
- `Insight = { text: string; tone?: "good" | "bad" | "neutral" }`; `deriveInsights(matches): Insight[]`. Reuses `deriveStats`. Each rule gated on ≥3-game support.

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/stats/insights.test.ts
import { describe, it, expect } from "vitest";
import { deriveInsights } from "./insights";

// 4 morning wins, 3 evening losses, arena A vs B, opponents Bo/Cae
const M = [
  { id: "1", Dato: "2026-06-01", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 5, Arena: "A", Modstander: "Bo",  Spiller: "Ida", Gruppe_Bool: false, drinks: [] },
  { id: "2", Dato: "2026-06-02", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 6, Arena: "A", Modstander: "Bo",  Spiller: "Ida", Gruppe_Bool: false, drinks: [] },
  { id: "3", Dato: "2026-06-03", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 7, Arena: "A", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [] },
  { id: "4", Dato: "2026-06-04", Tid: "20:00", Vundet: false, Point: 4,  Modstander_Point: 13, Arena: "B", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [{ type: "Øl", count: 4 }] },
  { id: "5", Dato: "2026-06-05", Tid: "20:00", Vundet: false, Point: 6,  Modstander_Point: 13, Arena: "B", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [{ type: "Øl", count: 5 }] },
  { id: "6", Dato: "2026-06-06", Tid: "20:00", Vundet: false, Point: 8,  Modstander_Point: 13, Arena: "B", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [{ type: "Øl", count: 3 }] },
] as any;

describe("deriveInsights", () => {
  it("produces readable Danish findings from the data", () => {
    const ins = deriveInsights(M);
    const text = ins.map((i) => i.text).join(" | ");
    expect(ins.length).toBeGreaterThanOrEqual(3);
    expect(text).toMatch(/vundet .* af 6 kampe/i);        // overall win-rate
    expect(text.toLowerCase()).toContain("bedst");         // best time-of-day
    expect(text.toLowerCase()).toContain("bane");          // best arena
  });

  it("returns nothing when there is too little data", () => {
    expect(deriveInsights([{ id: "1", Vundet: true } as any])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/stats/insights.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// client/src/stats/insights.ts
import type { Match } from "../api/types";
import { deriveStats } from "./derive";

export type Insight = { text: string; tone?: "good" | "bad" | "neutral" };
const MIN = 3;
const TIME_LABEL: Record<string, string> = { morning: "om morgenen", afternoon: "om eftermiddagen", evening: "om aftenen", night: "om natten", unknown: "" };

export function deriveInsights(matches: Match[]): Insight[] {
  const s = deriveStats(matches);
  const out: Insight[] = [];
  if (s.total < MIN) return out;

  out.push({ text: `Du har vundet ${s.winRate.toFixed(0)}% af ${s.total} kampe`, tone: s.winRate >= 50 ? "good" : "neutral" });

  const tod = s.byTimeOfDay.filter((t) => t.games >= MIN && t.key !== "unknown").sort((a, b) => b.winRate - a.winRate);
  if (tod.length) out.push({ text: `Bedst ${TIME_LABEL[tod[0].key] ?? tod[0].key}: ${tod[0].winRate.toFixed(0)}% sejre`, tone: "good" });

  const b0 = s.byUnitsBucket.find((b) => b.bucket === "0");
  const tipsy = s.byUnitsBucket.filter((b) => b.bucket === "3–4" || b.bucket === "5+");
  const tipsyGames = tipsy.reduce((n, b) => n + b.games, 0);
  const tipsyWins = tipsy.reduce((n, b) => n + (b.winRate * b.games) / 100, 0);
  if (b0 && b0.games >= MIN && tipsyGames >= MIN) {
    const tr = (tipsyWins / tipsyGames) * 100;
    out.push({ text: `Ædru: ${b0.winRate.toFixed(0)}% sejre — efter 3+ genstande: ${tr.toFixed(0)}%`, tone: b0.winRate > tr ? "bad" : "neutral" });
  }

  const arenas = s.byArena.filter((a) => a.games >= MIN).sort((a, b) => b.avgMargin - a.avgMargin);
  if (arenas.length) out.push({ text: `Bedste bane: ${arenas[0].key} (${arenas[0].avgMargin >= 0 ? "+" : ""}${arenas[0].avgMargin.toFixed(1)} margin)`, tone: "good" });

  const opps = s.byOpponent.filter((o) => o.games >= MIN).sort((a, b) => a.winRate - b.winRate);
  if (opps.length) out.push({ text: `Sværeste modstander: ${opps[0].key} (${opps[0].winRate.toFixed(0)}% sejre)`, tone: "bad" });

  if (s.topDrinksByUnits.length) out.push({ text: `Mest loggede drik: ${s.topDrinksByUnits[0].name} (${s.topDrinksByUnits[0].units} stk.)`, tone: "neutral" });

  if (s.longestStreak >= MIN) out.push({ text: `Længste sejrsstime: ${s.longestStreak} i træk`, tone: "good" });

  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd client && npx vitest run src/stats/insights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/insights.ts client/src/stats/insights.test.ts
git commit -m "feat(client): auto-insight callouts from computed stats"
```

---

### Task 3: Dashboard wiring — date range, insights, head-to-head

**Files:**
- Modify: `client/src/pages/DashboardPage.tsx`
- Create: `client/src/components/InsightChips.tsx`

**Interfaces:**
- Consumes: `filterByRange`, `deriveInsights`, `headToHead`, existing `deriveStats`/player filter.
- Produces: a date-range `<select>` (Alt/I år/Seneste 30 dage) that filters matches before all dashboard computation; an insights callout row (`InsightChips`); and a head-to-head section shown when a specific player is selected.

- [ ] **Step 1: Add the date range + insights + H2H to DashboardPage**

```tsx
// client/src/pages/DashboardPage.tsx — key additions
import { useMemo, useState } from "react";
import { filterByRange, type RangePreset } from "../stats/dateRange";
import { deriveInsights } from "../stats/insights";
import { headToHead } from "../stats/headToHead";
import { InsightChips } from "../components/InsightChips";

// state
const [range, setRange] = useState<RangePreset>("all");
// after fetching `data` and computing the player-filtered list `filtered`:
const scoped = useMemo(() => filterByRange(filtered, range, new Date()), [filtered, range]);
const s = deriveStats(scoped);                 // replace deriveStats(filtered) with scoped
const insights = useMemo(() => deriveInsights(scoped), [scoped]);
const h2h = useMemo(() => (player === "Alle" ? [] : headToHead(scoped, player)), [scoped, player]);

// UI: a date-range <select> next to the player <select> (both full-width on mobile: w-full sm:w-auto)
// <InsightChips items={insights} /> near the top (below the filters)
// when player !== "Alle" && h2h.length: a Card "Head-to-head" with a table (md) / card list (mobile) of opponent · V–T · win% · margin
```
(`InsightChips` renders each `Insight` as a rounded chip; tone maps to color: good=olive, bad=bordeaux, neutral=ink/60.)

```tsx
// client/src/components/InsightChips.tsx
import type { Insight } from "../stats/insights";
const TONE: Record<string, string> = { good: "bg-olive/15 text-olive", bad: "bg-bordeaux/10 text-bordeaux", neutral: "bg-ink/5 text-ink/70" };
export function InsightChips({ items }: { items: Insight[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i, idx) => (
        <span key={idx} className={`rounded-full px-3 py-1 text-sm ${TONE[i.tone ?? "neutral"]}`}>{i.text}</span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: green + clean. Confirm the dashboard still shows v2/v3 sections; date-range now scopes them.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/DashboardPage.tsx client/src/components/InsightChips.tsx
git commit -m "feat(client): dashboard date-range, insight chips, per-player head-to-head"
```

---

### Task 4: PWA (installable + offline shell + apéro icon)

**Files:**
- Modify: `client/vite.config.ts`, `client/package.json`, `client/index.html`
- Create: `client/public/pwa-icon.svg` (source), generated icons under `client/public/`

**Interfaces:**
- Produces: an installable PWA (manifest + service worker), apéro icons, autoUpdate SW.

- [ ] **Step 1: Install the plugin**

Run: `cd client && npm install -D vite-plugin-pwa`

- [ ] **Step 2: Create the source icon** `client/public/pwa-icon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#F5EFE1"/>
  <circle cx="256" cy="272" r="150" fill="#8A8D91"/>
  <circle cx="256" cy="272" r="150" fill="none" stroke="#2B2622" stroke-opacity="0.2" stroke-width="4"/>
  <circle cx="210" cy="230" r="34" fill="#C65D3B"/>
  <circle cx="300" cy="250" r="22" fill="#7B2D3B"/>
  <circle cx="250" cy="315" r="18" fill="#D9A441"/>
  <text x="256" y="120" font-family="serif" font-size="80" fill="#C65D3B" text-anchor="middle">P</text>
</svg>
```

- [ ] **Step 3: Configure VitePWA in `client/vite.config.ts`**

```typescript
import { VitePWA } from "vite-plugin-pwa";
// in plugins: [react(), VitePWA({...})]
VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["pwa-icon.svg"],
  manifest: {
    name: "Pétanque · Apéro",
    short_name: "Pétanque",
    theme_color: "#C65D3B",
    background_color: "#F5EFE1",
    display: "standalone",
    start_url: "/",
    icons: [
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  },
  workbox: { navigateFallback: "/index.html", globPatterns: ["**/*.{js,css,html,svg,png,woff2}"] },
})
```
If a raster icon is preferred for broader install support, add `@vite-pwa/assets-generator` (`npm i -D @vite-pwa/assets-generator`), generate 192/512/apple-touch PNGs from `pwa-icon.svg`, and list them in `icons` + an `<link rel="apple-touch-icon">` in `index.html`. If PNG generation cannot run in this environment, keep the SVG icon (Android install works) and note the iOS-icon limitation in the report — do NOT block the task.

- [ ] **Step 4: Verify build produces a manifest + SW**

Run: `cd client && npm run build`
Expected: build clean; `client/dist` contains `manifest.webmanifest` and a service worker (`sw.js`/`workbox-*`). Tests still pass (`npx vitest run`).

- [ ] **Step 5: Commit**

```bash
git add client/vite.config.ts client/package.json client/package-lock.json client/index.html client/public/pwa-icon.svg
git commit -m "feat(client): installable PWA with apéro icon + offline shell"
```

---

### Task 5: Quick-log (prefills + repeat last drinks)

**Files:**
- Modify: `client/src/pages/MatchFormPage.tsx`

**Interfaces:**
- Produces: create-mode prefill (Dato=today, Tid=now, Spiller/Arena=most recent match's values) and a "Gentag sidste omgang" button that loads the previous match's drinks.

- [ ] **Step 1: Add prefill + repeat button (create mode only)**

```tsx
// client/src/pages/MatchFormPage.tsx
// `matches` (from useMatches) is newest-first. last = matches[0].
const last = matches[0];

// In create mode (no :id), initialize the form once when matches load:
useEffect(() => {
  if (id) return; // edit mode handled elsewhere
  const nowHM = new Date().toTimeString().slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  setForm((f) => ({
    ...f,
    Dato: f.Dato ?? today,
    Tid: f.Tid ?? nowHM,
    Spiller: f.Spiller ?? last?.Spiller,
    Arena: f.Arena ?? last?.Arena,
  }));
  // run once when matches first arrive
}, [id, matches.length]);

// A button (create mode, when last?.drinks?.length):
{!id && last?.drinks?.length ? (
  <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => set({ drinks: last.drinks })}>
    Gentag sidste omgang ({last.drinks.length} drikke)
  </Button>
) : null}
```
Keep edit-mode behavior (loading a specific match) unchanged. Ensure prefill never overwrites a value the user already typed (the `f.X ?? ...` guards).

- [ ] **Step 2: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: green + clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/MatchFormPage.tsx
git commit -m "feat(client): quick-log — prefill today/now/last player+arena, repeat last drinks"
```

---

### Task 6: End-to-end verify + deploy (v3 + v4)

**Files:** none (verify + deploy)

- [ ] **Step 1: Full local verification**

Run: `npm test` (backend) and `cd client && npm test` then `npm run build`. Expected: all green; build produces `client/dist` with `manifest.webmanifest` + SW.

- [ ] **Step 2: Deploy everything**

```bash
npm run db:migrate:remote                 # applies 0003_players to live D1 (v3)
npx wrangler secret put SIGNUP_CODE        # set the shared signup code (from the user)
cd client && npm run build && cd ..
npx wrangler deploy
```

- [ ] **Step 3: Live smoke test**

- Signup without code → 403; with code → 201.
- Log 3+ 1v1 matches with drinks/time → dashboard shows insight chips; date-range select scopes them; selecting a player shows head-to-head; `/rankings` shows Elo.
- On a phone: "Add to Home Screen" works; quick-log prefills date/time/last player; "Gentag sidste omgang" fills drinks.

- [ ] **Step 4: Commit any config touch-ups**

```bash
git add -A && git commit -m "chore: v4 verify + deploy"
```

---

## Self-Review

**Spec coverage:** date-range + head-to-head modules (Task 1); insights (Task 2); dashboard wiring — range select + insight chips + per-player H2H (Task 3); installable PWA + apéro icon + offline shell (Task 4); quick-log prefills + repeat-drinks (Task 5); e2e + deploy incl. `SIGNUP_CODE` + migration (Task 6). ✅

**Placeholder scan:** Task 3/5 give focused edits against the existing DashboardPage/MatchFormPage; the head-to-head H2H table markup is described (opponent · V–T · win% · margin, table on md+, card list on mobile) rather than pasted in full — implementer follows the RankingsPage table/card pattern already in the codebase. Pure modules (Tasks 1–2) and `InsightChips`/PWA config are given in full. **Type consistency:** `RangePreset`, `H2HRow`, `Insight` names stable; `deriveInsights` reuses `deriveStats` fields that exist (byTimeOfDay/byArena/byOpponent/byUnitsBucket/topDrinksByUnits/longestStreak/winRate/total).

**Note:** the headToHead test's `avgMargin` expected value is computed in Task 1 Step 1's note (=2) so the implementer asserts the real value, not a guess.
