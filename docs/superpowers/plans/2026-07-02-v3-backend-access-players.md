# v3 Backend — Access Gate & Player Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate signup behind a shared code, and add a first-class `players` roster (list-with-counts, upsert, rename, merge) that stays in sync with match data via auto-upsert.

**Architecture:** `SIGNUP_CODE` Worker secret checked in the signup handler (fail closed). New `players` table; players endpoints under `/api/players` (guarded). Match create/update upsert their `Spiller`/`Modstander` names into the roster. Names remain the key on matches; rename/merge rewrite names across matches.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, D1, Vitest + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Signup requires `code` matching `env.SIGNUP_CODE`; unset secret OR mismatch → `403 { message: "Invalid signup code" }`. Login unchanged.
- Player names: trim + case-insensitive (Unicode `toLowerCase`) dedupe, matching the options approach.
- `players` endpoints all guarded. Matches keep `player`/`opponent` name columns; rename/merge rewrite them.
- IDs `crypto.randomUUID()`; timestamps ISO strings.
- Tests run in the Workers pool; migrations auto-apply via `test/apply-migrations.ts`.

---

### Task 1: Signup code gate

**Files:**
- Modify: `src/auth.ts`, `src/types.ts`, `vitest.config.ts`
- Modify: `test/auth.test.ts` and every other test that calls `/api/auth/signup`
- Test: `test/auth.test.ts`

**Interfaces:**
- Consumes: `Env` gains `SIGNUP_CODE: string`.
- Produces: signup rejects with 403 unless `code === env.SIGNUP_CODE`.

- [ ] **Step 1: Add `SIGNUP_CODE` to Env and the test binding**

```typescript
// src/types.ts
export type Env = { DB: D1Database; JWT_SECRET: string; SIGNUP_CODE: string };
```

```typescript
// vitest.config.ts — in miniflare.bindings
bindings: { JWT_SECRET: "test-secret", SIGNUP_CODE: "test-code" },
```

- [ ] **Step 2: Write the failing tests (auth gate)**

```typescript
// test/auth.test.ts — replace the signup helper + add gate tests
async function post(path: string, body: unknown) {
  return app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env);
}
// NOTE: all signup bodies must now include code: "test-code"

it("rejects signup without the code", async () => {
  const res = await post("/api/auth/signup", { username: "ida" });
  expect(res.status).toBe(403);
});
it("rejects signup with a wrong code", async () => {
  const res = await post("/api/auth/signup", { username: "ida", code: "nope" });
  expect(res.status).toBe(403);
});
it("accepts signup with the correct code", async () => {
  const res = await post("/api/auth/signup", { username: "ida", code: "test-code" });
  expect(res.status).toBe(201);
});
```

Also update the existing "signs up a new user", "rejects duplicate usernames", and login-setup signups to include `code: "test-code"`.

- [ ] **Step 3: Run tests to verify the gate tests fail (and others break)**

Run: `npx vitest run test/auth.test.ts`
Expected: FAIL — signup returns 201 without a code (gate not implemented); some existing tests now 403.

- [ ] **Step 4: Implement the gate**

```typescript
// src/auth.ts — top of the signup handler
auth.post("/signup", async (c) => {
  const { username, password, email, code } = await c.req.json().catch(() => ({}));
  if (!c.env.SIGNUP_CODE || code !== c.env.SIGNUP_CODE) {
    return c.json({ message: "Invalid signup code" }, 403);
  }
  if (!username) return c.json({ message: "Username required" }, 400);
  // ... rest of the existing signup logic unchanged ...
});
```

- [ ] **Step 5: Update ALL other signup calls across the test suite**

Run: `grep -rn "auth/signup" test/`
For every test file that signs up to obtain a token (`test/users.test.ts`, `test/matches.test.ts`, `test/options.test.ts`, `test/export.test.ts`, and any helper), add `code: "test-code"` to the signup body. Then run the full suite.

Run: `npm test`
Expected: PASS — all suites green with the code included.

- [ ] **Step 6: Add the local dev secret**

Append to `.dev.vars` (gitignored): `SIGNUP_CODE=dev-code`

- [ ] **Step 7: Commit**

```bash
git add src/auth.ts src/types.ts vitest.config.ts test/ .dev.vars
git commit -m "feat(auth): gate signup behind shared SIGNUP_CODE (fail closed)"
```
(`.dev.vars` is gitignored, so it won't be staged — that's expected.)

---

### Task 2: `players` migration

**Files:**
- Create: `migrations/0003_players.sql`

