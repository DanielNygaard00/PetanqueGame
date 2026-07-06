# Match Players Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 1v1 match columns with a `match_players` participant table so team and N-way games are first-class, drinks are attributed to players, and every game feeds the Elo rankings.

**Architecture:** A new `match_players` table (team index + per-team score, one row per player) becomes the single source of truth for participants. The `matches` table is slimmed to scalar metadata; group-ness and winners are derived. Drinks gain a nullable `player_id`. The API accepts a `teams[]` body and returns reconstructed teams. The client form becomes a teams editor, and the stats layer is re-centered on a per-player "perspective" so 1v1, team, and N-way games all produce win/loss, margin, and Elo.

**Tech Stack:** Cloudflare Workers + Hono + D1 (SQLite) backend; Vite + React + TanStack Query + Recharts frontend. Vitest (Workers pool for backend, jsdom for frontend).

## Global Constraints

- Backend tests live in `test/**/*.test.ts` and run via `npm test` (Workers pool, migrations auto-applied from `migrations/`).
- Frontend tests live in `client/src/**/*.test.{ts,tsx}` and run via `cd client && npm test`.
- Player names are resolved case-insensitively and de-duplicated through `upsertPlayer` (existing, in `src/players.ts`).
- Danish UI copy (existing convention): keep labels Danish (`Hold`, `Point`, `Spiller`, `Vundet`).
- Scores are integers 0–50 or null (unknown).
- Every participant must be a real `players` row; opponents are never free text under the new model.
- Frequent commits: one commit per task minimum.

---

## Phase 1 — Backend data model & API

### Task 1: Migration 0004 — schema change

**Files:**
- Create: `migrations/0004_match_players.sql`
- Test: `test/schema.test.ts`

**Interfaces:**
- Produces: table `match_players(id, match_id, player_id, team, score, position)`; column `match_drinks.player_id`; `matches` no longer has `is_group, group_members, player, opponent, won, points, opponent_points`.

- [ ] **Step 1: Write the failing test**

```ts
// test/schema.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema 0004", () => {
  it("has match_players and drink attribution, and drops flat match columns", async () => {
    const mp = await env.DB.prepare("PRAGMA table_info(match_players)").all();
    const mpCols = (mp.results as { name: string }[]).map((r) => r.name).sort();
    expect(mpCols).toEqual(["id", "match_id", "player_id", "position", "score", "team"].sort());

    const md = await env.DB.prepare("PRAGMA table_info(match_drinks)").all();
    expect((md.results as { name: string }[]).some((r) => r.name === "player_id")).toBe(true);

    const m = await env.DB.prepare("PRAGMA table_info(matches)").all();
    const mCols = (m.results as { name: string }[]).map((r) => r.name);
    for (const gone of ["is_group", "group_members", "player", "opponent", "won", "points", "opponent_points"]) {
      expect(mCols).not.toContain(gone);
    }
    expect(mCols).toContain("date");
    expect(mCols).toContain("arena");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- schema`
Expected: FAIL (no `match_players` table).

- [ ] **Step 3: Write the migration**

```sql
-- migrations/0004_match_players.sql
CREATE TABLE match_players (
  id        TEXT PRIMARY KEY,
  match_id  TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team      INTEGER NOT NULL,
  score     INTEGER,
  position  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_player_id ON match_players(player_id);

ALTER TABLE match_drinks ADD COLUMN player_id TEXT;

ALTER TABLE matches DROP COLUMN is_group;
ALTER TABLE matches DROP COLUMN group_members;
ALTER TABLE matches DROP COLUMN player;
ALTER TABLE matches DROP COLUMN opponent;
ALTER TABLE matches DROP COLUMN won;
ALTER TABLE matches DROP COLUMN points;
ALTER TABLE matches DROP COLUMN opponent_points;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- schema`
Expected: PASS.

- [ ] **Step 5: Apply migration to the local dev DB**

Run: `npm run db:migrate:local`
Expected: `0004_match_players.sql` applied.

- [ ] **Step 6: Commit**

```bash
git add migrations/0004_match_players.sql test/schema.test.ts
git commit -m "feat(db): match_players table, drink attribution, slim matches (0004)"
```

---

### Task 2: `mapping.ts` — slim scalar mapping

**Files:**
- Modify: `src/mapping.ts` (full rewrite)
- Test: `test/mapping.test.ts` (rewrite)

**Interfaces:**
- Produces: `toRow(body) -> { date?, time?, arena?, consecutive_games?, game_items? }`; `toApi(row) -> { id, Dato?, Tid?, Arena?, "Konsekutive spil"?, "Spillets genstande"? }`; `MATCH_COLUMNS: string[]`.

- [ ] **Step 1: Rewrite the test**

```ts
// test/mapping.test.ts
import { describe, it, expect } from "vitest";
import { toRow, toApi } from "../src/mapping";

describe("mapping", () => {
  it("maps api keys to slim columns", () => {
    expect(toRow({ Dato: "2026-07-01", Tid: "18:00", Arena: "Park", "Spillets genstande": "n" }))
      .toEqual({ date: "2026-07-01", time: "18:00", arena: "Park", game_items: "n" });
  });
  it("ignores unknown keys (teams/drinks handled elsewhere)", () => {
    expect(toRow({ Dato: "2026-07-01", teams: [], drinks: [] })).toEqual({ date: "2026-07-01" });
  });
  it("maps columns back to api keys", () => {
    expect(toApi({ id: "x", date: "2026-07-01", arena: "Park" }))
      .toEqual({ id: "x", Dato: "2026-07-01", Arena: "Park" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mapping`
Expected: FAIL (old bool-column behavior).

- [ ] **Step 3: Rewrite `src/mapping.ts`**

```ts
// src/mapping.ts
const KEY_TO_COL: Record<string, string> = {
  Dato: "date",
  Tid: "time",
  Arena: "arena",
  "Konsekutive spil": "consecutive_games",
  "Spillets genstande": "game_items",
};
const COL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_COL).map(([k, v]) => [v, k]),
);

export const MATCH_COLUMNS = Object.keys(KEY_TO_COL);

export function toRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(KEY_TO_COL)) {
    if (!(key in body)) continue;
    row[col] = body[key];
  }
  return row;
}

export function toApi(row: Record<string, unknown>): Record<string, unknown> {
  const api: Record<string, unknown> = { id: row.id };
  for (const [col, key] of Object.entries(COL_TO_KEY)) {
    if (!(col in row) || row[col] === null || row[col] === undefined) continue;
    api[key] = row[col];
  }
  return api;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mapping`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mapping.ts test/mapping.test.ts
git commit -m "refactor(api): slim match mapping to scalar columns"
```

---

### Task 3: `validate.ts` — teams-shaped validation

**Files:**
- Modify: `src/validate.ts` (full rewrite)
- Test: `test/validate.test.ts` (rewrite)

**Interfaces:**
- Consumes: request body `{ Dato, teams: {score?, players: string[]}[], drinks?: {count?, player?}[] }`.
- Produces: `validateMatch(body) -> string | null`.

- [ ] **Step 1: Rewrite the test**

```ts
// test/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateMatch } from "../src/validate";

