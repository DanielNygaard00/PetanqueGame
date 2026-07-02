# v3 Frontend — Signup Code, Player Roster UI & Elo Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the signup-code field, make `Spiller`/`Modstander` pick from the shared roster, compute Elo client-side, and add Rankings + Roster pages with nav.

**Architecture:** Reuses the v2 SPA (React/TS/Tailwind, TanStack Query, Recharts, React Router). New player hooks hit `/api/players`; a pure `elo.ts` computes ratings from the matches already fetched.

**Tech Stack:** React, TypeScript, Tailwind, TanStack Query, Vitest + RTL.

## Global Constraints

- Runs against the v3 backend: signup takes `code`; `/api/players` gives `[{id,name,games}]` with upsert/rename(PATCH)/merge(POST `:id/merge`).
- Danish UI labels; apéro palette. Tests under `client/` (jsdom).
- Elo: base 1000, k 24, provisional < 5 games; eligible = non-group, both players named, `Vundet` boolean; replay ascending by Dato+Tid then index.

---

### Task 1: Signup code field

**Files:**
- Modify: `client/src/pages/SignupPage.tsx`, `client/src/auth/AuthContext.tsx`

**Interfaces:**
- Produces: `signup(username, password?, email?, code?)` sends `code`; the signup form has a "Tilmeldingskode" input.

- [ ] **Step 1: Thread `code` through AuthContext.signup**

```tsx
// client/src/auth/AuthContext.tsx
// widen the signup signature:
signup: (username: string, password?: string, email?: string, code?: string) => Promise<void>;
// implementation:
signup: (username, password, email, code) => authenticate("/auth/signup", { username, password, email, code }),
```
(Update the `AuthValue` type accordingly.)

- [ ] **Step 2: Add the field to SignupPage**

```tsx
// client/src/pages/SignupPage.tsx — add state + input + pass to signup
const [code, setCode] = useState("");
// in the form, before submit button:
<Input label="Tilmeldingskode" value={code} onChange={(e) => setCode(e.target.value)} />
// in submit: await signup(username, password, email, code);
```

- [ ] **Step 3: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: green + clean (LoginPage test unaffected; SignupPage has no dedicated test).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/SignupPage.tsx client/src/auth/AuthContext.tsx
git commit -m "feat(client): signup code field"
```

---

### Task 2: Player hooks + type

**Files:**
- Modify: `client/src/api/types.ts`, `client/src/api/hooks.ts`
- Test: `client/src/api/hooks.test.tsx` (add one)

**Interfaces:**
- Produces: `Player = { id: string; name: string; games: number }`; `usePlayers()`, `useAddPlayer()`, `useRenamePlayer()`, `useMergePlayers()`. Mutations invalidate `["players"]` and `["matches"]`.

- [ ] **Step 1: Add the `Player` type**

```typescript
// client/src/api/types.ts
export type Player = { id: string; name: string; games: number };
```

- [ ] **Step 2: Write the failing test**

```tsx
// client/src/api/hooks.test.tsx — add
import { usePlayers } from "./hooks";
it("fetches players", async () => {
  vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "1", name: "Ida", games: 3 }] } as any);
  const { result } = renderHook(() => usePlayers(), { wrapper });
  await waitFor(() => expect(result.current.data?.[0].name).toBe("Ida"));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/hooks.test.tsx`
Expected: FAIL — `usePlayers` not exported.

- [ ] **Step 4: Add the hooks**

```typescript
// client/src/api/hooks.ts
import type { Player } from "./types";

export function usePlayers() {
  return useQuery({ queryKey: ["players"], queryFn: async () => (await api.get<Player[]>("/players")).data });
}
export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<{ id: string; name: string }>("/players", { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}
export function useRenamePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => (await api.patch(`/players/${id}`, { name })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); qc.invalidateQueries({ queryKey: ["matches"] }); },
  });
}
export function useMergePlayers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, intoId }: { id: string; intoId: string }) => (await api.post(`/players/${id}/merge`, { intoId })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); qc.invalidateQueries({ queryKey: ["matches"] }); },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/hooks.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/types.ts client/src/api/hooks.ts client/src/api/hooks.test.tsx
git commit -m "feat(client): player roster hooks"
```

---

### Task 3: Match form uses the roster for Spiller + Modstander

**Files:**
- Modify: `client/src/pages/MatchFormPage.tsx`

**Interfaces:**
- Consumes: `usePlayers`, `useAddPlayer`.
- Produces: both `Spiller` and `Modstander` are SelectOrAdd backed by the roster names; typing a new name calls `useAddPlayer` (and is used on the match). Replaces the previous `useOptions("players")` for Spiller and the free-text `Modstander` input.

- [ ] **Step 1: Wire the roster**

```tsx
// client/src/pages/MatchFormPage.tsx
const players = usePlayers();
const addPlayer = useAddPlayer();
const playerNames = (players.data ?? []).map((p) => p.name);