**Interfaces:**
- Produces: `players(id, name, created_at)` with `UNIQUE(name)`.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0003_players.sql
CREATE TABLE players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 2: Apply locally and verify**

Run: `npm run db:migrate:local && npx wrangler d1 execute petanque --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='players';"`
Expected: `players` present.

- [ ] **Step 3: Commit**

```bash
git add migrations/0003_players.sql
git commit -m "feat(db): players roster table"
```

---

### Task 3: Players module + endpoints

**Files:**
- Create: `src/players.ts`
- Modify: `src/index.ts` (mount guarded)
- Test: `test/players.test.ts`

**Interfaces:**
- Consumes: `AppContext`, `guard`.
- Produces:
  - `upsertPlayer(db, name)` → `{ id, name } | null` (null when name is blank). Case-insensitive find-or-create.
  - `players` Hono app: `GET /` → `[{id,name,games}]`; `POST /` → `{id,name}`; `PATCH /:id {name}` → rename (merge if target name exists); `POST /:id/merge {intoId}` → merge source into target.

- [ ] **Step 1: Write the failing tests**

```typescript
// test/players.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM match_drinks");
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM players");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ida", code: "test-code" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

describe("players roster", () => {
  it("upserts and dedupes case-insensitively", async () => {
    const a = await (await app.request("/api/players", { method: "POST", headers: H(), body: JSON.stringify({ name: "Ida" }) }, env)).json();
    const b = await (await app.request("/api/players", { method: "POST", headers: H(), body: JSON.stringify({ name: " ida " }) }, env)).json();
    expect(b.id).toBe(a.id);
    const list = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(list).toHaveLength(1);
  });

  it("lists players with game counts", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Modstander: "Bo", Vundet: true }) }, env);
    const list = await (await app.request("/api/players", { headers: H() }, env)).json();
    const ida = list.find((p: any) => p.name === "Ida");
    const bo = list.find((p: any) => p.name === "Bo");
    expect(ida.games).toBe(1);
    expect(bo.games).toBe(1);
  });

  it("renames a player and rewrites matches", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Bob", Modstander: "Ida", Vundet: false }) }, env);
    const list = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bob = list.find((p: any) => p.name === "Bob");
    await app.request(`/api/players/${bob.id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ name: "Bo" }) }, env);
    const matches = await (await app.request("/api/matches", { headers: H() }, env)).json();
    expect(matches[0].Spiller).toBe("Bo");
  });

  it("merges one player into another", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Bob", Modstander: "Ida", Vundet: true }) }, env);
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-02", Spiller: "Bo", Modstander: "Ida", Vundet: true }) }, env);
    let list = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bob = list.find((p: any) => p.name === "Bob");
    const bo = list.find((p: any) => p.name === "Bo");
    await app.request(`/api/players/${bob.id}/merge`, { method: "POST", headers: H(), body: JSON.stringify({ intoId: bo.id }) }, env);
    list = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(list.find((p: any) => p.name === "Bob")).toBeUndefined();
    expect(list.find((p: any) => p.name === "Bo").games).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/players.test.ts`
Expected: FAIL — players routes not found.

- [ ] **Step 3: Write `src/players.ts`**

```typescript
// src/players.ts
import { Hono } from "hono";
import type { AppContext } from "./types";

export async function upsertPlayer(db: D1Database, rawName: unknown): Promise<{ id: string; name: string } | null> {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return null;
  const { results } = await db.prepare("SELECT id, name FROM players").all();
  const found = (results as { id: string; name: string }[]).find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (found) return { id: found.id, name: found.name };
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO players (id, name, created_at) VALUES (?, ?, ?)").bind(id, name, new Date().toISOString()).run();
  return { id, name };
}

const players = new Hono<AppContext>();

players.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name FROM players ORDER BY name").all();
  const out = [];
  for (const p of results as { id: string; name: string }[]) {
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM matches WHERE player = ? OR opponent = ?").bind(p.name, p.name).first<{ n: number }>();
    out.push({ id: p.id, name: p.name, games: row?.n ?? 0 });
  }
  return c.json(out);
});

players.post("/", async (c) => {
  const { name } = await c.req.json().catch(() => ({}));
  const p = await upsertPlayer(c.env.DB, name);
  if (!p) return c.json({ message: "Name required" }, 400);
  return c.json(p, 201);
});