const base = { Dato: "2026-07-01", teams: [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Bo"] }] };

describe("validateMatch", () => {
  it("accepts a valid match", () => { expect(validateMatch(base)).toBeNull(); });
  it("requires Dato", () => { expect(validateMatch({ ...base, Dato: "" })).toMatch(/Dato/); });
  it("requires at least two teams", () => {
    expect(validateMatch({ Dato: "x", teams: [{ score: 1, players: ["Ida"] }] })).toMatch(/two teams/);
  });
  it("requires each team to have a player", () => {
    expect(validateMatch({ Dato: "x", teams: [{ players: ["Ida"] }, { players: [] }] })).toMatch(/at least one player/);
  });
  it("rejects out-of-range scores", () => {
    expect(validateMatch({ Dato: "x", teams: [{ score: 99, players: ["Ida"] }, { players: ["Bo"] }] })).toMatch(/0\.\.50/);
  });
  it("rejects bad drink count", () => {
    expect(validateMatch({ ...base, drinks: [{ count: 0 }] })).toMatch(/drink count/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validate`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/validate.ts`**

```ts
// src/validate.ts
export function validateMatch(body: Record<string, any>): string | null {
  if (!body?.Dato) return "Dato is required";
  const teams = body?.teams;
  if (!Array.isArray(teams) || teams.length < 2) return "At least two teams are required";
  for (const t of teams) {
    const players = Array.isArray(t?.players)
      ? t.players.filter((p: unknown) => typeof p === "string" && p.trim() !== "")
      : [];
    if (players.length < 1) return "Each team needs at least one player";
    const s = t?.score;
    if (s !== undefined && s !== null && s !== "") {
      if (!Number.isInteger(s) || s < 0 || s > 50) return "score must be an integer 0..50";
    }
  }
  if (Array.isArray(body.drinks)) {
    for (const d of body.drinks) {
      if (d.count !== undefined && (!Number.isInteger(d.count) || d.count < 1)) {
        return "drink count must be an integer >= 1";
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validate.ts test/validate.test.ts
git commit -m "feat(api): validate teams-shaped match body"
```

---

### Task 4: `matches.ts` — participant-aware CRUD

**Files:**
- Modify: `src/matches.ts` (full rewrite)
- Modify: `test/matches.test.ts` (rewrite to teams shape)

**Interfaces:**
- Consumes: `toRow`, `toApi` (Task 2); `validateMatch` (Task 3); `upsertPlayer` (`src/players.ts`); `drinkToRow`, `drinkToApi` (`src/drinks.ts`).
- Produces: API match object `{ id, Dato?, Tid?, Arena?, "Konsekutive spil"?, "Spillets genstande"?, teams: {team, score, won, players:{id,name}[]}[], drinks: (ApiDrink & {player: string|null})[] }`.

- [ ] **Step 1: Rewrite the test**

```ts
// test/matches.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM match_drinks");
  await env.DB.exec("DELETE FROM match_players");
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM players");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Ida", code: "test-code" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

const twoTeam = {
  Dato: "2026-07-01", Tid: "18:30",
  teams: [{ score: 13, players: ["Ida"] }, { score: 7, players: ["Bo"] }],
};

describe("matches CRUD (participants)", () => {
  it("creates a match with teams and derives the winner", async () => {
    const res = await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify(twoTeam) }, env);
    expect(res.status).toBe(201);
    const m = await res.json();
    expect(m.teams).toHaveLength(2);
    expect(m.teams[0]).toMatchObject({ team: 0, score: 13, won: true });
    expect(m.teams[0].players[0].name).toBe("Ida");
    expect(m.teams[1].won).toBe(false);
  });

  it("supports N-way games and drink attribution", async () => {
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({
        Dato: "2026-07-02",
        teams: [{ score: 11, players: ["Ida"] }, { score: 5, players: ["Bo"] }, { score: 0, players: ["Cy"] }],
        drinks: [{ type: "Øl", count: 1, player: "Ida" }, { type: "Øl", count: 1 }],
      }),
    }, env);
    const m = await res.json();
    expect(m.teams).toHaveLength(3);
    expect(m.teams[0].won).toBe(true);
    expect(m.drinks[0].player).toBe("Ida");
    expect(m.drinks[1].player).toBeNull();
  });

  it("registers all participants in the roster", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify(twoTeam) }, env);
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(players.map((p: any) => p.name).sort()).toEqual(["Bo", "Ida"]);
  });

  it("updates teams and drinks, then deletes with cascade", async () => {
    const created = await (await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify(twoTeam) }, env)).json();
    const upd = await app.request(`/api/matches/${created.id}`, {
      method: "PUT", headers: H(),
      body: JSON.stringify({ teams: [{ score: 3, players: ["Ida"] }, { score: 13, players: ["Bo"] }] }),
    }, env);
    const m = await upd.json();
    expect(m.teams[1].won).toBe(true);

    await app.request(`/api/matches/${created.id}`, { method: "DELETE", headers: H() }, env);
    const mp = await env.DB.prepare("SELECT COUNT(*) AS n FROM match_players WHERE match_id = ?").bind(created.id).first();
    expect(mp.n).toBe(0);
  });

  it("400s a match with fewer than two teams", async () => {
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", teams: [{ players: ["Ida"] }] }),
    }, env);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- matches`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/matches.ts`**

```ts
// src/matches.ts
import { Hono } from "hono";
import type { AppContext } from "./types";
import { toRow, toApi } from "./mapping";
import { drinkToRow, drinkToApi } from "./drinks";
import { validateMatch } from "./validate";
import { upsertPlayer } from "./players";

const matches = new Hono<AppContext>();

async function insertParticipants(db: D1Database, matchId: string, teams: any[]) {
  let pos = 0;
  for (let t = 0; t < teams.length; t++) {
    const score = teams[t]?.score ?? null;
    for (const rawName of teams[t]?.players ?? []) {
      const p = await upsertPlayer(db, rawName);
      if (!p) continue;
      await db.prepare(
        "INSERT INTO match_players (id, match_id, player_id, team, score, position) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(crypto.randomUUID(), matchId, p.id, t, score, pos++).run();
    }
  }
}

async function insertDrinks(db: D1Database, matchId: string, drinks: any[]) {
  for (let i = 0; i < drinks.length; i++) {
    const d = drinks[i];
    const pid = d?.player ? (await upsertPlayer(db, d.player))?.id ?? null : null;
    const r = drinkToRow(d, matchId, i);
    await db.prepare(
      `INSERT INTO match_drinks (id, match_id, drink_type, drink_category, drink_brand, drink_name, drink_country, wine_region, count, volume_cl, position, player_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(r.id, r.match_id, r.drink_type, r.drink_category, r.drink_brand, r.drink_name, r.drink_country, r.wine_region, r.count, r.volume_cl, r.position, pid).run();
  }
}

async function teamsFor(db: D1Database, matchId: string) {
  const { results } = await db.prepare(
    `SELECT mp.team AS team, mp.score AS score, mp.position AS position, p.id AS player_id, p.name AS name
     FROM match_players mp JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id = ? ORDER BY mp.team, mp.position`,
  ).bind(matchId).all();
  const map = new Map<number, { team: number; score: number | null; players: { id: string; name: string }[] }>();
  for (const r of results as any[]) {
    if (!map.has(r.team)) map.set(r.team, { team: r.team, score: r.score ?? null, players: [] });
    map.get(r.team)!.players.push({ id: r.player_id, name: r.name });
  }
  const teams = [...map.values()].sort((a, b) => a.team - b.team);
  const scores = teams.map((t) => t.score).filter((s): s is number => typeof s === "number");
  const max = scores.length ? Math.max(...scores) : null;
  return teams.map((t) => ({ ...t, won: max !== null && t.score === max }));
}

async function drinksFor(db: D1Database, matchId: string) {
  const { results } = await db.prepare(
    `SELECT md.*, p.name AS player_name FROM match_drinks md
     LEFT JOIN players p ON p.id = md.player_id
     WHERE md.match_id = ? ORDER BY md.position`,
  ).bind(matchId).all();
  return (results as any[]).map((r) => ({ ...drinkToApi(r), player: r.player_name ?? null }));
}

async function matchWithDetails(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM matches WHERE id = ?").bind(id).first();
  const api = toApi(row as Record<string, unknown>);
  api.teams = await teamsFor(db, id);
  api.drinks = await drinksFor(db, id);
  return api;
}

matches.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const err = validateMatch(body);
  if (err) return c.json({ message: err }, 400);
  const row = toRow(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cols = ["id", "created_by", "created_at", ...Object.keys(row)];
  const vals = [id, c.get("userId"), now, ...Object.values(row)];
  await c.env.DB.prepare(
    `INSERT INTO matches (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  ).bind(...vals).run();
  await insertParticipants(c.env.DB, id, Array.isArray(body.teams) ? body.teams : []);
  await insertDrinks(c.env.DB, id, Array.isArray(body.drinks) ? body.drinks : []);
  return c.json(await matchWithDetails(c.env.DB, id), 201);
});

matches.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM matches ORDER BY date DESC, time DESC").all();
  const out = [];
  for (const r of results) {
    const api = toApi(r as Record<string, unknown>);
    api.teams = await teamsFor(c.env.DB, api.id as string);
    api.drinks = await drinksFor(c.env.DB, api.id as string);
    out.push(api);
  }
  return c.json(out);
});

matches.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const row = toRow(body);
  row.updated_at = new Date().toISOString();
  const assignments = Object.keys(row).map((k) => `${k} = ?`).join(", ");
  if (Object.keys(row).length) {
    await c.env.DB.prepare(`UPDATE matches SET ${assignments} WHERE id = ?`).bind(...Object.values(row), id).run();
  }
  if (Array.isArray(body.teams)) {
    await c.env.DB.prepare("DELETE FROM match_players WHERE match_id = ?").bind(id).run();
    await insertParticipants(c.env.DB, id, body.teams);
  }
  if (Array.isArray(body.drinks)) {
    await c.env.DB.prepare("DELETE FROM match_drinks WHERE match_id = ?").bind(id).run();
    await insertDrinks(c.env.DB, id, body.drinks);
  }
  return c.json(await matchWithDetails(c.env.DB, id));
});

matches.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM match_drinks WHERE match_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM match_players WHERE match_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(id).run();
  return c.json({ message: "Match entry deleted" });
});

export default matches;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- matches`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches.ts test/matches.test.ts
git commit -m "feat(api): participant-aware match CRUD with derived winners"
```

---

### Task 5: `players.ts` — id-based rename/merge & games count

**Files:**
- Modify: `src/players.ts` (rewrite the GET, PATCH, merge handlers; keep `upsertPlayer`)
- Modify: `test/players.test.ts` (rewrite to participant model)

**Interfaces:**
- Consumes: `match_players.player_id`, `match_drinks.player_id`.
- Produces: unchanged HTTP contract — `GET /` returns `{id,name,games}[]`; `PATCH /:id` renames or merges by name collision; `POST /:id/merge` merges into `intoId`.

- [ ] **Step 1: Rewrite the test**

```ts
// test/players.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM match_drinks");
  await env.DB.exec("DELETE FROM match_players");
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM players");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Ida", code: "test-code" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

async function logMatch(a: string, b: string) {
  return (await app.request("/api/matches", {
    method: "POST", headers: H(),
    body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: [a] }, { score: 5, players: [b] }] }),
  }, env)).json();
}

describe("players", () => {
  it("counts games from match_players", async () => {
    await logMatch("Ida", "Bo");
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bo = players.find((p: any) => p.name === "Bo");
    expect(bo.games).toBe(1);
  });

  it("renames a player and match_players follow via id", async () => {
    await logMatch("Ida", "Bo");
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bo = players.find((p: any) => p.name === "Bo");
    await app.request(`/api/players/${bo.id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ name: "Bob" }) }, env);
    const after = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(after.find((p: any) => p.name === "Bob").games).toBe(1);
    expect(after.some((p: any) => p.name === "Bo")).toBe(false);
  });

  it("merges two players, repointing participants and drinks", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Ras"] }],
        drinks: [{ type: "Øl", count: 1, player: "Ras" }] }),
    }, env);
    await logMatch("Ida", "Rasmus");
    let players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const ras = players.find((p: any) => p.name === "Ras");
    const rasmus = players.find((p: any) => p.name === "Rasmus");
    await app.request(`/api/players/${ras.id}/merge`, { method: "POST", headers: H(), body: JSON.stringify({ intoId: rasmus.id }) }, env);
    players = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(players.some((p: any) => p.name === "Ras")).toBe(false);
    expect(players.find((p: any) => p.name === "Rasmus").games).toBe(2);
    const drink = await env.DB.prepare("SELECT player_id FROM match_drinks LIMIT 1").first<{ player_id: string }>();
    expect(drink!.player_id).toBe(rasmus.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- players`
Expected: FAIL.

- [ ] **Step 3: Rewrite the handlers in `src/players.ts`** (keep `upsertPlayer` as-is; replace `players.get`, `players.patch`, `players.post("/:id/merge")`)

```ts
players.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name FROM players ORDER BY name").all();
  const out = [];
  for (const p of results as { id: string; name: string }[]) {
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM match_players WHERE player_id = ?").bind(p.id).first<{ n: number }>();
    out.push({ id: p.id, name: p.name, games: row?.n ?? 0 });
  }
  return c.json(out);
});