// Spiller:
<SelectOrAdd label="Spiller" value={form.Spiller ?? ""} options={playerNames} onChange={(v) => set({ Spiller: v })} onAdd={(v) => addPlayer.mutate(v)} />
// Modstander (was a free Input):
<SelectOrAdd label="Modstander" value={form.Modstander ?? ""} options={playerNames} onChange={(v) => set({ Modstander: v })} onAdd={(v) => addPlayer.mutate(v)} />
```
Remove the old `useOptions("players")` / `addPlayer`-via-options wiring for Spiller and the `<Input label="Modstander" ... />`. (Arena stays on `useOptions("arenas")`.)

- [ ] **Step 2: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: green + clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/MatchFormPage.tsx
git commit -m "feat(client): Spiller + Modstander pick from the shared roster"
```

---

### Task 4: Elo module

**Files:**
- Create: `client/src/stats/elo.ts`
- Test: `client/src/stats/elo.test.ts`

**Interfaces:**
- Produces: `PlayerRating` type and `computeElo(matches, opts?) → PlayerRating[]` (sorted by elo desc).

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/stats/elo.test.ts
import { describe, it, expect } from "vitest";
import { computeElo } from "./elo";

const wins = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: String(i), Dato: `2026-06-${String(i + 1).padStart(2, "0")}`,
  Spiller: "Ida", Modstander: "Bo", Vundet: true, Point: 13, Modstander_Point: 5, Gruppe_Bool: false,
})) as any;

