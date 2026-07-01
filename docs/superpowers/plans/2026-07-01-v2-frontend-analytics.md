# v2 Frontend — Drinks Capture & Insights Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture multiple drinks (with counts), match time, and opponent score in the match form; extend stats derivation; and build an insights dashboard (sober-vs-tipsy win-rate, performance by time/weekday/arena/opponent, consumption over time, per-player) with a player filter.

**Architecture:** Reuses v1 SPA (Vite/React/TS/Tailwind, TanStack Query, Recharts). The match object gains `Tid`, `Modstander_Point`, and a `drinks: Drink[]` array. Analytics are computed client-side in an extended `deriveStats` from the matches already fetched.

**Tech Stack:** React, TypeScript, Tailwind, TanStack Query, Recharts, Vitest + RTL.

## Global Constraints

- Runs against the v2 backend contract: match JSON has Danish keys + `Tid`, `Modstander_Point`, and `drinks: [{ type, category, brand, name, country, wineRegion, count, volumeCl }]`.
- Danish UI labels. Apéro palette (terracotta `#C65D3B`, etc.).
- Tests: frontend runs under `client/` jsdom config (`cd client && npm test` / `npx vitest run <file>`); backend suite is separate.
- `totalUnits(match) = Σ drink.count`; sober/tipsy buckets: `0`, `1–2`, `3–4`, `5+`. Margin = `Point − Modstander_Point` when both present.
- Time-of-day buckets from `Tid` (`HH:MM`): morning `05–11`, afternoon `12–16`, evening `17–21`, night `22–04`.

---

### Task 1: v2 types + hooks send drinks

**Files:**
- Modify: `client/src/api/types.ts`
- Test: `client/src/api/types.test.ts` (new, tiny compile/shape guard is optional — see step)

**Interfaces:**
- Produces: `Drink = { type?, category?, brand?, name?, country?, wineRegion?, count?, volumeCl? }`; `Match` gains `Tid?: string`, `Modstander_Point?: number`, `drinks?: Drink[]`. `useCreateMatch`/`useUpdateMatch` already send the whole match object, so passing `drinks`/`Tid`/`Modstander_Point` flows through unchanged.

- [ ] **Step 1: Update `types.ts`**

```typescript
// client/src/api/types.ts — add Drink, extend Match
export type Drink = {
  type?: string | null;
  category?: string | null;
  brand?: string | null;
  name?: string | null;
  country?: string | null;
  wineRegion?: string | null;
  count?: number;
  volumeCl?: number | null;
};

// add to the existing Match type:
//   Tid?: string;
//   Modstander_Point?: number;
//   drinks?: Drink[];
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && npx tsc -b` (or `npm run build`)
Expected: no type errors. (No new unit test required — this is a type-only change; the hooks pass the object through.)

- [ ] **Step 3: Commit**

```bash
git add client/src/api/types.ts
git commit -m "feat(client): v2 Match type with drinks[], Tid, Modstander_Point"
```

---

### Task 2: DrinksEditor component

**Files:**
- Create: `client/src/components/DrinksEditor.tsx`
- Test: `client/src/components/DrinksEditor.test.tsx`

**Interfaces:**
- Consumes: `SelectOrAdd`, `Input`, `Button`, `Drink` type.
- Produces: `<DrinksEditor value={Drink[]} onChange={(Drink[]) => void} typeOptions categoryOptions brandOptions nameOptions />` — renders a row per drink (cascading type→category→brand→name via SelectOrAdd; wine-region Input when `type==="Vin"`; a `count` number input default 1; a `volume (cl)` number input), an "add drink" button, and a remove control per row.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/components/DrinksEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrinksEditor } from "./DrinksEditor";

const opts = { typeOptions: ["Øl", "Vin"], categoryOptions: [], brandOptions: [], nameOptions: [] };