players.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const newName = (((await c.req.json().catch(() => ({}))).name ?? "") as string).trim();
  if (!newName) return c.json({ message: "Name required" }, 400);
  const player = await c.env.DB.prepare("SELECT id, name FROM players WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!player) return c.json({ message: "Not found" }, 404);
  const { results } = await c.env.DB.prepare("SELECT id, name FROM players").all();
  const target = (results as { id: string; name: string }[]).find((r) => r.name.toLowerCase() === newName.toLowerCase() && r.id !== id);
  if (target) {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE match_players SET player_id = ? WHERE player_id = ?").bind(target.id, id),
      c.env.DB.prepare("UPDATE match_drinks SET player_id = ? WHERE player_id = ?").bind(target.id, id),
      c.env.DB.prepare("DELETE FROM players WHERE id = ?").bind(id),
    ]);
    return c.json({ id: target.id, name: target.name });
  }
  await c.env.DB.prepare("UPDATE players SET name = ? WHERE id = ?").bind(newName, id).run();
  return c.json({ id, name: newName });
});

players.post("/:id/merge", async (c) => {
  const id = c.req.param("id");
  const { intoId } = await c.req.json().catch(() => ({}));
  const source = await c.env.DB.prepare("SELECT id, name FROM players WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  const target = await c.env.DB.prepare("SELECT id, name FROM players WHERE id = ?").bind(intoId).first<{ id: string; name: string }>();
  if (!source || !target) return c.json({ message: "Not found" }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE match_players SET player_id = ? WHERE player_id = ?").bind(target.id, source.id),
    c.env.DB.prepare("UPDATE match_drinks SET player_id = ? WHERE player_id = ?").bind(target.id, source.id),
    c.env.DB.prepare("DELETE FROM players WHERE id = ?").bind(source.id),
  ]);
  return c.json({ id: target.id, name: target.name });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- players`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/players.ts test/players.test.ts
git commit -m "feat(api): id-based roster rename/merge and match_players game counts"
```

---

### Task 6: `export.ts` — CSV from participants

**Files:**
- Modify: `src/export.ts` (full rewrite)
- Modify: `test/export.test.ts` (rewrite assertions to new headers)

**Interfaces:**
- Consumes: `match_players`, `match_drinks.player_id`, `toApi`.
- Produces: CSV, one row per participant, headers `Dato, Tid, Arena, Hold, Spiller, Point, Vundet, Modstandere, Konsekutive spil, Spillets genstande, Drikke`.

- [ ] **Step 1: Rewrite the test**

```ts
// test/export.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM match_drinks");
  await env.DB.exec("DELETE FROM match_players");
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM players");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Ida", code: "test-code" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

describe("export", () => {
  it("exports one row per participant with opponents and drinks", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Bo"] }],
        drinks: [{ name: "Grøn", count: 2, player: "Ida" }] }),
    }, env);
    const res = await app.request("/api/export", { headers: H() }, env);
    const csv = await res.text();
    expect(csv).toContain("Dato,Tid,Arena,Hold,Spiller,Point,Vundet,Modstandere");
    expect(csv).toContain("Ida");
    expect(csv).toContain("Bo");
    expect(csv).toContain("2× Grøn");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- export`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/export.ts`**

```ts
// src/export.ts
import { Hono } from "hono";
import type { AppContext } from "./types";
import { toApi } from "./mapping";
import { toCsv } from "./csv";

const exportRoute = new Hono<AppContext>();

const HEADERS = ["Dato", "Tid", "Arena", "Hold", "Spiller", "Point", "Vundet", "Modstandere", "Konsekutive spil", "Spillets genstande", "Drikke"];
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

exportRoute.get("/", async (c) => {
  const { results: matchRows } = await c.env.DB.prepare("SELECT * FROM matches ORDER BY date ASC, time ASC").all();
  const rows: string[][] = [];
  for (const r of matchRows) {
    const m = toApi(r as Record<string, unknown>);
    const { results: parts } = await c.env.DB.prepare(
      `SELECT mp.team AS team, mp.score AS score, p.id AS player_id, p.name AS name
       FROM match_players mp JOIN players p ON p.id = mp.player_id WHERE mp.match_id = ? ORDER BY mp.team, mp.position`,
    ).bind(m.id).all();
    const scores = (parts as any[]).map((x) => x.score).filter((x) => typeof x === "number");
    const max = scores.length ? Math.max(...scores) : null;
    const { results: drinkRows } = await c.env.DB.prepare(
      "SELECT drink_name, drink_brand, drink_type, count, player_id FROM match_drinks WHERE match_id = ? ORDER BY position",
    ).bind(m.id).all();
    for (const part of parts as any[]) {
      const opponents = (parts as any[]).filter((x) => x.team !== part.team).map((x) => x.name).join(", ");
      const drinks = (drinkRows as any[])
        .filter((d) => d.player_id === part.player_id)
        .map((d) => `${d.count}× ${d.drink_name || d.drink_brand || d.drink_type || "?"}`)
        .join("; ");
      rows.push([
        s(m.Dato), s(m.Tid), s(m.Arena), s(part.team + 1), s(part.name), s(part.score),
        part.score != null && part.score === max ? "1" : "", opponents,
        s(m["Konsekutive spil"]), s(m["Spillets genstande"]), drinks,
      ]);
    }
  }
  const csv = "﻿" + toCsv(HEADERS, rows);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=petanque_data.csv" },
  });
});

export default exportRoute;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- export`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `npm test`
Expected: all backend tests PASS. (If `test/drinks.test.ts` references removed match columns, it will still pass — `drinkToRow`/`drinkToApi` are unchanged. If any残 stale test references `Spiller`/`Point` at the DB level, update it to the teams shape.)

- [ ] **Step 6: Commit**

```bash
git add src/export.ts test/export.test.ts
git commit -m "feat(api): CSV export from participant model"
```

---

## Phase 2 — Backfill existing games

### Task 7: Backfill the six seeded games

**Files:**
- Create: `scripts/backfill_participants.sql`

**Context:** The six live games currently have data in the now-dropped flat columns. After migration 0004 those columns are gone, so the backfill is written from ground truth and keyed on `(date, time)`. It (a) inserts `match_players` rows, (b) sets `match_drinks.player_id`. Players `Daniel, Rasmus, Marcus, Søren, Will` already exist in the roster (created during seeding); the backfill looks them up by name.

**Ground truth (from the original log):**

| date | time | team 0 (score) | team 1 (score) | team 2 (score) |
|------|------|---------------|----------------|----------------|
| 2026-04-12 | 18:00 | Daniel (22) | Rasmus (5) | — |
| 2026-04-12 | 18:30 | Daniel (22) | Rasmus (10) | — |
| 2026-04-12 | 19:00 | Daniel (22) | Rasmus (12) | — |
| 2026-04-22 | 18:00 | Daniel, Rasmus (18) | Marcus, Søren (21) | — |
| 2026-04-22 | 18:45 | Daniel (11) | Marcus (0) | Rasmus (5) |
| 2026-04-22 | 19:30 | Daniel, Marcus (11) | Rasmus, Søren, Will (4) | — |

Drink attribution (match_drinks currently carry a `position`; set `player_id` per position — see the original seed order):
- 12 apr 18:00: pos 0 → Daniel, pos 1 → Rasmus.
- 12 apr 18:30 / 19:00: single "Brun ×2" drink (pos 0) — leave unassigned (shared).
- 22 apr 18:00: pos 0 (Year of the Lager) → Daniel, pos 1 (Brun) → Daniel, pos 2 (Tuborg Classic ×3) → unassigned (shared across Rasmus/Marcus/Søren).
- 22 apr 18:45: pos 0 (Brun 16.6cl) → Daniel, pos 1 (Grøn 10cl) → Marcus.
- 22 apr 19:30: pos 0 (Grøn 47.5) → Daniel, pos 1 (Grøn 47.5) → Marcus, pos 2 (Grøn ×1) → Rasmus, pos 3 (Grøn ×2) → Søren, pos 4 (Staropramen) → Will, pos 5 (Brun) → Will.

- [ ] **Step 1: Write `scripts/backfill_participants.sql`**

```sql
-- scripts/backfill_participants.sql
-- One-time backfill of the six seeded games onto the participant model.
-- Idempotent: clears any prior participant rows for these matches first.