describe("computeElo", () => {
  it("ranks a consistent winner above the loser", () => {
    const r = computeElo(wins(6));
    expect(r[0].name).toBe("Ida");
    expect(r[0].elo).toBeGreaterThan(1000);
    expect(r[1].name).toBe("Bo");
    expect(r[1].elo).toBeLessThan(1000);
    expect(r[0].wins).toBe(6);
    expect(r[1].losses).toBe(6);
    expect(r[0].provisional).toBe(false); // 6 >= 5
    expect(r[0].form).toEqual(["W", "W", "W", "W", "W"]); // last 5
  });

  it("excludes group matches and indecisive results", () => {
    const r = computeElo([
      { id: "1", Dato: "2026-06-01", Spiller: "Ida", Modstander: "Bo", Vundet: true, Gruppe_Bool: true },
      { id: "2", Dato: "2026-06-02", Spiller: "Ida", Modstander: "Bo" },
    ] as any);
    expect(r).toHaveLength(0);
  });

  it("computes avgMargin from each player's perspective", () => {
    const r = computeElo(wins(1));
    const ida = r.find((p) => p.name === "Ida")!;
    const bo = r.find((p) => p.name === "Bo")!;
    expect(ida.avgMargin).toBe(8);   // 13 - 5
    expect(bo.avgMargin).toBe(-8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/stats/elo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `elo.ts`**

```typescript
// client/src/stats/elo.ts
import type { Match } from "../api/types";

export type PlayerRating = {
  name: string; elo: number; games: number; wins: number; losses: number;
  winRate: number; avgMargin: number; form: ("W" | "L")[]; provisional: boolean;
};

export function computeElo(
  matches: Match[],
  opts: { base?: number; k?: number; provisionalGames?: number } = {},
): PlayerRating[] {
  const base = opts.base ?? 1000, k = opts.k ?? 24, provisionalGames = opts.provisionalGames ?? 5;

  const eligible = matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !m.Gruppe_Bool && !!m.Spiller && !!m.Modstander && typeof m.Vundet === "boolean")
    .sort((a, b) => {
      const ka = `${a.m.Dato ?? ""}${a.m.Tid ?? ""}`, kb = `${b.m.Dato ?? ""}${b.m.Tid ?? ""}`;
      return ka === kb ? a.i - b.i : ka < kb ? -1 : 1;
    });

  const S = new Map<string, PlayerRating>();
  const marginSum = new Map<string, number>(), marginN = new Map<string, number>();
  const get = (name: string) => {
    let p = S.get(name);
    if (!p) { p = { name, elo: base, games: 0, wins: 0, losses: 0, winRate: 0, avgMargin: 0, form: [], provisional: true }; S.set(name, p); }
    return p;
  };

  for (const { m } of eligible) {
    const A = get(m.Spiller as string), B = get(m.Modstander as string);
    const scoreA = m.Vundet ? 1 : 0;
    const expA = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
    A.elo += k * (scoreA - expA);
    B.elo += k * ((1 - scoreA) - (1 - expA));
    A.games++; B.games++;
    if (m.Vundet) { A.wins++; B.losses++; } else { A.losses++; B.wins++; }
    A.form.push(m.Vundet ? "W" : "L"); B.form.push(m.Vundet ? "L" : "W");
    if (typeof m.Point === "number" && typeof m.Modstander_Point === "number") {
      const d = m.Point - m.Modstander_Point;
      marginSum.set(A.name, (marginSum.get(A.name) ?? 0) + d); marginN.set(A.name, (marginN.get(A.name) ?? 0) + 1);
      marginSum.set(B.name, (marginSum.get(B.name) ?? 0) - d); marginN.set(B.name, (marginN.get(B.name) ?? 0) + 1);
    }
  }

  return [...S.values()].map((p) => ({
    ...p,
    elo: Math.round(p.elo),
    winRate: p.games ? (p.wins / p.games) * 100 : 0,
    avgMargin: (marginN.get(p.name) ?? 0) ? (marginSum.get(p.name) as number) / (marginN.get(p.name) as number) : 0,
    form: p.form.slice(-5),
    provisional: p.games < provisionalGames,
  })).sort((a, b) => b.elo - a.elo);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/stats/elo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/elo.ts client/src/stats/elo.test.ts
git commit -m "feat(client): Elo rating computation"
```

---

### Task 5: Rankings page + nav

**Files:**
- Create: `client/src/pages/RankingsPage.tsx`
- Modify: `client/src/App.tsx` (route), `client/src/components/Layout.tsx` (nav)

**Interfaces:**
- Consumes: `useMatches`, `computeElo`, `Badge`, `Card`.
- Produces: `/rankings` route rendering a leaderboard (rank · player · Elo · games · W–L · win% · avg margin · form), provisional flagged, empty-state.

- [ ] **Step 1: Write RankingsPage**

```tsx
// client/src/pages/RankingsPage.tsx
import { useMatches } from "../api/hooks";
import { computeElo } from "../stats/elo";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function RankingsPage() {
  const { data = [], isLoading } = useMatches();
  if (isLoading) return <p>Henter…</p>;
  const ratings = computeElo(data);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Rangliste</h2>
      {ratings.length === 0 ? (
        <Card><p className="text-ink/50">Ingen 1-mod-1 kampe endnu — log nogle for at se ratings.</p></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink/60">
              <th className="py-2">#</th><th>Spiller</th><th>Elo</th><th>Kampe</th><th>V–T</th><th>Sejr%</th><th>Margin</th><th>Form</th>
            </tr></thead>
            <tbody>
              {ratings.map((p, i) => (
                <tr key={p.name} className="border-t border-ink/10">
                  <td className="py-2">{i + 1}</td>
                  <td className="font-medium">{p.name} {p.provisional && <Badge tone="group">foreløbig</Badge>}</td>
                  <td className="font-display text-terracotta">{p.elo}</td>
                  <td>{p.games}</td>
                  <td>{p.wins}–{p.losses}</td>
                  <td>{p.winRate.toFixed(0)}%</td>
                  <td>{p.avgMargin >= 0 ? "+" : ""}{p.avgMargin.toFixed(1)}</td>
                  <td className="tracking-wide">{p.form.map((f, j) => <span key={j} className={f === "W" ? "text-olive" : "text-bordeaux"}>{f}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route + nav link**

```tsx
// client/src/App.tsx — inside the protected <Route element={<RequireAuth><Layout/></RequireAuth>}> block
<Route path="/rankings" element={<RankingsPage />} />
// and import RankingsPage
```
```tsx
// client/src/components/Layout.tsx — add to the nav
<Link to="/rankings" className="hover:text-terracotta">Rangliste</Link>
```

- [ ] **Step 3: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: green + clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/RankingsPage.tsx client/src/App.tsx client/src/components/Layout.tsx
git commit -m "feat(client): Elo rankings page + nav"
```

---

### Task 6: Roster page (rename + merge) + nav

**Files:**
- Create: `client/src/pages/RosterPage.tsx`
- Modify: `client/src/App.tsx` (route), `client/src/components/Layout.tsx` (nav)

**Interfaces:**
- Consumes: `usePlayers`, `useRenamePlayer`, `useMergePlayers`, `Card`, `Button`, `Input`.
- Produces: `/roster` route: list players (name + games); inline rename; merge two players (source select + target select → confirm). Mutations refresh via hook invalidation.

- [ ] **Step 1: Write RosterPage**

```tsx
// client/src/pages/RosterPage.tsx
import { useState } from "react";
import { usePlayers, useRenamePlayer, useMergePlayers } from "../api/hooks";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function RosterPage() {
  const { data = [], isLoading } = usePlayers();
  const rename = useRenamePlayer();
  const merge = useMergePlayers();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mergeSrc, setMergeSrc] = useState("");
  const [mergeInto, setMergeInto] = useState("");

  if (isLoading) return <p>Henter…</p>;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Spillere</h2>

      <Card>
        <ul className="divide-y divide-ink/10">
          {data.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              {editing === p.id ? (
                <div className="flex items-center gap-2">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="w-48" />
                  <Button onClick={() => { rename.mutate({ id: p.id, name: draft }); setEditing(null); }}>Gem</Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>Annullér</Button>
                </div>
              ) : (
                <>
                  <span>{p.name} <span className="text-ink/40">· {p.games} kampe</span></span>
                  <Button variant="ghost" onClick={() => { setEditing(p.id); setDraft(p.name); }}>Omdøb</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-display text-lg">Flet spillere</h3>
        <p className="text-sm text-ink/60">Flet en dublet ind i den rigtige spiller (kampe flyttes med).</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Flet<br/>
            <select className="rounded-card border border-ink/15 bg-cream px-2 py-1" value={mergeSrc} onChange={(e) => setMergeSrc(e.target.value)}>
              <option value="">—</option>{data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm">ind i<br/>
            <select className="rounded-card border border-ink/15 bg-cream px-2 py-1" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">—</option>{data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Button
            disabled={!mergeSrc || !mergeInto || mergeSrc === mergeInto}
            onClick={() => { if (confirm("Flet spillere? Dette kan ikke fortrydes.")) { merge.mutate({ id: mergeSrc, intoId: mergeInto }); setMergeSrc(""); setMergeInto(""); } }}
          >Flet</Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Route + nav**

```tsx
// client/src/App.tsx — protected block
<Route path="/roster" element={<RosterPage />} />
// import RosterPage
```
```tsx
// client/src/components/Layout.tsx — nav
<Link to="/roster" className="hover:text-terracotta">Spillere</Link>
```

- [ ] **Step 3: Verify build + suite**

Run: `cd client && npx vitest run && npm run build`
Expected: green + clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/RosterPage.tsx client/src/App.tsx client/src/components/Layout.tsx
git commit -m "feat(client): roster page — rename + merge players"
```

---

### Task 7: End-to-end verify + deploy

**Files:** none (verify + deploy)

- [ ] **Step 1: Local both-suites + build**

Run: `npm test` (backend) and `cd client && npm test` then `npm run build`.
Expected: all green; build clean.

- [ ] **Step 2: Apply migration + set secret + deploy**

```bash
npm run db:migrate:remote                    # applies 0003_players to live D1
npx wrangler secret put SIGNUP_CODE          # set the shared code (interactive)
cd client && npm run build && cd ..
npx wrangler deploy
```
Expected: deploy succeeds at https://petanque.danielnygaard00.workers.dev.

- [ ] **Step 3: Live smoke test**

- Signup WITHOUT code → 403; WITH the code → 201.
- Create two 1v1 matches (Ida beats Bo twice) → `/rankings` shows Ida above Bo.
- `/roster` lists Ida + Bo with game counts; rename/merge work.

- [ ] **Step 4: Commit any config touch-ups**

```bash
git add -A && git commit -m "chore: v3 end-to-end verify + deploy"
```

---

## Self-Review

**Spec coverage:** signup code field (Task 1); player hooks + type (Task 2); Spiller+Modstander roster pickers (Task 3); Elo module (Task 4); Rankings page + nav (Task 5); Roster rename/merge page + nav (Task 6); e2e + migration + `SIGNUP_CODE` secret + deploy (Task 7). ✅

**Placeholder scan:** Tasks 1/3/5/6 give focused edits against existing files (they already exist from v1/v2) with exact code for new files (`elo.ts`, pages) and named edits elsewhere. No "TODO/TBD". **Type consistency:** `Player`, `PlayerRating`, hook names, and the `computeElo` signature are stable across tasks. `avgMargin` sign convention (Spiller perspective; opponent inverse) matches the backend margin definition and the spec.

**Note:** `RankingsPage`/`RosterPage` have no dedicated RTL tests (the brief does not mandate them); the load-bearing logic is `elo.ts` (Task 4, fully tested) and the player endpoints (backend plan). Pages are thin view wiring verified by build + manual smoke (Task 7).