players.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const newName = (((await c.req.json().catch(() => ({}))).name ?? "") as string).trim();
  if (!newName) return c.json({ message: "Name required" }, 400);
  const player = await c.env.DB.prepare("SELECT id, name FROM players WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!player) return c.json({ message: "Not found" }, 404);
  const oldName = player.name;
  await c.env.DB.prepare("UPDATE matches SET player = ? WHERE player = ?").bind(newName, oldName).run();
  await c.env.DB.prepare("UPDATE matches SET opponent = ? WHERE opponent = ?").bind(newName, oldName).run();
  const { results } = await c.env.DB.prepare("SELECT id, name FROM players").all();
  const target = (results as { id: string; name: string }[]).find((r) => r.name.toLowerCase() === newName.toLowerCase() && r.id !== id);
  if (target) {
    await c.env.DB.prepare("DELETE FROM players WHERE id = ?").bind(id).run();
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
  await c.env.DB.prepare("UPDATE matches SET player = ? WHERE player = ?").bind(target.name, source.name).run();
  await c.env.DB.prepare("UPDATE matches SET opponent = ? WHERE opponent = ?").bind(target.name, source.name).run();
  await c.env.DB.prepare("DELETE FROM players WHERE id = ?").bind(source.id).run();
  return c.json({ id: target.id, name: target.name });
});

export default players;
```

- [ ] **Step 4: Mount in `src/index.ts` (guarded)**

Add (mirroring the other guarded routes, before the `/api/*` 404 and the SPA catch-all):
```typescript
import players from "./players";
app.use("/api/players", guard);
app.use("/api/players/*", guard);
app.route("/api/players", players);
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/players.test.ts` then `npm test`
Expected: PASS; full suite green. (The `lists players with game counts` and rename/merge tests depend on Task 4's auto-upsert — if run before Task 4, the POST /api/matches will not populate players. Implement Task 4 in the same cycle, or temporarily seed players via POST /api/players. See Task 4.)

- [ ] **Step 6: Commit**

```bash
git add src/players.ts src/index.ts test/players.test.ts
git commit -m "feat(players): roster endpoints — list w/ counts, upsert, rename, merge"
```

---

### Task 4: Match create/update auto-upsert players

**Files:**
- Modify: `src/matches.ts`
- Test: `test/matches.test.ts` (add)

**Interfaces:**
- Consumes: `upsertPlayer` from `src/players.ts`.
- Produces: creating/updating a match upserts its `Spiller` and `Modstander` names into `players`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/matches.test.ts — add (H() and auth from the existing suite; ensure signup includes code:"test-code")
it("registers Spiller and Modstander in the roster on create", async () => {
  await app.request("/api/matches", {
    method: "POST", headers: H(),
    body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Modstander: "Bo", Vundet: true }),
  }, env);
  const players = await (await app.request("/api/players", { headers: H() }, env)).json();
  const names = players.map((p: any) => p.name).sort();
  expect(names).toEqual(["Bo", "Ida"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/matches.test.ts`
Expected: FAIL — roster empty after match create.

- [ ] **Step 3: Add auto-upsert to create and update**

```typescript
// src/matches.ts — import
import { upsertPlayer } from "./players";

// in matches.post, after insertDrinks(...):
await upsertPlayer(c.env.DB, body.Spiller);
await upsertPlayer(c.env.DB, body.Modstander);

// in matches.put, after the drinks-replace block:
await upsertPlayer(c.env.DB, body.Spiller);
await upsertPlayer(c.env.DB, body.Modstander);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/matches.test.ts test/players.test.ts` then `npm test`
Expected: PASS; full suite green (players count/rename/merge tests now pass because match create seeds the roster).

- [ ] **Step 5: Commit**

```bash
git add src/matches.ts test/matches.test.ts
git commit -m "feat(matches): auto-upsert Spiller/Modstander into the player roster"
```

---

## Self-Review

**Spec coverage:** signup-code gate + Env + test binding + fail-closed (Task 1); players table (Task 2); list-with-counts / upsert / rename / merge endpoints (Task 3); match auto-upsert (Task 4). ✅

**Placeholder scan:** none. **Type consistency:** `upsertPlayer`, `Env.SIGNUP_CODE`, players routes stable across tasks. Names are the match key; rename/merge rewrite `player`/`opponent` columns consistently. ✅

**Cross-task note:** Task 3's count/rename/merge tests rely on Task 4's auto-upsert to seed the roster from match creates; implement 3 and 4 together (the plan orders them adjacently), or the reviewer should treat 3's data-dependent tests as green only after 4. Flagged in Task 3 Step 5.