-- Helper CTE-free approach: delete then re-insert per (date,time) match.
DELETE FROM match_players WHERE match_id IN (SELECT id FROM matches WHERE date IN ('2026-04-12','2026-04-22'));

-- 2026-04-12 18:00  Daniel 22 vs Rasmus 5
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 22, 0 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 5, 1 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:00';

-- 2026-04-12 18:30  Daniel 22 vs Rasmus 10
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 22, 0 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 10, 1 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:30';

-- 2026-04-12 19:00  Daniel 22 vs Rasmus 12
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 22, 0 FROM matches m WHERE m.date='2026-04-12' AND m.time='19:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 12, 1 FROM matches m WHERE m.date='2026-04-12' AND m.time='19:00';

-- 2026-04-22 18:00  Daniel+Rasmus 18 vs Marcus+Søren 21
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 18, 0 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 0, 18, 1 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Marcus'), 1, 21, 2 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Søren'), 1, 21, 3 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';

-- 2026-04-22 18:45  Daniel 11 vs Marcus 0 vs Rasmus 5 (three-way)
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 11, 0 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:45';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Marcus'), 1, 0, 1 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:45';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 2, 5, 2 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:45';

-- 2026-04-22 19:30  Daniel+Marcus 11 vs Rasmus+Søren+Will 4
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 11, 0 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Marcus'), 0, 11, 1 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 4, 2 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Søren'), 1, 4, 3 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Will'), 1, 4, 4 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';

-- Drink attribution by (match, position)
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-12' AND time='18:00') AND position=0;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Rasmus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-12' AND time='18:00') AND position=1;

UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='18:00') AND position IN (0,1);

UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='18:45') AND position=0;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Marcus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='18:45') AND position=1;

UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=0;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Marcus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=1;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Rasmus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=2;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Søren')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=3;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Will')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position IN (4,5);
```

- [ ] **Step 2: Apply the migration remotely first (structure), then backfill locally to verify**

Run: `npm run db:migrate:remote`
Then: `npx wrangler d1 execute petanque --local --file scripts/backfill_participants.sql`
Expected: no errors. (Local matches must exist — if the local DB has no seeded games, this is a no-op locally; the authoritative run is remote in Step 4.)

- [ ] **Step 3: Verify counts locally (optional if local has data)**

Run: `npx wrangler d1 execute petanque --local --json --command "SELECT COUNT(*) n FROM match_players;"`
Expected: **18** participant rows if the six games are present locally (2+2+2+4+3+5 = 18). If the local DB has no seeded games this is 0 — the authoritative run is remote in Step 4.

- [ ] **Step 4: Apply the backfill to the remote (production) DB**

Run: `npx wrangler d1 execute petanque --remote --file scripts/backfill_participants.sql`
Then verify: `npx wrangler d1 execute petanque --remote --json --command "SELECT COUNT(*) n FROM match_players;"`
Expected: `n` = 18.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill_participants.sql
git commit -m "chore(db): backfill six seeded games onto participant model"
```

---

## Phase 3 — Client types

### Task 8: Client `Match`/`Drink` types

**Files:**
- Modify: `client/src/api/types.ts`

**Interfaces:**
- Produces: `Team = { team: number; score: number | null; won: boolean; players: { id: string; name: string }[] }`; `Match` gains `teams?: Team[]`; `Drink` gains `player?: string | null`.

- [ ] **Step 1: Edit `client/src/api/types.ts`** — replace the `Drink` and `Match` types

```ts
export type Drink = {
  type?: string | null;
  category?: string | null;
  brand?: string | null;
  name?: string | null;
  country?: string | null;
  wineRegion?: string | null;
  count?: number;
  volumeCl?: number | null;
  player?: string | null;
};

export type TeamPlayer = { id: string; name: string };
export type Team = { team: number; score: number | null; won: boolean; players: TeamPlayer[] };

export type Match = {
  id: string;
  Dato?: string;
  Tid?: string;
  Arena?: string;
  "Konsekutive spil"?: number;
  "Spillets genstande"?: string;
  teams?: Team[];
  drinks?: Drink[];
};
```

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: errors in `stats/*`, `pages/*`, `components/*` that reference removed fields (`Spiller`, `Point`, etc.). These are fixed in Tasks 9–17. Note the list; do not fix yet.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/types.ts
git commit -m "feat(client): participant-based Match and Drink types"
```

---

## Phase 4 — Client stats

### Task 9: `perspective.ts` — per-player view of a match

**Files:**
- Create: `client/src/stats/perspective.ts`
- Test: `client/src/stats/perspective.test.ts`

**Interfaces:**
- Produces: `matchPerspective(m, viewer) -> { won: boolean|null; myScore: number|null; oppScore: number|null; teammates: string[]; opponents: string[] } | null`; `isGroup(m) -> boolean`; `matchUnits(m) -> number`.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/stats/perspective.test.ts
import { describe, it, expect } from "vitest";
import { matchPerspective, isGroup, matchUnits } from "./perspective";
import type { Match } from "../api/types";

const pl = (name: string) => ({ id: name, name });
const m1: Match = { id: "1", teams: [
  { team: 0, score: 13, won: true, players: [pl("Ida")] },
  { team: 1, score: 5, won: false, players: [pl("Bo")] },
] };
const threeWay: Match = { id: "2", teams: [
  { team: 0, score: 11, won: true, players: [pl("Ida")] },
  { team: 1, score: 5, won: false, players: [pl("Bo")] },
  { team: 2, score: 0, won: false, players: [pl("Cy")] },
], drinks: [{ count: 2 }, { count: 1 }] };

describe("matchPerspective", () => {
  it("returns win + opponents for the viewer", () => {
    const p = matchPerspective(m1, "Ida")!;
    expect(p.won).toBe(true); expect(p.myScore).toBe(13); expect(p.oppScore).toBe(5);
    expect(p.opponents).toEqual(["Bo"]); expect(p.teammates).toEqual([]);
  });
  it("returns loss for the other side", () => {
    expect(matchPerspective(m1, "Bo")!.won).toBe(false);
  });
  it("null when viewer did not play", () => {
    expect(matchPerspective(m1, "Zed")).toBeNull();
  });
  it("N-way: opponents are everyone on other teams, oppScore is the best of them", () => {
    const p = matchPerspective(threeWay, "Ida")!;
    expect(p.opponents.sort()).toEqual(["Bo", "Cy"]);
    expect(p.oppScore).toBe(5); expect(p.won).toBe(true);
  });
  it("isGroup true for N-way and doubles", () => {
    expect(isGroup(m1)).toBe(false);
    expect(isGroup(threeWay)).toBe(true);
  });
  it("matchUnits sums drink counts", () => {
    expect(matchUnits(threeWay)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- perspective`
Expected: FAIL.

- [ ] **Step 3: Create `client/src/stats/perspective.ts`**

```ts
// client/src/stats/perspective.ts
import type { Match } from "../api/types";

export type Perspective = {
  won: boolean | null;
  myScore: number | null;
  oppScore: number | null;
  teammates: string[];
  opponents: string[];
};

export function matchPerspective(m: Match, viewer: string): Perspective | null {
  const teams = m.teams ?? [];
  const myTeam = teams.find((t) => t.players.some((p) => p.name === viewer));
  if (!myTeam) return null;
  const others = teams.filter((t) => t !== myTeam);
  const myScore = myTeam.score ?? null;
  const oppScores = others.map((t) => t.score).filter((s): s is number => typeof s === "number");
  const oppScore = oppScores.length ? Math.max(...oppScores) : null;
  const decided = myScore !== null && oppScore !== null;
  const won = decided ? (myScore > oppScore! ? true : myScore < oppScore! ? false : null) : null;
  return {
    won,
    myScore,
    oppScore,
    teammates: myTeam.players.filter((p) => p.name !== viewer).map((p) => p.name),
    opponents: others.flatMap((t) => t.players.map((p) => p.name)),
  };
}

export function isGroup(m: Match): boolean {
  const teams = m.teams ?? [];
  return teams.length > 2 || teams.some((t) => t.players.length > 1);
}

export const matchUnits = (m: Match) => (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- perspective`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/perspective.ts client/src/stats/perspective.test.ts
git commit -m "feat(client): matchPerspective helper for per-player stats"
```

---

### Task 10: `elo.ts` — generalized team Elo

**Files:**
- Modify: `client/src/stats/elo.ts` (full rewrite)
- Modify: `client/src/stats/elo.test.ts` (rewrite to teams shape)

**Interfaces:**
- Consumes: `Match.teams`.
- Produces: `computeElo(matches, opts?) -> PlayerRating[]`; `PlayerRating.form` is `("W"|"L"|"D")[]`.

- [ ] **Step 1: Rewrite the test**

```ts
// client/src/stats/elo.test.ts
import { describe, it, expect } from "vitest";
import { computeElo } from "./elo";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const oneVone = (a: string, sa: number, b: string, sb: number, i: number): Match => ({
  id: String(i), Dato: `2026-06-${String(i + 1).padStart(2, "0")}`, Tid: "18:00",
  teams: [{ team: 0, score: sa, won: sa > sb, players: [pl(a)] }, { team: 1, score: sb, won: sb > sa, players: [pl(b)] }],
});

