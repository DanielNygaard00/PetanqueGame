# Backend Rewrite (Hono on Cloudflare Workers + D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Express + Firebase Firestore API with a Hono app running on Cloudflare Workers, backed by D1 (SQLite), preserving the exact API contract and CSV export format.

**Architecture:** A single Cloudflare Worker routes `/api/*` through a Hono application and serves the SPA (`client/dist`) for all other routes. Data lives in D1 (SQLite) accessed via prepared statements. Auth is JWT (`hono/jwt`); passwords are hashed with `bcryptjs`. The public API keeps the current Danish JSON keys; internally those map to snake_case columns.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, Wrangler, D1 (SQLite), `bcryptjs`, `hono/jwt`, Vitest + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Runtime is Cloudflare Workers (workerd) — no Node built-ins, no native addons. Pure-JS/Web-standard APIs only (`crypto.randomUUID()`, `crypto.subtle` available).
- API routes are prefixed `/api`. Protected routes require `Authorization: Bearer <jwt>`; JWT payload is `{ userId, username }`, expiry 24h.
- The wire contract uses the existing Danish keys exactly: `Dato, Gruppe_Bool, Gruppe_medlemmer, Konsekutive spil, Spiller, Arena, Modstander, Vundet, Point, Drik_Type, Drik_Kategori, Drik_Brand, Drik_Land, Drik_Navn, Vin_Region, Spillets genstande`.
- CSV export column order is exactly those 16 keys, UTF-8 with a leading BOM (`﻿`), filename `petanque_data.csv`.
- Empty passwords are allowed (friends' app). Username is unique.
- IDs are UUID strings (`crypto.randomUUID()`).
- Secrets: `JWT_SECRET` provided via Wrangler var/secret; D1 bound as `DB`.

---

### Task 1: Reconfigure project for Cloudflare Workers

**Files:**
- Modify: `package.json`
- Create: `wrangler.toml`
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts` (replace existing Express entry)
- Delete: `src/controllers/*.ts`, `src/routes/api.ts`, `src/middleware/auth.ts`, `src/lib/firebase.ts`, `dist/` (stale compiled output)

**Interfaces:**
- Produces: a Hono `app` default-exported from `src/index.ts`; an `Env` type (defined in Task 3) referenced by `wrangler.toml` bindings.

- [ ] **Step 1: Rewrite `package.json` dependencies and scripts**

```json
{
  "name": "petanque-server",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:local": "wrangler d1 migrations apply petanque --local",
    "db:migrate:remote": "wrangler d1 migrations apply petanque --remote"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20240909.0",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.78.0"
  }
}
```

- [ ] **Step 2: Delete the Express-era source and stale build output**

```bash
rm -rf src/controllers src/routes src/middleware src/lib dist
```

- [ ] **Step 3: Write `tsconfig.json` for Workers**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "lib": ["es2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Write `wrangler.toml`**

```toml
name = "petanque"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
JWT_SECRET = "dev-only-change-in-production"

[[d1_databases]]
binding = "DB"
database_name = "petanque"
database_id = "PLACEHOLDER_SET_AFTER_d1_create"

[assets]
directory = "client/dist"
not_found_handling = "single-page-application"
```

- [ ] **Step 5: Write a minimal Hono entry so the Worker boots**

```typescript
// src/index.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
```

- [ ] **Step 6: Write `vitest.config.ts` using the Workers pool**

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          bindings: { JWT_SECRET: "test-secret" },
        },
      },
    },
  },
});
```

- [ ] **Step 7: Install and verify the Worker boots**

Run: `npm install && npx wrangler dev --port 8787 &` then `sleep 3 && curl -s localhost:8787/health`
Expected: `{"status":"ok"}`. Stop the dev server afterward (`kill %1`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json wrangler.toml tsconfig.json vitest.config.ts src/index.ts
git commit -m "chore: reconfigure project as Cloudflare Worker (Hono)"
```

---

### Task 2: D1 schema and migrations

**Files:**
- Create: `migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `users`, `matches`, `options` with the columns below. Consumed by all data-access tasks.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0001_init.sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE matches (
  id                TEXT PRIMARY KEY,
  created_by        TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT,
  date              TEXT,
  is_group          INTEGER NOT NULL DEFAULT 0,
  group_members     TEXT,
  consecutive_games INTEGER,
  player            TEXT,
  arena             TEXT,
  opponent          TEXT,
  won               INTEGER NOT NULL DEFAULT 0,
  points            INTEGER,
  drink_type        TEXT,
  drink_category    TEXT,
  drink_brand       TEXT,
  drink_country     TEXT,
  drink_name        TEXT,
  wine_region       TEXT,
  game_items        TEXT
);
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_created_by ON matches(created_by);

CREATE TABLE options (
  id         TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_options_collection ON options(collection);
```

- [ ] **Step 2: Apply locally and verify tables exist**

Run: `npm run db:migrate:local && npx wrangler d1 execute petanque --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`
Expected: rows include `matches`, `options`, `users`.

- [ ] **Step 3: Commit**

```bash
git add migrations/0001_init.sql
git commit -m "feat: add D1 schema (users, matches, options)"
```

---

### Task 3: Environment bindings and match field mapping

**Files:**
- Create: `src/types.ts`
- Create: `src/mapping.ts`
- Test: `test/mapping.test.ts`

**Interfaces:**
- Produces:
  - `type Env = { DB: D1Database; JWT_SECRET: string }`
  - `type AppContext = { Bindings: Env; Variables: { userId: string; username: string } }`
  - `const MATCH_COLUMNS: string[]` — the 16 Danish keys in CSV order.
  - `toRow(apiBody: Record<string, unknown>): Record<string, unknown>` — Danish keys → snake_case columns.
  - `toApi(row: Record<string, unknown>): Record<string, unknown>` — row → Danish-keyed object plus `id`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/mapping.test.ts
import { describe, it, expect } from "vitest";
import { toRow, toApi, MATCH_COLUMNS } from "../src/mapping";

describe("match mapping", () => {
  it("maps Danish API keys to snake_case columns", () => {
    const row = toRow({ Dato: "2026-07-01", Vundet: true, Point: 13, Spiller: "Ida", Gruppe_Bool: false });
    expect(row.date).toBe("2026-07-01");
    expect(row.won).toBe(1);
    expect(row.is_group).toBe(0);
    expect(row.points).toBe(13);
    expect(row.player).toBe("Ida");
  });

  it("round-trips columns back to Danish keys with booleans restored", () => {
    const api = toApi({ id: "abc", date: "2026-07-01", won: 1, is_group: 0, points: 13, player: "Ida" });
    expect(api.id).toBe("abc");
    expect(api.Dato).toBe("2026-07-01");
    expect(api.Vundet).toBe(true);
    expect(api.Gruppe_Bool).toBe(false);
    expect(api.Spiller).toBe("Ida");
  });

  it("exposes the 16 export columns in order", () => {
    expect(MATCH_COLUMNS[0]).toBe("Dato");
    expect(MATCH_COLUMNS).toHaveLength(16);
    expect(MATCH_COLUMNS[MATCH_COLUMNS.length - 1]).toBe("Spillets genstande");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/mapping.test.ts`
Expected: FAIL — cannot resolve `../src/mapping`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/types.ts
export type Env = { DB: D1Database; JWT_SECRET: string };
export type AppContext = {
  Bindings: Env;
  Variables: { userId: string; username: string };
};
```

```typescript
// src/mapping.ts
// Danish API key -> DB column. Booleans stored as 0/1.
const KEY_TO_COL: Record<string, string> = {
  Dato: "date",
  Gruppe_Bool: "is_group",
  Gruppe_medlemmer: "group_members",
  "Konsekutive spil": "consecutive_games",
  Spiller: "player",
  Arena: "arena",
  Modstander: "opponent",
  Vundet: "won",
  Point: "points",
  Drik_Type: "drink_type",
  Drik_Kategori: "drink_category",
  Drik_Brand: "drink_brand",
  Drik_Land: "drink_country",
  Drik_Navn: "drink_name",
  Vin_Region: "wine_region",
  "Spillets genstande": "game_items",
};
const COL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_COL).map(([k, v]) => [v, k]),
);
const BOOL_COLS = new Set(["is_group", "won"]);

export const MATCH_COLUMNS = Object.keys(KEY_TO_COL); // 16 keys in insertion order

export function toRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(KEY_TO_COL)) {
    if (!(key in body)) continue;
    const val = body[key];
    row[col] = BOOL_COLS.has(col) ? (val ? 1 : 0) : val;
  }
  return row;
}

export function toApi(row: Record<string, unknown>): Record<string, unknown> {
  const api: Record<string, unknown> = { id: row.id };
  for (const [col, key] of Object.entries(COL_TO_KEY)) {
    if (!(col in row)) continue;
    api[key] = BOOL_COLS.has(col) ? Boolean(row[col]) : row[col];
  }
  return api;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/mapping.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/mapping.ts test/mapping.test.ts
git commit -m "feat: env types and Danish<->column match mapping"
```

---

### Task 4: Auth routes (signup, login)

**Files:**
- Create: `src/auth.ts`
- Test: `test/auth.test.ts`

**Interfaces:**
- Consumes: `Env`, `AppContext` from `src/types.ts`.
- Produces: `const auth = new Hono<AppContext>()` mounting `POST /signup` and `POST /login`, each returning `{ token, user: { id, username } }`. Exported as default.

- [ ] **Step 1: Write the failing test**

```typescript
// test/auth.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

async function post(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, env);
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM users");
});

describe("auth", () => {
  it("signs up a new user and returns a token", async () => {
    const res = await post("/api/auth/signup", { username: "ida", password: "pw" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.username).toBe("ida");
  });

  it("rejects duplicate usernames", async () => {
    await post("/api/auth/signup", { username: "ida" });
    const res = await post("/api/auth/signup", { username: "ida" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct password", async () => {
    await post("/api/auth/signup", { username: "ida", password: "pw" });
    const res = await post("/api/auth/login", { username: "ida", password: "pw" });
    expect(res.status).toBe(200);
    expect((await res.json()).token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    await post("/api/auth/signup", { username: "ida", password: "pw" });
    const res = await post("/api/auth/login", { username: "ida", password: "nope" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.test.ts`
Expected: FAIL — `/api/auth/signup` not mounted (404), since Task 10 wires it. (If run before Task 10, expect 404; this task's own logic is verified once mounted.)

- [ ] **Step 3: Write the implementation**

```typescript
// src/auth.ts
import { Hono } from "hono";
import { sign } from "hono/jwt";
import bcrypt from "bcryptjs";
import type { AppContext } from "./types";

const auth = new Hono<AppContext>();

auth.post("/signup", async (c) => {
  const { username, password, email } = await c.req.json().catch(() => ({}));
  if (!username) return c.json({ message: "Username required" }, 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username).first();
  if (existing) return c.json({ message: "Username already exists" }, 400);

  const sanitizedEmail = typeof email === "string" && email.trim() !== "" ? email : "";
  if (sanitizedEmail) {
    const emailTaken = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(sanitizedEmail).first();
    if (emailTaken) return c.json({ message: "Email already exists" }, 400);
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password ?? "", 10);
  await c.env.DB.prepare(
    "INSERT INTO users (id, username, password_hash, email, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, username, passwordHash, sanitizedEmail, new Date().toISOString()).run();

  const token = await sign(
    { userId: id, username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
    c.env.JWT_SECRET,
  );
  return c.json({ token, user: { id, username } }, 201);
});

auth.post("/login", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  if (!username) return c.json({ message: "Username required" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT id, username, password_hash FROM users WHERE username = ?",
  ).bind(username).first<{ id: string; username: string; password_hash: string }>();

  if (!user || !(await bcrypt.compare(password ?? "", user.password_hash))) {
    return c.json({ message: "Invalid username or password" }, 401);
  }

  const token = await sign(
    { userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
    c.env.JWT_SECRET,
  );
  return c.json({ token, user: { id: user.id, username: user.username } });
});

export default auth;
```

- [ ] **Step 4: Run tests after wiring (defer green to Task 10) or wire a temporary mount**

To verify this task in isolation now, temporarily add to `src/index.ts`: `import auth from "./auth"; app.route("/api/auth", auth);` then run `npx vitest run test/auth.test.ts`.
Expected: PASS (4 tests). Keep the mount — it is the same one Task 10 finalizes.

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts test/auth.test.ts src/index.ts
git commit -m "feat: signup/login with bcryptjs + hono/jwt"
```

---

### Task 5: JWT guard middleware and `/users` route

**Files:**
- Create: `src/guard.ts`
- Create: `src/users.ts`
- Test: `test/users.test.ts`

**Interfaces:**
- Consumes: `AppContext`.
- Produces:
  - `guard` — a Hono middleware that verifies the Bearer token, sets `c.set("userId", ...)` and `c.set("username", ...)`, else returns 401 (missing) / 403 (invalid).
  - `const users = new Hono<AppContext>()` with `GET /` → `[{ id, name }]` (name = username).

- [ ] **Step 1: Write the failing test**

```typescript
// test/users.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

async function token(username = "ida") {
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  }, env);
  return (await res.json()).token as string;
}

beforeEach(async () => { await env.DB.exec("DELETE FROM users"); });

describe("users + guard", () => {
  it("401 without a token", async () => {
    const res = await app.request("/api/users", {}, env);
    expect(res.status).toBe(401);
  });

  it("403 with a bad token", async () => {
    const res = await app.request("/api/users", { headers: { authorization: "Bearer nope" } }, env);
    expect(res.status).toBe(403);
  });

  it("lists users as {id, name}", async () => {
    const t = await token("ida");
    const res = await app.request("/api/users", { headers: { authorization: `Bearer ${t}` } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe("ida");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/users.test.ts`
Expected: FAIL — `src/guard`/`src/users` not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/guard.ts
import { verify } from "hono/jwt";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "./types";

export const guard: MiddlewareHandler<AppContext> = async (c, next) => {
  const header = c.req.header("authorization");
  const bearer = header?.split(" ")[1];
  if (!bearer) return c.json({ message: "Authentication required" }, 401);
  try {
    const payload = await verify(bearer, c.env.JWT_SECRET);
    c.set("userId", payload.userId as string);
    c.set("username", payload.username as string);
    await next();
  } catch {
    return c.json({ message: "Invalid or expired token" }, 403);
  }
};
```

```typescript
// src/users.ts
import { Hono } from "hono";
import type { AppContext } from "./types";

const users = new Hono<AppContext>();

users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, username FROM users").all();
  return c.json(results.map((r: any) => ({ id: r.id, name: r.username })));
});

export default users;
```

- [ ] **Step 4: Wire and run**

Add to `src/index.ts`: `import { guard } from "./guard"; import users from "./users"; app.use("/api/users/*", guard); app.use("/api/users", guard); app.route("/api/users", users);` then `npx vitest run test/users.test.ts`.
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/guard.ts src/users.ts test/users.test.ts src/index.ts
git commit -m "feat: JWT guard middleware and /users route"
```

---

### Task 6: Matches CRUD

**Files:**
- Create: `src/matches.ts`
- Test: `test/matches.test.ts`

**Interfaces:**
- Consumes: `AppContext`, `toRow`, `toApi` from Task 3, `guard` from Task 5.
- Produces: `const matches = new Hono<AppContext>()` with `POST /`, `GET /` (newest first by `date`), `PUT /:id`, `DELETE /:id`. Create/update accept Danish-keyed bodies; responses are Danish-keyed via `toApi`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/matches.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ida" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
}

);
const H = () => ({ authorization: auth, "content-type": "application/json" });

describe("matches CRUD", () => {
  it("creates, lists, updates and deletes a match", async () => {
    const create = await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Vundet: true, Point: 13 }),
    }, env);
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.Vundet).toBe(true);
    const id = created.id;

    const list = await app.request("/api/matches", { headers: H() }, env);
    expect((await list.json()).length).toBe(1);

    const upd = await app.request(`/api/matches/${id}`, {
      method: "PUT", headers: H(), body: JSON.stringify({ Point: 7, Vundet: false }),
    }, env);
    expect(upd.status).toBe(200);
    expect((await upd.json()).Vundet).toBe(false);

    const del = await app.request(`/api/matches/${id}`, { method: "DELETE", headers: H() }, env);
    expect(del.status).toBe(200);
    const empty = await app.request("/api/matches", { headers: H() }, env);
    expect((await empty.json()).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/matches.test.ts`
Expected: FAIL — matches routes not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/matches.ts
import { Hono } from "hono";
import type { AppContext } from "./types";
import { toRow, toApi } from "./mapping";

const matches = new Hono<AppContext>();

matches.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const row = toRow(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cols = ["id", "created_by", "created_at", ...Object.keys(row)];
  const vals = [id, c.get("userId"), now, ...Object.values(row)];
  const placeholders = cols.map(() => "?").join(", ");
  await c.env.DB.prepare(
    `INSERT INTO matches (${cols.join(", ")}) VALUES (${placeholders})`,
  ).bind(...vals).run();
  const created = await c.env.DB.prepare("SELECT * FROM matches WHERE id = ?").bind(id).first();
  return c.json(toApi(created as Record<string, unknown>), 201);
});

matches.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM matches ORDER BY date DESC",
  ).all();
  return c.json(results.map((r) => toApi(r as Record<string, unknown>)));
});

matches.put("/:id", async (c) => {
  const id = c.req.param("id");
  const row = toRow(await c.req.json().catch(() => ({})));
  row.updated_at = new Date().toISOString();
  const assignments = Object.keys(row).map((k) => `${k} = ?`).join(", ");
  await c.env.DB.prepare(`UPDATE matches SET ${assignments} WHERE id = ?`)
    .bind(...Object.values(row), id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM matches WHERE id = ?").bind(id).first();
  return c.json(toApi(updated as Record<string, unknown>));
});

matches.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ message: "Match entry deleted" });
});

export default matches;
```

- [ ] **Step 4: Wire and run**

Add to `src/index.ts`: `import matches from "./matches"; app.use("/api/matches", guard); app.use("/api/matches/*", guard); app.route("/api/matches", matches);` then `npx vitest run test/matches.test.ts`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches.ts test/matches.test.ts src/index.ts
git commit -m "feat: matches CRUD on D1"
```

---

### Task 7: Options and drink hierarchy

**Files:**
- Create: `src/options.ts`
- Test: `test/options.test.ts`

**Interfaces:**
- Consumes: `AppContext`, `guard`.
- Produces: `const options = new Hono<AppContext>()` with `GET /drinks/hierarchy` → `{ types, categories, brands, names }`, `GET /:collection` → `[{ id, name }]`, `POST /:collection` → `{ id, name }`. Route order: hierarchy declared before `/:collection`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/options.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM options");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ida" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

describe("options", () => {
  it("adds and lists options in a collection", async () => {
    const add = await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Kongens Have" }),
    }, env);
    expect(add.status).toBe(201);
    const list = await app.request("/api/options/arenas", { headers: H() }, env);
    expect((await list.json())[0].name).toBe("Kongens Have");
  });

  it("returns the drink hierarchy shape", async () => {
    await app.request("/api/options/drink_types", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Vin" }),
    }, env);
    const res = await app.request("/api/options/drinks/hierarchy", { headers: H() }, env);
    const body = await res.json();
    expect(Array.isArray(body.types)).toBe(true);
    expect(body.types[0].name).toBe("Vin");
    expect(body).toHaveProperty("categories");
    expect(body).toHaveProperty("brands");
    expect(body).toHaveProperty("names");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/options.test.ts`
Expected: FAIL — options routes not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/options.ts
import { Hono } from "hono";
import type { AppContext } from "./types";

const options = new Hono<AppContext>();

async function listCollection(db: D1Database, collection: string) {
  const { results } = await db.prepare(
    "SELECT id, name FROM options WHERE collection = ? ORDER BY name",
  ).bind(collection).all();
  return results;
}

// Must be declared before "/:collection" so it is not shadowed.
options.get("/drinks/hierarchy", async (c) => {
  const [types, categories, brands, names] = await Promise.all([
    listCollection(c.env.DB, "drink_types"),
    listCollection(c.env.DB, "drink_categories"),
    listCollection(c.env.DB, "drink_brands"),
    listCollection(c.env.DB, "drink_names"),
  ]);
  return c.json({ types, categories, brands, names });
});

options.get("/:collection", async (c) => {
  return c.json(await listCollection(c.env.DB, c.req.param("collection")));
});

options.post("/:collection", async (c) => {
  const { name } = await c.req.json().catch(() => ({}));
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO options (id, collection, name, created_at) VALUES (?, ?, ?, ?)",
  ).bind(id, c.req.param("collection"), name, new Date().toISOString()).run();
  return c.json({ id, name }, 201);
});

export default options;
```

- [ ] **Step 4: Wire and run**

Add to `src/index.ts`: `import options from "./options"; app.use("/api/options", guard); app.use("/api/options/*", guard); app.route("/api/options", options);` then `npx vitest run test/options.test.ts`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/options.ts test/options.test.ts src/index.ts
git commit -m "feat: options + drink hierarchy on D1"
```

---

### Task 8: CSV export

**Files:**
- Create: `src/csv.ts`
- Create: `src/export.ts`
- Test: `test/csv.test.ts`, `test/export.test.ts`

**Interfaces:**
- Consumes: `AppContext`, `MATCH_COLUMNS` and `toApi` from Task 3, `guard`.
- Produces:
  - `toCsv(headers: string[], rows: string[][]): string` — RFC-4180-ish quoting (quote when value has `,`, `"`, or newline; escape `"`→`""`).
  - `const exportRoute = new Hono<AppContext>()` with `GET /` → `text/csv`, BOM-prefixed, `Content-Disposition: attachment; filename=petanque_data.csv`.

- [ ] **Step 1: Write the failing tests**

```typescript
// test/csv.test.ts
import { describe, it, expect } from "vitest";
import { toCsv } from "../src/csv";

describe("toCsv", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    const out = toCsv(["a", "b"], [["x,y", 'he said "hi"']]);
    expect(out).toBe('a,b\r\n"x,y","he said ""hi"""\r\n');
  });
});
```

```typescript
// test/export.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ida" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});

describe("export", () => {
  it("returns BOM-prefixed CSV with the 16 Danish headers", async () => {
    await app.request("/api/matches", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Point: 13 }),
    }, env);
    const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("petanque_data.csv");
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("Dato,");
    expect(text).toContain("Spillets genstande");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/csv.test.ts test/export.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/csv.ts
function escape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escape).join(","));
  return lines.join("\r\n") + "\r\n";
}
```

```typescript
// src/export.ts
import { Hono } from "hono";
import type { AppContext } from "./types";
import { MATCH_COLUMNS, toApi } from "./mapping";
import { toCsv } from "./csv";

const exportRoute = new Hono<AppContext>();

exportRoute.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM matches ORDER BY date ASC").all();
  const rows = results.map((r) => {
    const api = toApi(r as Record<string, unknown>);
    return MATCH_COLUMNS.map((col) => {
      const v = api[col];
      return v === undefined || v === null ? "" : String(v);
    });
  });
  const csv = "﻿" + toCsv(MATCH_COLUMNS, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=petanque_data.csv",
    },
  });
});

export default exportRoute;
```

- [ ] **Step 4: Wire and run**

Add to `src/index.ts`: `import exportRoute from "./export"; app.use("/api/export", guard); app.route("/api/export", exportRoute);` then `npx vitest run test/csv.test.ts test/export.test.ts`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/csv.ts src/export.ts test/csv.test.ts test/export.test.ts src/index.ts
git commit -m "feat: CSV export with BOM and Danish headers"
```

---

### Task 9: Finalize app wiring (CORS, logger, full route table)

**Files:**
- Modify: `src/index.ts`
- Test: `test/app.test.ts`

**Interfaces:**
- Consumes: all route modules and `guard`.
- Produces: the final `src/index.ts` — the single source of truth for the route table. Replaces any temporary mounts added in earlier tasks.

- [ ] **Step 1: Write the failing test**

```typescript
// test/app.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("app wiring", () => {
  it("serves /health", async () => {
    const res = await app.request("/health", {}, env);
    expect(await res.json()).toEqual({ status: "ok" });
  });
  it("sends CORS headers", async () => {
    const res = await app.request("/api/matches", { headers: { origin: "http://localhost:5173" } }, env);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });
  it("guards protected api routes", async () => {
    const res = await app.request("/api/matches", {}, env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify current state**

Run: `npx vitest run test/app.test.ts`
Expected: `/health` passes; CORS test FAILS (cors not yet added).

- [ ] **Step 3: Write the final `src/index.ts`**

```typescript
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppContext } from "./types";
import { guard } from "./guard";
import auth from "./auth";
import users from "./users";
import matches from "./matches";
import options from "./options";
import exportRoute from "./export";

const app = new Hono<AppContext>();

app.use("*", logger());
app.use("/api/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", auth);

app.use("/api/users", guard);
app.use("/api/users/*", guard);
app.route("/api/users", users);

app.use("/api/matches", guard);
app.use("/api/matches/*", guard);
app.route("/api/matches", matches);

app.use("/api/options", guard);
app.use("/api/options/*", guard);
app.route("/api/options", options);

app.use("/api/export", guard);
app.route("/api/export", exportRoute);

export default app;
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all suites (mapping, auth, users, matches, options, csv, export, app).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/app.test.ts
git commit -m "feat: finalize Worker route table with CORS and logging"
```

---

### Task 10: Deployment documentation

**Files:**
- Create: `README.md` (or update if present)

**Interfaces:**
- Produces: reproducible commands to create D1, apply migrations, set the JWT secret, run locally, and deploy.

- [ ] **Step 1: Write the README deployment section**

````markdown
# PétanqueGame

Cloudflare Worker (Hono) API + D1 (SQLite), serving a Vite/React SPA.

## Local development

```bash
npm install
npm run db:migrate:local        # applies migrations to a local SQLite D1
npm run dev                     # wrangler dev on http://localhost:8787
npm test                        # vitest (Workers pool)
```

## First-time Cloudflare setup

```bash
npx wrangler login
npx wrangler d1 create petanque            # copy the printed database_id into wrangler.toml
npm run db:migrate:remote                  # apply schema to the remote D1
npx wrangler secret put JWT_SECRET         # set a strong secret (do NOT rely on [vars])
```

## Deploy (free tier)

```bash
# build the frontend first (see client/ plan) so client/dist exists
npm run deploy                             # wrangler deploy — API + SPA in one Worker
```
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: Cloudflare deployment and local dev instructions"
```

---

## Self-Review

**Spec coverage:**
- Hono/Workers/D1 runtime → Tasks 1, 2, 9. ✅
- API contract preserved (all routes) → Tasks 4–8. ✅
- Danish keys ↔ columns + CSV order → Task 3, 8. ✅
- bcryptjs / hono/jwt / hand-rolled CSV swaps → Tasks 4, 5, 8. ✅
- Single Worker serves API + SPA (`assets` binding) → Task 1 (`wrangler.toml`), Task 9. ✅
- Local dev with zero credentials (`wrangler dev` + local D1) → Tasks 1, 2, 10. ✅
- Dependency add/remove list → Task 1. ✅
- Worker testing via `@cloudflare/vitest-pool-workers` → all test tasks. ✅
- Empty-password-allowed, unique username → Task 4. ✅

**Placeholder scan:** `database_id` in `wrangler.toml` is an intentional placeholder set by `wrangler d1 create` (documented in Task 10). No other placeholders.

**Type consistency:** `Env`/`AppContext` (Task 3) used consistently; `toRow`/`toApi`/`MATCH_COLUMNS` names stable across Tasks 3/6/8; `guard` signature stable across Tasks 5/9. ✅

**Note on incremental wiring:** Tasks 4–8 add their mount to `src/index.ts` and Task 9 rewrites it to the canonical table. This is intentional so each task is independently green; Task 9's version is authoritative.