describe("DrinksEditor", () => {
  it("adds a drink row", async () => {
    const onChange = vi.fn();
    render(<DrinksEditor value={[]} onChange={onChange} {...opts} />);
    await userEvent.click(screen.getByRole("button", { name: /tilføj drik/i }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ count: 1 })]);
  });

  it("removes a drink row", async () => {
    const onChange = vi.fn();
    render(<DrinksEditor value={[{ type: "Øl", count: 2 }]} onChange={onChange} {...opts} />);
    await userEvent.click(screen.getByRole("button", { name: /fjern/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("edits count for a row", async () => {
    const onChange = vi.fn();
    render(<DrinksEditor value={[{ type: "Øl", count: 1 }]} onChange={onChange} {...opts} />);
    const countInput = screen.getByLabelText(/antal/i);
    await userEvent.clear(countInput);
    await userEvent.type(countInput, "3");
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ count: 3 })]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/DrinksEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/components/DrinksEditor.tsx
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { Drink } from "../api/types";

type Props = {
  value: Drink[];
  onChange: (drinks: Drink[]) => void;
  typeOptions: string[];
  categoryOptions?: string[];
  brandOptions?: string[];
  nameOptions?: string[];
};

export function DrinksEditor({ value, onChange, typeOptions, categoryOptions = [], brandOptions = [], nameOptions = [] }: Props) {
  const update = (i: number, patch: Partial<Drink>) =>
    onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const add = () => onChange([...value, { count: 1 }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {value.map((d, i) => (
        <div key={i} className="rounded-card border border-ink/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink/70">Drik {i + 1}</span>
            <Button type="button" variant="ghost" onClick={() => remove(i)}>Fjern</Button>
          </div>
          <SelectOrAdd label="Type" value={d.type ?? ""} options={typeOptions} onChange={(v) => update(i, d.type === "Vin" || v === "Vin" ? { type: v } : { type: v, wineRegion: "" })} />
          <SelectOrAdd label="Kategori" value={d.category ?? ""} options={categoryOptions} onChange={(v) => update(i, { category: v })} />
          <SelectOrAdd label="Brand" value={d.brand ?? ""} options={brandOptions} onChange={(v) => update(i, { brand: v })} />
          <SelectOrAdd label="Navn" value={d.name ?? ""} options={nameOptions} onChange={(v) => update(i, { name: v })} />
          {d.type === "Vin" && (
            <Input label="Region" value={d.wineRegion ?? ""} onChange={(e) => update(i, { wineRegion: e.target.value })} />
          )}
          <div className="flex gap-3">
            <Input label="Antal" type="number" min={1} value={d.count ?? 1} onChange={(e) => update(i, { count: Number(e.target.value) })} className="w-24" />
            <Input label="Volumen (cl)" type="number" value={d.volumeCl ?? ""} onChange={(e) => update(i, { volumeCl: e.target.value === "" ? null : Number(e.target.value) })} className="w-32" />
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={add}>+ Tilføj drik</Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/DrinksEditor.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/DrinksEditor.tsx client/src/components/DrinksEditor.test.tsx
git commit -m "feat(client): DrinksEditor — multi-drink list with count/volume"
```

---

### Task 3: MatchFormPage v2 (drinks list + time + opponent score)

**Files:**
- Modify: `client/src/pages/MatchFormPage.tsx`

**Interfaces:**
- Consumes: `DrinksEditor`, `useOptions("drink_types"|"drink_categories"|"drink_brands"|"drink_names")`, existing match hooks.
- Produces: the form manages `form.drinks: Drink[]` via DrinksEditor; adds a `Tid` time input and a `Modstander_Point` number input; mirrors server validation (required Dato/Spiller, scores 0..50, count ≥ 1) with an inline error; submit sends the full object incl. `drinks`.

- [ ] **Step 1: Replace the single DrinkPicker usage with DrinksEditor + new fields**

```tsx
// client/src/pages/MatchFormPage.tsx — key changes (integrate into the existing form)
// imports:
import { DrinksEditor } from "../components/DrinksEditor";
// option hooks (existing pattern):
const drinkTypes = useOptions("drink_types");
const drinkCategories = useOptions("drink_categories");
const drinkBrands = useOptions("drink_brands");
const drinkNames = useOptions("drink_names");

// in the form state default add: drinks: [] as Drink[]
// add fields near Dato:
<Input label="Tid" type="time" value={form.Tid ?? ""} onChange={(e) => set({ Tid: e.target.value })} />
// near Point:
<Input label="Modstander point" type="number" value={form.Modstander_Point ?? ""} onChange={(e) => set({ Modstander_Point: e.target.value === "" ? undefined : Number(e.target.value) })} />

// replace the <DrinkPicker .../> block with:
<Card>
  <h3 className="mb-2 font-display text-lg">Drikkevarer i denne omgang</h3>
  <DrinksEditor
    value={form.drinks ?? []}
    onChange={(drinks) => set({ drinks })}
    typeOptions={(drinkTypes.data ?? []).map((o) => o.name)}
    categoryOptions={(drinkCategories.data ?? []).map((o) => o.name)}
    brandOptions={(drinkBrands.data ?? []).map((o) => o.name)}
    nameOptions={(drinkNames.data ?? []).map((o) => o.name)}
  />
</Card>

// before submit, client validation:
function validate(): string | null {
  if (!form.Dato) return "Dato er påkrævet";
  if (!form.Spiller) return "Spiller er påkrævet";
  for (const k of ["Point", "Modstander_Point"] as const) {
    const v = form[k];
    if (v != null && (v < 0 || v > 50)) return "Point skal være mellem 0 og 50";
  }
  return null;
}
// in submit(): const err = validate(); if (err) { setError(err); return; }
```
(Remove the now-unused `DrinkPicker` import if nothing else uses it. `DrinkPicker.tsx` and its test may be deleted if unreferenced — grep first.)

- [ ] **Step 2: Verify build + full client suite**

Run: `cd client && npx vitest run` then `npm run build`
Expected: tests pass; build clean. (If `DrinkPicker` was removed, ensure its test file was removed too so the suite stays green.)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/MatchFormPage.tsx
git commit -m "feat(client): match form v2 — drinks list, time, opponent score, validation"
```

---

### Task 4: deriveStats v2 (the analytics core)

**Files:**
- Modify: `client/src/stats/derive.ts`
- Test: `client/src/stats/derive.test.ts` (extend)

**Interfaces:**
- Produces `deriveStats(matches)` returning, in addition to v1 fields:
  - `totalDrinks` (Σ counts across all matches),
  - `byUnitsBucket: { bucket: "0"|"1–2"|"3–4"|"5+", games, winRate, avgMargin }[]`,
  - `byTimeOfDay`, `byWeekday`, `byArena`, `byOpponent`: `{ key, games, winRate, avgMargin }[]`,
  - `consumptionByMonth: { month, units }[]`,
  - `topDrinksByUnits: { name, units }[]`.
- Helper `matchUnits(m)`, `matchMargin(m)`, `timeBucket(tid)`, `weekday(dato)` exported for testing.

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/stats/derive.test.ts — add
import { deriveStats, matchUnits, matchMargin, timeBucket } from "./derive";

const V2 = [
  { id: "1", Dato: "2026-06-01", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 5, Arena: "A", drinks: [] },
  { id: "2", Dato: "2026-06-02", Tid: "19:00", Vundet: false, Point: 8,  Modstander_Point: 13, Arena: "A", drinks: [{ type: "Øl", count: 3 }] },
  { id: "3", Dato: "2026-06-03", Tid: "20:00", Vundet: false, Point: 6,  Modstander_Point: 13, Arena: "B", drinks: [{ type: "Øl", count: 2 }, { type: "Vin", count: 3 }] },
] as any;

describe("deriveStats v2", () => {
  it("computes units and margin helpers", () => {
    expect(matchUnits(V2[2])).toBe(5);
    expect(matchMargin(V2[0])).toBe(8);      // 13 - 5
    expect(timeBucket("10:00")).toBe("morning");
    expect(timeBucket("19:00")).toBe("evening");
  });

  it("buckets win-rate by units drunk", () => {
    const s = deriveStats(V2);
    const zero = s.byUnitsBucket.find((b) => b.bucket === "0")!;
    expect(zero.games).toBe(1);
    expect(zero.winRate).toBe(100);          // the sober game was won
    const five = s.byUnitsBucket.find((b) => b.bucket === "5+")!;
    expect(five.games).toBe(1);
    expect(five.winRate).toBe(0);
    expect(s.totalDrinks).toBe(5);
  });

  it("aggregates by arena with avg margin", () => {
    const s = deriveStats(V2);
    const a = s.byArena.find((x) => x.key === "A")!;
    expect(a.games).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/stats/derive.test.ts`
Expected: FAIL — new fields/helpers missing.

- [ ] **Step 3: Extend `derive.ts`**

```typescript
// client/src/stats/derive.ts — add helpers + fields (keep existing v1 exports)
import type { Match } from "../api/types";

export const matchUnits = (m: Match) => (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
export const matchMargin = (m: Match) =>
  typeof m.Point === "number" && typeof m.Modstander_Point === "number" ? m.Point - m.Modstander_Point : null;

export function timeBucket(tid?: string): "morning" | "afternoon" | "evening" | "night" | "unknown" {
  if (!tid) return "unknown";
  const h = Number(tid.slice(0, 2));
  if (h >= 5 && h <= 11) return "morning";
  if (h >= 12 && h <= 16) return "afternoon";
  if (h >= 17 && h <= 21) return "evening";
  return "night";
}
const WEEKDAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
export const weekday = (dato?: string) => (dato ? WEEKDAYS[new Date(dato + "T00:00:00").getDay()] : "?");

function group(matches: Match[], keyOf: (m: Match) => string) {
  const map = new Map<string, { wins: number; games: number; marginSum: number; marginN: number }>();
  for (const m of matches) {
    const k = keyOf(m);
    if (!k) continue;
    const g = map.get(k) ?? { wins: 0, games: 0, marginSum: 0, marginN: 0 };
    g.games++; if (m.Vundet) g.wins++;
    const mg = matchMargin(m); if (mg !== null) { g.marginSum += mg; g.marginN++; }
    map.set(k, g);
  }
  return [...map.entries()].map(([key, g]) => ({
    key, games: g.games,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}

function unitsBucketLabel(u: number) {
  if (u === 0) return "0";
  if (u <= 2) return "1–2";
  if (u <= 4) return "3–4";
  return "5+";
}

export function deriveStats(matches: Match[]) {
  // ... keep the v1 return object; extend it with the fields below ...
  const totalDrinks = matches.reduce((s, m) => s + matchUnits(m), 0);

  const bucketOrder = ["0", "1–2", "3–4", "5+"];
  const byUnitsBucket = bucketOrder.map((bucket) => {
    const inB = matches.filter((m) => unitsBucketLabel(matchUnits(m)) === bucket);
    const wins = inB.filter((m) => m.Vundet).length;
    const margins = inB.map(matchMargin).filter((x): x is number => x !== null);
    return {
      bucket, games: inB.length,
      winRate: inB.length ? (wins / inB.length) * 100 : 0,
      avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
    };
  });

  const consMap = new Map<string, number>();
  for (const m of matches) {
    const month = (m.Dato ?? "").slice(0, 7);
    if (month) consMap.set(month, (consMap.get(month) ?? 0) + matchUnits(m));
  }
  const consumptionByMonth = [...consMap.entries()].map(([month, units]) => ({ month, units })).sort((a, b) => a.month.localeCompare(b.month));

  const drinkUnits = new Map<string, number>();
  for (const m of matches) for (const d of m.drinks ?? []) {
    const name = d.name || d.brand || d.category || d.type;
    if (name) drinkUnits.set(name, (drinkUnits.get(name) ?? 0) + (d.count ?? 0));
  }
  const topDrinksByUnits = [...drinkUnits.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units).slice(0, 5);

  return {
    // ...v1 fields (total, wins, winRate, totalPoints, longestStreak, topArenas, topDrinks, pointsOverTime)...
    totalDrinks,
    byUnitsBucket,
    byTimeOfDay: group(matches, (m) => timeBucket(m.Tid)),
    byWeekday: group(matches, (m) => weekday(m.Dato)),
    byArena: group(matches, (m) => m.Arena ?? ""),
    byOpponent: group(matches, (m) => m.Modstander ?? ""),
    consumptionByMonth,
    topDrinksByUnits,
  };
}
```
(Merge these into the existing `deriveStats` object rather than replacing the v1 fields the dashboard already uses.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/stats/derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/derive.ts client/src/stats/derive.test.ts
git commit -m "feat(client): deriveStats v2 — units buckets, margin, by time/weekday/arena/opponent, consumption"
```

---

### Task 5: Insights dashboard + player filter

**Files:**
- Modify: `client/src/pages/DashboardPage.tsx`
- Create: `client/src/components/InsightsBar.tsx` (small reusable "key + bar" list)

**Interfaces:**
- Consumes: `deriveStats` v2, `useMatches`, `StatCard`, `Card`, Recharts.
- Produces: a **player filter** (`<select>` of distinct normalized `Spiller` values; "Alle" default) that filters the matches passed to `deriveStats`; new sections: sober-vs-tipsy (win-rate + avg margin per units bucket, bar chart), win-rate by time-of-day / weekday / arena / opponent (InsightsBar lists), consumption-by-month (line/bar), top drinks by units. Keep the v1 stat cards + points-over-time + recent matches.

- [ ] **Step 1: Add the player filter + insights sections**

```tsx
// client/src/pages/DashboardPage.tsx — key additions
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { InsightsBar } from "../components/InsightsBar";

// inside component, after `const { data = [] } = useMatches();`
const [player, setPlayer] = useState("Alle");
const players = useMemo(() => ["Alle", ...Array.from(new Set(data.map((m) => (m.Spiller ?? "").trim()).filter(Boolean)))], [data]);
const filtered = player === "Alle" ? data : data.filter((m) => (m.Spiller ?? "").trim() === player);
const s = deriveStats(filtered);

// render a <select> bound to player/setPlayer (label "Spiller"), then:
// - StatCards row (v1) + a "Drikke i alt" card = s.totalDrinks
// - Sober-vs-tipsy: <ResponsiveContainer><BarChart data={s.byUnitsBucket}><XAxis dataKey="bucket"/><YAxis/><Tooltip/><Bar dataKey="winRate" fill="#C65D3B"/></BarChart></ResponsiveContainer>
//   plus a small table of games / winRate / avgMargin per bucket
// - <InsightsBar title="Sejrsrate efter tidspunkt" rows={s.byTimeOfDay} />
// - <InsightsBar title="Sejrsrate efter ugedag" rows={s.byWeekday} />
// - <InsightsBar title="Bedste baner" rows={s.byArena} />
// - <InsightsBar title="Modstandere" rows={s.byOpponent} />
// - consumption-by-month bar chart (dataKey="units")
// - top drinks by units list (s.topDrinksByUnits)
```

```tsx
// client/src/components/InsightsBar.tsx
import { Card } from "../ui/Card";

type Row = { key: string; games: number; winRate: number; avgMargin: number };

export function InsightsBar({ title, rows }: { title: string; rows: Row[] }) {
  const max = 100;
  return (
    <Card>
      <h3 className="mb-3 font-display text-lg">{title}</h3>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && <li className="text-ink/40">Ingen data endnu</li>}
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex justify-between">
              <span>{r.key}</span>
              <span className="text-ink/60">{r.winRate.toFixed(0)}% · {r.games} kampe · margin {r.avgMargin >= 0 ? "+" : ""}{r.avgMargin.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-ink/10">
              <div className="h-1.5 rounded-full bg-terracotta" style={{ width: `${(r.winRate / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build + full client suite**

Run: `cd client && npx vitest run` then `npm run build`
Expected: tests pass; build clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/DashboardPage.tsx client/src/components/InsightsBar.tsx
git commit -m "feat(client): insights dashboard — sober-vs-tipsy, time/weekday/arena/opponent, consumption, player filter"
```

---

### Task 6: MatchCard v2 (drinks summary + margin)

**Files:**
- Modify: `client/src/components/MatchCard.tsx`

**Interfaces:**
- Produces: MatchCard shows a drinks summary (e.g. "🍺 3 · 🍷 1" or total units) and the score with margin (`13–7`), plus win/loss/group badges as before.

- [ ] **Step 1: Update MatchCard**

```tsx
// client/src/components/MatchCard.tsx — within the card body
// total units:
const units = (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
// score line: show Point–Modstander_Point when opponent score present
<div className="text-sm text-ink/60">
  {m.Dato}{m.Tid ? ` ${m.Tid}` : ""} · {m.Arena} · {m.Point ?? "–"}{typeof m.Modstander_Point === "number" ? `–${m.Modstander_Point}` : ""}
</div>
{units > 0 && <div className="mt-1 text-sm text-bordeaux">🍹 {units} drik{units === 1 ? "" : "ke"}</div>}
```

- [ ] **Step 2: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: pass + clean. (Existing MatchCard has no dedicated test; the dashboard/matches pages consume it — ensure the client suite stays green.)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MatchCard.tsx
git commit -m "feat(client): MatchCard shows drink count + score margin"
```

---

### Task 7: End-to-end local verification + redeploy

**Files:** none (verification + deploy)

**Interfaces:** confirms the v2 stack works locally and ships it to the live Worker.

- [ ] **Step 1: Apply the new migration locally and rebuild**

Run: `npm run db:migrate:local` then `cd client && npm run build`
Expected: migration `0002` applies; client builds to `client/dist`.

- [ ] **Step 2: Run both suites**

Run: `npm test` (root, backend) and `cd client && npm test` (client)
Expected: both green.

- [ ] **Step 3: Smoke-test locally**

Run `npm run dev` (Worker :8787). Then: signup → create a match with two drinks + time + opponent score → GET matches shows nested drinks → GET `/api/export` returns tidy CSV with `Antal`/`Volumen_cl`/`Margin`. Stop the Worker.

- [ ] **Step 4: Deploy (remote migration + deploy)**

Run:
```bash
npm run db:migrate:remote      # applies 0002 to the live D1
cd client && npm run build && cd ..
npx wrangler deploy
```
Expected: deploy succeeds; https://petanque.danielnygaard00.workers.dev serves v2. (JWT_SECRET secret already set.)

- [ ] **Step 5: Commit any config touch-ups**

```bash
git add -A
git commit -m "chore: v2 end-to-end verification + deploy"
```

---

## Self-Review

**Spec coverage:** v2 types (Task 1); multi-drink capture UI (Tasks 2–3); time + opponent score + client validation (Task 3); analytics core — units buckets, margin, by time/weekday/arena/opponent, consumption, top drinks (Task 4); dashboard + player filter (Task 5); MatchCard summary (Task 6); e2e + redeploy incl. remote migration (Task 7). ✅

**Placeholder scan:** Tasks 3, 5, 6 give focused integration snippets against existing files rather than whole-file rewrites (the files already exist from v1); each names the exact edits, new fields, and validation. No "TODO"/"TBD". **Type consistency:** `Drink`, `Match` additions, `deriveStats` v2 field names, `matchUnits`/`matchMargin`/`timeBucket`/`weekday`, `InsightsBar` Row shape are stable across tasks. ✅

**Note:** `deriveStats` v2 EXTENDS the v1 return object (dashboard still reads v1 fields); implementers must merge, not replace. Flagged in Task 4 Step 3.