describe("computeElo", () => {
  it("ranks a consistent winner above the loser", () => {
    const r = computeElo(Array.from({ length: 6 }, (_, i) => oneVone("Ida", 13, "Bo", 5, i)));
    expect(r[0].name).toBe("Ida");
    expect(r[0].elo).toBeGreaterThan(1000);
    expect(r[1].elo).toBeLessThan(1000);
    expect(r[0].wins).toBe(6);
    expect(r[0].provisional).toBe(false);
    expect(r[0].form).toEqual(["W", "W", "W", "W", "W"]);
  });

  it("rates every member of a 2v2 game", () => {
    const m: Match = { id: "1", Dato: "2026-06-01", teams: [
      { team: 0, score: 13, won: true, players: [pl("Ida"), pl("Ann")] },
      { team: 1, score: 7, won: false, players: [pl("Bo"), pl("Cy")] },
    ] };
    const r = computeElo([m]);
    expect(r.map((p) => p.name).sort()).toEqual(["Ann", "Bo", "Cy", "Ida"]);
    expect(r.find((p) => p.name === "Ida")!.wins).toBe(1);
    expect(r.find((p) => p.name === "Bo")!.losses).toBe(1);
  });

  it("decomposes a 3-way into pairwise matchups", () => {
    const m: Match = { id: "1", Dato: "2026-06-01", teams: [
      { team: 0, score: 11, won: true, players: [pl("Ida")] },
      { team: 1, score: 5, won: false, players: [pl("Bo")] },
      { team: 2, score: 0, won: false, players: [pl("Cy")] },
    ] };
    const r = computeElo([m]);
    const ida = r.find((p) => p.name === "Ida")!;
    expect(ida.wins).toBe(2);   // beat Bo and Cy
    expect(ida.games).toBe(2);
    expect(r.find((p) => p.name === "Cy")!.losses).toBe(2);
    expect(r[0].name).toBe("Ida");
  });

  it("computes avgMargin from each player's perspective", () => {
    const r = computeElo([oneVone("Ida", 13, "Bo", 5, 0)]);
    expect(r.find((p) => p.name === "Ida")!.avgMargin).toBe(8);
    expect(r.find((p) => p.name === "Bo")!.avgMargin).toBe(-8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- elo`
Expected: FAIL.

- [ ] **Step 3: Rewrite `client/src/stats/elo.ts`**

```ts
// client/src/stats/elo.ts
import type { Match } from "../api/types";

export type PlayerRating = {
  name: string; elo: number; games: number; wins: number; losses: number;
  winRate: number; avgMargin: number; form: ("W" | "L" | "D")[]; provisional: boolean;
};

export function computeElo(
  matches: Match[],
  opts: { base?: number; k?: number; provisionalGames?: number } = {},
): PlayerRating[] {
  const base = opts.base ?? 1000, k = opts.k ?? 24, provisionalGames = opts.provisionalGames ?? 5;

  const eligible = matches
    .filter((m) => (m.teams?.length ?? 0) >= 2)
    .map((m, i) => ({ m, i }))
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
    const teams = (m.teams ?? []).filter((t) => typeof t.score === "number" && t.players.length > 0);
    if (teams.length < 2) continue;

    // Snapshot ratings so all pairwise expectations in this match use pre-match values.
    const snap = new Map<string, number>();
    for (const t of teams) for (const pl of t.players) snap.set(pl.name, get(pl.name).elo);
    const teamAvg = (t: typeof teams[number]) => t.players.reduce((s, pl) => s + snap.get(pl.name)!, 0) / t.players.length;

    const delta = new Map<string, number>();
    const addDelta = (name: string, d: number) => delta.set(name, (delta.get(name) ?? 0) + d);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const ti = teams[i], tj = teams[j];
        const si = ti.score as number, sj = tj.score as number;
        const ri = teamAvg(ti), rj = teamAvg(tj);
        const scoreI = si > sj ? 1 : si < sj ? 0 : 0.5;
        const expI = 1 / (1 + Math.pow(10, (rj - ri) / 400));
        const di = k * (scoreI - expI);
        for (const pl of ti.players) {
          addDelta(pl.name, di);
          const p = get(pl.name); p.games++;
          if (scoreI === 1) p.wins++; else if (scoreI === 0) p.losses++;
          p.form.push(scoreI === 1 ? "W" : scoreI === 0 ? "L" : "D");
          marginSum.set(pl.name, (marginSum.get(pl.name) ?? 0) + (si - sj)); marginN.set(pl.name, (marginN.get(pl.name) ?? 0) + 1);
        }
        for (const pl of tj.players) {
          addDelta(pl.name, -di);
          const p = get(pl.name); p.games++;
          if (scoreI === 0) p.wins++; else if (scoreI === 1) p.losses++;
          p.form.push(scoreI === 0 ? "W" : scoreI === 1 ? "L" : "D");
          marginSum.set(pl.name, (marginSum.get(pl.name) ?? 0) + (sj - si)); marginN.set(pl.name, (marginN.get(pl.name) ?? 0) + 1);
        }
      }
    }
    for (const [name, d] of delta) get(name).elo += d;
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

Run: `cd client && npm test -- elo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/elo.ts client/src/stats/elo.test.ts
git commit -m "feat(client): generalized team Elo (1v1, team, N-way)"
```

---

### Task 11: `derive.ts` & `headToHead.ts` & `insights.ts` — perspective-based stats

**Files:**
- Modify: `client/src/stats/derive.ts` (rewrite to take a `viewer`)
- Modify: `client/src/stats/headToHead.ts` (rewrite to teams)
- Modify: `client/src/stats/insights.ts` (pass viewer through)
- Modify: `client/src/stats/derive.test.ts`, `client/src/stats/insights.test.ts` (update to new signatures)

**Interfaces:**
- Consumes: `matchPerspective`, `isGroup`, `matchUnits` (Task 9).
- Produces: `deriveStats(matches, viewer) -> { total, wins, winRate, totalPoints, longestStreak, topArenas, topDrinks, pointsOverTime, totalDrinks, byUnitsBucket, byTimeOfDay, byWeekday, byArena, byOpponent, consumptionByMonth, topDrinksByUnits }`; `headToHead(matches, viewer) -> H2HRow[]`; `deriveInsights(matches, viewer) -> Insight[]`.

- [ ] **Step 1: Rewrite `client/src/stats/derive.ts`**

```ts
// client/src/stats/derive.ts
import type { Match } from "../api/types";
import { matchPerspective, matchUnits } from "./perspective";

export { matchUnits };

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

type View = { m: Match; won: boolean | null; margin: number | null; opponents: string[]; units: number };

function viewsFor(matches: Match[], viewer: string): View[] {
  const out: View[] = [];
  for (const m of matches) {
    const p = matchPerspective(m, viewer);
    if (!p) continue;
    out.push({
      m, won: p.won,
      margin: p.myScore !== null && p.oppScore !== null ? p.myScore - p.oppScore : null,
      opponents: p.opponents, units: matchUnits(m),
    });
  }
  return out;
}

function group(views: View[], keyOf: (v: View) => string | string[]) {
  const map = new Map<string, { wins: number; games: number; marginSum: number; marginN: number }>();
  for (const v of views) {
    const keys = keyOf(v);
    for (const k of Array.isArray(keys) ? keys : [k]) {
      if (!k) continue;
      const g = map.get(k) ?? { wins: 0, games: 0, marginSum: 0, marginN: 0 };
      g.games++; if (v.won) g.wins++;
      if (v.margin !== null) { g.marginSum += v.margin; g.marginN++; }
      map.set(k, g);
    }
  }
  return [...map.entries()].map(([key, g]) => ({
    key, games: g.games,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}

function topArenas(views: View[]) {
  const counts = new Map<string, number>();
  for (const v of views) { const a = v.m.Arena; if (a) counts.set(a, (counts.get(a) ?? 0) + 1); }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

function unitsBucketLabel(u: number) {
  if (u === 0) return "0";
  if (u <= 2) return "1–2";
  if (u <= 4) return "3–4";
  return "5+";
}

export function deriveStats(matches: Match[], viewer: string) {
  const views = viewsFor(matches, viewer);
  const byDate = [...views].sort((a, b) => (a.m.Dato ?? "").localeCompare(b.m.Dato ?? ""));
  const total = views.length;
  const wins = views.filter((v) => v.won).length;
  const totalPoints = views.reduce((s, v) => s + (matchPerspective(v.m, viewer)?.myScore ?? 0), 0);

  let streak = 0, longestStreak = 0;
  for (const v of byDate) { if (v.won) { streak++; longestStreak = Math.max(longestStreak, streak); } else streak = 0; }

  const totalDrinks = views.reduce((s, v) => s + v.units, 0);

  const bucketOrder = ["0", "1–2", "3–4", "5+"];
  const byUnitsBucket = bucketOrder.map((bucket) => {
    const inB = views.filter((v) => unitsBucketLabel(v.units) === bucket);
    const w = inB.filter((v) => v.won).length;
    const margins = inB.map((v) => v.margin).filter((x): x is number => x !== null);
    return {
      bucket, games: inB.length,
      winRate: inB.length ? (w / inB.length) * 100 : 0,
      avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
    };
  });

  const consMap = new Map<string, number>();
  for (const v of views) { const month = (v.m.Dato ?? "").slice(0, 7); if (month) consMap.set(month, (consMap.get(month) ?? 0) + v.units); }
  const consumptionByMonth = [...consMap.entries()].map(([month, units]) => ({ month, units })).sort((a, b) => a.month.localeCompare(b.month));

  const drinkUnits = new Map<string, number>();
  for (const v of views) for (const d of v.m.drinks ?? []) {
    const name = d.name || d.brand || d.category || d.type;
    if (name) drinkUnits.set(name, (drinkUnits.get(name) ?? 0) + (d.count ?? 0));
  }
  const topDrinksByUnits = [...drinkUnits.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units).slice(0, 5);

  return {
    total, wins,
    winRate: total ? (wins / total) * 100 : 0,
    totalPoints, longestStreak,
    topArenas: topArenas(views),
    topDrinks: topDrinksByUnits.map((d) => ({ name: d.name, count: d.units })),
    pointsOverTime: byDate.map((v) => ({ date: v.m.Dato ?? "", points: matchPerspective(v.m, viewer)?.myScore ?? 0 })),
    totalDrinks,
    byUnitsBucket,
    byTimeOfDay: group(views, (v) => timeBucket(v.m.Tid)),
    byWeekday: group(views, (v) => weekday(v.m.Dato)),
    byArena: group(views, (v) => v.m.Arena ?? ""),
    byOpponent: group(views, (v) => v.opponents),
    consumptionByMonth,
    topDrinksByUnits,
  };
}
```

- [ ] **Step 2: Rewrite `client/src/stats/headToHead.ts`**

```ts
// client/src/stats/headToHead.ts
import type { Match } from "../api/types";
import { matchPerspective } from "./perspective";

export type H2HRow = { opponent: string; games: number; wins: number; losses: number; winRate: number; avgMargin: number };

export function headToHead(matches: Match[], player: string): H2HRow[] {
  const agg = new Map<string, { games: number; wins: number; marginSum: number; marginN: number }>();
  for (const m of matches) {
    const p = matchPerspective(m, player);
    if (!p || p.won === null) continue;
    const margin = p.myScore !== null && p.oppScore !== null ? p.myScore - p.oppScore : null;
    for (const opp of p.opponents) {
      const g = agg.get(opp) ?? { games: 0, wins: 0, marginSum: 0, marginN: 0 };
      g.games++; if (p.won) g.wins++;
      if (margin !== null) { g.marginSum += margin; g.marginN++; }
      agg.set(opp, g);
    }
  }
  return [...agg.entries()].map(([opponent, g]) => ({
    opponent, games: g.games, wins: g.wins, losses: g.games - g.wins,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}
```

- [ ] **Step 3: Update `client/src/stats/insights.ts`** — change the signature to accept `viewer` and forward it

```ts
// change the export signature and the deriveStats call:
export function deriveInsights(matches: Match[], viewer: string): Insight[] {
  const s = deriveStats(matches, viewer);
  // ...rest unchanged...
```

(Only the first two lines of the function body change — the `deriveStats(matches)` call becomes `deriveStats(matches, viewer)`. Everything below is unchanged.)

- [ ] **Step 4: Update the stats tests** to the new signatures

In `client/src/stats/derive.test.ts` and `client/src/stats/insights.test.ts`, replace flat-model fixtures with `teams`-shaped matches and pass a viewer. Example fixture + assertion pattern:

```ts
import type { Match } from "../api/types";
const pl = (n: string) => ({ id: n, name: n });
const win = (i: number, units = 0): Match => ({
  id: String(i), Dato: `2026-06-${String(i + 1).padStart(2, "0")}`, Tid: "18:00", Arena: "Park",
  teams: [{ team: 0, score: 13, won: true, players: [pl("Ida")] }, { team: 1, score: 5, won: false, players: [pl("Bo")] }],
  drinks: units ? [{ count: units }] : [],
});
// deriveStats([...], "Ida") — assert total/wins/winRate/byOpponent[0].key === "Bo"
// deriveInsights([win(0), win(1), win(2)], "Ida") — assert first insight text contains "vundet"
```

Rewrite the existing assertions in both files accordingly so each test constructs `teams`-shaped matches and calls the function with `"Ida"` as the viewer.

- [ ] **Step 5: Run tests**

Run: `cd client && npm test -- derive insights headToHead`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/stats/derive.ts client/src/stats/headToHead.ts client/src/stats/insights.ts client/src/stats/derive.test.ts client/src/stats/insights.test.ts
git commit -m "feat(client): perspective-based derive/insights/head-to-head"
```

---

### Task 12: `drinkStats.ts` — per-player drink stats

**Files:**
- Create: `client/src/stats/drinkStats.ts`
- Test: `client/src/stats/drinkStats.test.ts`

**Interfaces:**
- Produces: `playerDrinkStats(matches) -> { name: string; units: number; litres: number; games: number; wins: number; unitsPerGame: number }[]` sorted by units desc.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/stats/drinkStats.test.ts
import { describe, it, expect } from "vitest";
import { playerDrinkStats } from "./drinkStats";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const matches: Match[] = [
  { id: "1", teams: [
      { team: 0, score: 13, won: true, players: [pl("Ida")] },
      { team: 1, score: 5, won: false, players: [pl("Bo")] }],
    drinks: [{ count: 2, volumeCl: 50, player: "Ida" }, { count: 1, volumeCl: 33, player: "Bo" }] },
  { id: "2", teams: [
      { team: 0, score: 7, won: false, players: [pl("Ida")] },
      { team: 1, score: 13, won: true, players: [pl("Bo")] }],
    drinks: [{ count: 1, volumeCl: 50, player: "Ida" }] },
];

describe("playerDrinkStats", () => {
  it("aggregates units, litres, games and wins per drinker", () => {
    const s = playerDrinkStats(matches);
    const ida = s.find((r) => r.name === "Ida")!;
    expect(ida.units).toBe(3);           // 2 + 1
    expect(ida.litres).toBeCloseTo(1.5); // (2×50 + 1×50) cl = 150 cl = 1.5 L
    expect(s[0].name).toBe("Ida");       // most units first
  });
});
```

Note: litres = sum(count × volumeCl) / 100.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- drinkStats`
Expected: FAIL.

- [ ] **Step 3: Create `client/src/stats/drinkStats.ts`**

```ts
// client/src/stats/drinkStats.ts
import type { Match } from "../api/types";

export type PlayerDrinkStat = {
  name: string; units: number; litres: number; games: number; wins: number; unitsPerGame: number;
};

export function playerDrinkStats(matches: Match[]): PlayerDrinkStat[] {
  const agg = new Map<string, { units: number; litres: number; games: number; wins: number }>();
  const get = (name: string) => {
    let a = agg.get(name);
    if (!a) { a = { units: 0, litres: 0, games: 0, wins: 0 }; agg.set(name, a); }
    return a;
  };

  for (const m of matches) {
    for (const d of m.drinks ?? []) {
      if (!d.player) continue;
      const a = get(d.player);
      const count = d.count ?? 1;
      a.units += count;
      if (typeof d.volumeCl === "number") a.litres += (count * d.volumeCl) / 100;
    }
    const scores = (m.teams ?? []).map((t) => t.score).filter((s): s is number => typeof s === "number");
    const max = scores.length ? Math.max(...scores) : null;
    for (const t of m.teams ?? []) {
      const won = max !== null && t.score === max;
      for (const p of t.players) { const a = get(p.name); a.games++; if (won) a.wins++; }
    }
  }

  return [...agg.entries()]
    .map(([name, a]) => ({ name, ...a, unitsPerGame: a.games ? a.units / a.games : 0 }))
    .sort((x, y) => y.units - x.units);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- drinkStats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stats/drinkStats.ts client/src/stats/drinkStats.test.ts
git commit -m "feat(client): per-player drink stats"
```

---

## Phase 5 — Client UI

### Task 13: `TeamsEditor` component

**Files:**
- Create: `client/src/components/TeamsEditor.tsx`
- Test: `client/src/components/TeamsEditor.test.tsx`

**Interfaces:**
- Produces: `TeamInput = { score: number | null; players: string[] }`; `<TeamsEditor value onChange playerOptions onAddPlayer? />`.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/components/TeamsEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamsEditor, type TeamInput } from "./TeamsEditor";

describe("TeamsEditor", () => {
  it("adds a team when '+ Tilføj hold' is clicked", () => {
    const onChange = vi.fn();
    const value: TeamInput[] = [{ score: null, players: ["Ida"] }, { score: null, players: ["Bo"] }];
    render(<TeamsEditor value={value} onChange={onChange} playerOptions={["Ida", "Bo", "Cy"]} />);
    fireEvent.click(screen.getByText("+ Tilføj hold"));
    expect(onChange).toHaveBeenCalledWith([...value, { score: null, players: [] }]);
  });

  it("marks the highest-scoring team as winner", () => {
    const value: TeamInput[] = [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Bo"] }];
    render(<TeamsEditor value={value} onChange={() => {}} playerOptions={["Ida", "Bo"]} />);
    expect(screen.getByText(/Hold 1 🏆/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- TeamsEditor`
Expected: FAIL.

- [ ] **Step 3: Create `client/src/components/TeamsEditor.tsx`**

```tsx
// client/src/components/TeamsEditor.tsx
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export type TeamInput = { score: number | null; players: string[] };

type Props = {
  value: TeamInput[];
  onChange: (teams: TeamInput[]) => void;
  playerOptions: string[];
  onAddPlayer?: (v: string) => void;
};

export function TeamsEditor({ value, onChange, playerOptions, onAddPlayer }: Props) {
  const scores = value.map((t) => t.score).filter((s): s is number => typeof s === "number");
  const max = scores.length ? Math.max(...scores) : null;
  const setTeam = (i: number, patch: Partial<TeamInput>) => onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTeam = () => onChange([...value, { score: null, players: [] }]);
  const removeTeam = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const addPlayer = (i: number, name: string) => {
    const n = name.trim();
    if (!n || value[i].players.includes(n)) return;
    setTeam(i, { players: [...value[i].players, n] });
  };
  const removePlayer = (i: number, name: string) => setTeam(i, { players: value[i].players.filter((p) => p !== name) });

  return (
    <div className="space-y-4">
      {value.map((t, i) => {
        const isWinner = t.score != null && max != null && t.score === max;
        return (
          <div key={i} className={`rounded-card border p-3 space-y-2 ${isWinner ? "border-olive bg-olive/5" : "border-ink/10"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">Hold {i + 1}{isWinner ? " 🏆" : ""}</span>
              {value.length > 2 && <Button type="button" variant="ghost" onClick={() => removeTeam(i)}>Fjern hold</Button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.players.map((p) => (
                <button key={p} type="button" onClick={() => removePlayer(i, p)}
                  className="rounded-full border border-terracotta bg-terracotta/10 px-2.5 py-0.5 text-sm">
                  {p} ✕
                </button>
              ))}
            </div>
            <SelectOrAdd
              key={`add-${i}-${t.players.length}`}
              label="Tilføj spiller"
              value=""
              options={playerOptions.filter((p) => !t.players.includes(p))}
              onChange={(v) => addPlayer(i, v)}
              onAdd={(v) => { onAddPlayer?.(v); addPlayer(i, v); }}
            />
            <Input label="Point" type="number" value={t.score ?? ""}
              onChange={(e) => setTeam(i, { score: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full sm:w-32" />
          </div>
        );
      })}
      <Button type="button" variant="ghost" onClick={addTeam}>+ Tilføj hold</Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- TeamsEditor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TeamsEditor.tsx client/src/components/TeamsEditor.test.tsx
git commit -m "feat(client): TeamsEditor for teams + scores"
```

---

### Task 14: `DrinksEditor` — per-drink player picker

**Files:**
- Modify: `client/src/components/DrinksEditor.tsx`
- Modify: `client/src/components/DrinksEditor.test.tsx` (add a case for the picker)

**Interfaces:**
- Consumes: participant names.
- Produces: `DrinksEditor` gains prop `playerOptions?: string[]`; each drink renders a "Hvem drak?" `<select>` bound to `d.player`.

- [ ] **Step 1: Add the failing test case** (append to the existing describe block)

```tsx
it("assigns a drink to a player", () => {
  const onChange = vi.fn();
  render(<DrinksEditor value={[{ count: 1 }]} onChange={onChange} typeOptions={[]} playerOptions={["Ida", "Bo"]} />);
  fireEvent.change(screen.getByLabelText("Hvem drak?"), { target: { value: "Ida" } });
  expect(onChange).toHaveBeenCalledWith([{ count: 1, player: "Ida" }]);
});
```

(Ensure the test file imports `vi`, `render`, `screen`, `fireEvent`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- DrinksEditor`
Expected: FAIL.

- [ ] **Step 3: Edit `client/src/components/DrinksEditor.tsx`** — add `playerOptions` to `Props` and render the picker

Add to the `Props` type:
```ts
  playerOptions?: string[];
```
Add `playerOptions = []` to the destructured params. Then, inside the drink `<div>` (after the Antal/Volumen row), add:
```tsx
          {playerOptions.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block text-ink/60">Hvem drak?</span>
              <select
                aria-label="Hvem drak?"
                value={d.player ?? ""}
                onChange={(e) => update(i, { player: e.target.value || null })}
                className="w-full rounded-card border border-ink/10 bg-white/70 px-3 py-1.5 text-sm"
              >
                <option value="">Ingen / delt</option>
                {playerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- DrinksEditor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/DrinksEditor.tsx client/src/components/DrinksEditor.test.tsx
git commit -m "feat(client): attribute drinks to players in DrinksEditor"
```

---

### Task 15: `MatchFormPage` — teams-based form

**Files:**
- Modify: `client/src/pages/MatchFormPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: `TeamsEditor`/`TeamInput` (Task 13), `DrinksEditor` `playerOptions` (Task 14), `useCreateMatch`/`useUpdateMatch` (send `{ Dato, Tid, Arena, teams, drinks, ... }`).
- Produces: a form that builds `teams: TeamInput[]` and `drinks: Drink[]`.

- [ ] **Step 1: Rewrite `client/src/pages/MatchFormPage.tsx`**

```tsx
// client/src/pages/MatchFormPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMatches, useCreateMatch, useUpdateMatch, useOptions, useAddOption, usePlayers, useAddPlayer } from "../api/hooks";
import { ymd } from "../stats/dateRange";
import { DrinksEditor } from "../components/DrinksEditor";
import { TeamsEditor, type TeamInput } from "../components/TeamsEditor";
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useAuth } from "../auth/AuthContext";
import type { Match, Drink } from "../api/types";

type FormState = {
  Dato?: string; Tid?: string; Arena?: string; "Spillets genstande"?: string;
  teams: TeamInput[]; drinks: Drink[];
};

function toFormState(m: Match): FormState {
  return {
    Dato: m.Dato, Tid: m.Tid, Arena: m.Arena, "Spillets genstande": m["Spillets genstande"],
    teams: (m.teams ?? []).map((t) => ({ score: t.score, players: t.players.map((p) => p.name) })),
    drinks: m.drinks ?? [],
  };
}

export function MatchFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: matches = [] } = useMatches();
  const create = useCreateMatch();
  const update = useUpdateMatch();
  const players = usePlayers();
  const addPlayer = useAddPlayer();
  const playerNames = (players.data ?? []).map((p) => p.name);
  const arenas = useOptions("arenas");
  const drinkTypes = useOptions("drink_types");
  const drinkCategories = useOptions("drink_categories");
  const drinkBrands = useOptions("drink_brands");
  const drinkNames = useOptions("drink_names");
  const addArena = useAddOption("arenas");
  const addDrinkType = useAddOption("drink_types");
  const addDrinkCategory = useAddOption("drink_categories");
  const addDrinkBrand = useAddOption("drink_brands");
  const addDrinkName = useAddOption("drink_names");

  const [form, setForm] = useState<FormState>({ teams: [{ score: null, players: [] }, { score: null, players: [] }], drinks: [] });
  const [error, setError] = useState<string | null>(null);
  const last = matches[0];

  useEffect(() => {
    if (id) { const m = matches.find((x) => x.id === id); if (m) setForm(toFormState(m)); }
  }, [id, matches]);

  useEffect(() => {
    if (id) return;
    const nowHM = new Date().toTimeString().slice(0, 5);
    const today = ymd(new Date());
    setForm((f) => ({
      ...f,
      Dato: f.Dato ?? today,
      Tid: f.Tid ?? nowHM,
      Arena: f.Arena ?? last?.Arena,
      teams: f.teams[0].players.length === 0 && user?.username
        ? [{ score: null, players: [user.username] }, { score: null, players: [] }]
        : f.teams,
    }));
  }, [id, matches.length]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const participantNames = form.teams.flatMap((t) => t.players);

  function validate(): string | null {
    if (!form.Dato) return "Dato er påkrævet";
    if (form.teams.length < 2) return "Der skal være mindst to hold";
    if (form.teams.some((t) => t.players.length === 0)) return "Hvert hold skal have mindst én spiller";
    for (const t of form.teams) if (t.score != null && (t.score < 0 || t.score > 50)) return "Point skal være mellem 0 og 50";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    const payload = {
      Dato: form.Dato, Tid: form.Tid, Arena: form.Arena, "Spillets genstande": form["Spillets genstande"],
      teams: form.teams, drinks: form.drinks,
    };
    if (id) await update.mutateAsync({ id, ...payload });
    else await create.mutateAsync(payload);
    nav("/matches");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Card className="space-y-3">
        <Input label="Dato" type="date" value={form.Dato ?? ""} onChange={(e) => set({ Dato: e.target.value })} />
        <Input label="Tid" type="time" value={form.Tid ?? ""} onChange={(e) => set({ Tid: e.target.value })} />
        <SelectOrAdd label="Arena" value={form.Arena ?? ""} options={(arenas.data ?? []).map((o) => o.name)} onChange={(v) => set({ Arena: v })} onAdd={(v) => addArena.mutate(v)} />
        <Input label="Spillets genstande" value={form["Spillets genstande"] ?? ""} onChange={(e) => set({ "Spillets genstande": e.target.value })} />
      </Card>
      <Card className="space-y-3">
        <h3 className="font-display text-lg">Hold</h3>
        <TeamsEditor value={form.teams} onChange={(teams) => set({ teams })} playerOptions={playerNames} onAddPlayer={(v) => addPlayer.mutate(v)} />
      </Card>
      <Card>
        <h3 className="mb-2 font-display text-lg">Drikkevarer i denne omgang</h3>
        <DrinksEditor
          value={form.drinks}
          onChange={(drinks) => set({ drinks })}
          typeOptions={(drinkTypes.data ?? []).map((o) => o.name)}
          categoryOptions={(drinkCategories.data ?? []).map((o) => o.name)}
          brandOptions={(drinkBrands.data ?? []).map((o) => o.name)}
          nameOptions={(drinkNames.data ?? []).map((o) => o.name)}
          playerOptions={participantNames}
          onAddType={(v) => addDrinkType.mutate(v)}
          onAddCategory={(v) => addDrinkCategory.mutate(v)}
          onAddBrand={(v) => addDrinkBrand.mutate(v)}
          onAddName={(v) => addDrinkName.mutate(v)}
        />
      </Card>
      {!id && last?.drinks?.length ? (
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => set({ drinks: last.drinks ?? [] })}>
          Gentag sidste omgang ({last.drinks.length} drikke)
        </Button>
      ) : null}
      <Button type="submit">{id ? "Gem ændringer" : "Log kamp"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify `useAuth` is exported** from `client/src/auth/AuthContext.tsx`

Run: `cd client && grep -n "export function useAuth" src/auth/AuthContext.tsx`
Expected: a match. If it is named differently (e.g. the hook is `useAuthContext`), update the import in `MatchFormPage.tsx` to match.

- [ ] **Step 3: Type-check the page**

Run: `cd client && npx tsc --noEmit 2>&1 | grep MatchFormPage`
Expected: no errors referencing `MatchFormPage.tsx`.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/MatchFormPage.tsx
git commit -m "feat(client): teams-based match form"
```

---

### Task 16: `MatchCard` — render teams

**Files:**
- Modify: `client/src/components/MatchCard.tsx`
- Test: `client/src/components/MatchCard.test.tsx` (create)

**Interfaces:**
- Consumes: `Match.teams`, `isGroup` (Task 9).
- Produces: card showing `Team A players (score) vs Team B players (score)`, winner/group badges, drink count.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/components/MatchCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MatchCard } from "./MatchCard";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const m: Match = { id: "1", Dato: "2026-04-22", teams: [
  { team: 0, score: 18, won: false, players: [pl("Daniel"), pl("Rasmus")] },
  { team: 1, score: 21, won: true, players: [pl("Marcus"), pl("Søren")] },
] };

describe("MatchCard", () => {
  it("renders both teams with scores", () => {
    render(<MemoryRouter><MatchCard m={m} /></MemoryRouter>);
    expect(screen.getByText(/Daniel \+ Rasmus/)).toBeInTheDocument();
    expect(screen.getByText(/Marcus \+ Søren/)).toBeInTheDocument();
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText(/21/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- MatchCard`
Expected: FAIL.

- [ ] **Step 3: Rewrite `client/src/components/MatchCard.tsx`**

```tsx
// client/src/components/MatchCard.tsx
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { isGroup } from "../stats/perspective";
import type { Match, Team } from "../api/types";

const teamLabel = (t: Team) => t.players.map((p) => p.name).join(" + ");

export function MatchCard({ m }: { m: Match }) {
  const units = (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
  const teams = m.teams ?? [];
  return (
    <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-display text-lg">
          {teams.map((t, i) => (
            <span key={t.team}>
              {i > 0 && <span className="text-ink/40"> vs </span>}
              <span className={t.won ? "text-olive" : undefined}>
                {teamLabel(t)}{t.score != null ? ` (${t.score})` : ""}
              </span>
            </span>
          ))}
        </div>
        <div className="text-sm text-ink/60">
          {m.Dato}{m.Tid ? ` ${m.Tid}` : ""}{m.Arena ? ` · ${m.Arena}` : ""}
        </div>
        {units > 0 && <div className="mt-1 text-sm text-bordeaux">🍹 {units} drik{units === 1 ? "" : "ke"}</div>}
      </div>
      <div className="flex items-center gap-2">
        {isGroup(m) && <Badge tone="group">Gruppe</Badge>}
        <Link to={`/matches/${m.id}/edit`} className="text-sm text-terracotta">Rediger</Link>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- MatchCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/MatchCard.tsx client/src/components/MatchCard.test.tsx
git commit -m "feat(client): MatchCard renders teams"
```

---

### Task 17: Wire pages — Dashboard viewer, Rankings, drink-stats section

**Files:**
- Modify: `client/src/pages/DashboardPage.tsx`
- Modify: `client/src/pages/RankingsPage.tsx` (copy tweak only)

**Interfaces:**
- Consumes: `deriveStats(scoped, viewer)`, `deriveInsights(scoped, viewer)`, `headToHead(scoped, viewer)` (Task 11); `playerDrinkStats(scoped)` (Task 12); `useAuth` for the default viewer.

**Context:** The dashboard was per-`Spiller`. Under the participant model, stats need a viewer. Replace the `"Alle"` option with a real player selector defaulting to the logged-in user (or the first player). Every stat is now "this player's" view. The `byOpponent`/`byArena`/etc. all come from `deriveStats(scoped, viewer)`.

- [ ] **Step 1: Edit `DashboardPage.tsx`** — replace the player state, list, filter, and stat calls

Replace the imports and the top of the component:
```tsx
import { useAuth } from "../auth/AuthContext";
import { playerDrinkStats } from "../stats/drinkStats";
// ...
export function DashboardPage() {
  const { data = [], isLoading } = useMatches();
  const { user } = useAuth();

  const players = useMemo(() => {
    const names = new Set<string>();
    for (const m of data) for (const t of m.teams ?? []) for (const p of t.players) names.add(p.name);
    return Array.from(names).sort();
  }, [data]);

  const [player, setPlayer] = useState<string>("");
  useEffect(() => {
    if (!player && players.length) setPlayer(players.includes(user?.username ?? "") ? user!.username : players[0]);
  }, [players, player, user]);

  const [range, setRange] = useState<RangePreset>("all");
  const scoped = useMemo(() => filterByRange(data, range, new Date()), [data, range]);
  const s = useMemo(() => deriveStats(scoped, player), [scoped, player]);
  const insights = useMemo(() => deriveInsights(scoped, player), [scoped, player]);
  const h2h = useMemo(() => (player ? headToHead(scoped, player) : []), [scoped, player]);
  const drinkers = useMemo(() => playerDrinkStats(scoped), [scoped]);
```

(Add `useEffect` to the React import. Remove the old `filtered`/`Alle` logic. In the player `<select>`, drop the `"Alle"` option and always render `players`. In the head-to-head block, change the guard from `player !== "Alle" && h2h.length > 0` to `h2h.length > 0`.)

- [ ] **Step 2: Add a drink-stats card** to the dashboard JSX (before "Recent matches")

```tsx
      <Card>
        <h3 className="mb-3 font-display text-lg">Hvem drikker mest</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="pb-1 font-normal">Spiller</th>
              <th className="pb-1 font-normal text-right">Enheder</th>
              <th className="pb-1 font-normal text-right">Liter</th>
              <th className="pb-1 font-normal text-right">Pr. kamp</th>
            </tr>
          </thead>
          <tbody>
            {drinkers.map((d) => (
              <tr key={d.name} className="border-t border-ink/5">
                <td className="py-1">{d.name}</td>
                <td className="py-1 text-right">{d.units}</td>
                <td className="py-1 text-right">{d.litres.toFixed(1)}</td>
                <td className="py-1 text-right">{d.unitsPerGame.toFixed(1)}</td>
              </tr>
            ))}
            {drinkers.length === 0 && <tr><td className="py-1 text-ink/40" colSpan={4}>Ingen data endnu</td></tr>}
          </tbody>
        </table>
      </Card>
```

- [ ] **Step 3: Edit `RankingsPage.tsx`** — update the empty-state copy (Elo now covers all games)

Change the empty-state text from `Ingen 1-mod-1 kampe endnu — log nogle for at se ratings.` to `Ingen kampe endnu — log nogle for at se ratings.` Also move the `useMemo` above the early `if (isLoading)` return to satisfy the rules of hooks:
```tsx
export function RankingsPage() {
  const { data = [], isLoading } = useMatches();
  const ratings = useMemo(() => computeElo(data), [data]);
  if (isLoading) return <p>Henter…</p>;
```

- [ ] **Step 4: Type-check and run the full frontend suite**

Run: `cd client && npx tsc --noEmit && npm test`
Expected: no type errors; all frontend tests PASS. Fix any remaining references to removed `Match` fields in other files surfaced by `tsc` (e.g. `dateRange.ts` uses only `Dato`, so it should be unaffected).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/DashboardPage.tsx client/src/pages/RankingsPage.tsx
git commit -m "feat(client): per-player dashboard viewer + drink-stats + all-games rankings"
```

---

## Phase 6 — Build, verify, deploy

### Task 18: Build, full verification, deploy

**Files:** none (verification + release)

- [ ] **Step 1: Run both test suites**

Run: `npm test && cd client && npm test && cd ..`
Expected: all backend + frontend tests PASS.

- [ ] **Step 2: Build the client**

Run: `cd client && npm run build && cd ..`
Expected: `client/dist` built without errors.

- [ ] **Step 3: Manual smoke test locally**

Run: `npm run dev` and, in the app: log a 2v2 game and a 3-way game, attribute a drink, confirm the match card shows both teams, the rankings list all players, and the dashboard drink-stats table populates.

- [ ] **Step 4: Deploy**

Run: `npm run deploy`
Expected: Worker + SPA deployed. Confirm the six backfilled games render with teams at the deployed URL.

- [ ] **Step 5: Final commit / merge**

Use `superpowers:finishing-a-development-branch` to merge `feat/match-players` into `master` (or open a PR).

---

## Self-Review

**Spec coverage:**
- `match_players` table, `match_drinks.player_id`, slim `matches` → Task 1. ✓
- Backfill six games → Task 7. ✓
- API `teams[]` body + reconstructed response + derived winner → Tasks 2–4. ✓
- Id-based rename/merge + games count → Task 5. ✓
- Export from participants → Task 6. ✓
- Client types → Task 8. ✓
- Generalized team Elo (1v1/team/N-way) → Task 10. ✓
- Perspective + derive/insights/head-to-head → Tasks 9, 11. ✓
- Per-player drink stats → Tasks 12, 17. ✓
- Teams-editor form, drink player picker, match card → Tasks 13–16. ✓
- Dashboard/Rankings wiring → Task 17. ✓
- YAGNI cuts honored (no team entities, no target-score field, drink stats = one section). ✓

**Notes for the implementer:**
- Task 8's `tsc` will surface every file referencing removed `Match` fields; Tasks 9–17 clear them. Do not fix them out of order.
- `useAuth` import (Task 15/17): verify the exact export name before relying on it (grep step included).
- The dashboard's `"Alle"` aggregate is intentionally removed — a participant match has no single perspective, so stats are always per-selected-player. This is a deliberate behavior change from the old model.
- Draws (equal top scores in a decided game) count as neither win nor loss in Elo (`form: "D"`), and `matchPerspective.won` is `null`.
