# v2 Backend — Drinks, Sessions & Analytics Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the Worker/D1 backend to store multiple drinks per match (each with a count), match time-of-day, and opponent score; validate inputs; normalize option lists; and export a tidy long-format CSV.

**Architecture:** Add a `match_drinks` child table; matches gain `time` and `opponent_points` and lose their embedded single-drink columns. Match create/update accept and return a nested `drinks` array; delete cascades in app code. CSV export becomes one row per match×drink.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, D1 (SQLite), Vitest + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- No data migration: production D1 is empty; the contract may change freely.
- Match JSON keeps Danish keys plus new `Tid` (→ `time`) and `Modstander_Point` (→ `opponent_points`); drinks are a nested array `drinks: [{ type, category, brand, name, country, wineRegion, count, volumeCl }]` (clean English sub-keys; `count` default 1; `volumeCl` optional).
- Drinks live in `match_drinks`; matches no longer have `drink_*`/`wine_region` columns. `game_items` stays.
- Validation (HTTP 400): `Dato` required, `Spiller` required, `Point`/`Modstander_Point` integers within `0..50` when present, each drink `count >= 1`.
- Option add normalizes: trim, and case-insensitive dedupe within the collection (return existing rather than insert).
- CSV export: one row per match×drink (match with no drinks → one row, blank drink cells), UTF-8 + BOM, filename `petanque_data.csv`, columns exactly: `Dato, Tid, Spiller, Arena, Modstander, Vundet, Point, Modstander_Point, Margin, Gruppe_Bool, Gruppe_medlemmer, Konsekutive spil, Spillets genstande, Drik_Type, Drik_Kategori, Drik_Brand, Drik_Land, Drik_Navn, Vin_Region, Antal, Volumen_cl`. Booleans → `1`/empty; `Margin = Point − Modstander_Point` when both present else blank.
- IDs `crypto.randomUUID()`; timestamps ISO strings.
- Tests run in the Workers pool; migrations auto-apply via the existing `test/apply-migrations.ts` setupFile.

---

### Task 1: Migration 0002 — matches columns + match_drinks table

**Files:**
- Create: `migrations/0002_drinks_and_session.sql`

**Interfaces:**
- Produces: `matches.time`, `matches.opponent_points`; dropped `matches.{drink_type,drink_category,drink_brand,drink_country,drink_name,wine_region}`; new table `match_drinks`.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0002_drinks_and_session.sql
ALTER TABLE matches ADD COLUMN time TEXT;
ALTER TABLE matches ADD COLUMN opponent_points INTEGER;

ALTER TABLE matches DROP COLUMN drink_type;
ALTER TABLE matches DROP COLUMN drink_category;
ALTER TABLE matches DROP COLUMN drink_brand;
ALTER TABLE matches DROP COLUMN drink_country;
ALTER TABLE matches DROP COLUMN drink_name;
ALTER TABLE matches DROP COLUMN wine_region;

CREATE TABLE match_drinks (
  id             TEXT PRIMARY KEY,
  match_id       TEXT NOT NULL,
  drink_type     TEXT,
  drink_category TEXT,
  drink_brand    TEXT,
  drink_name     TEXT,
  drink_country  TEXT,
  wine_region    TEXT,
  count          INTEGER NOT NULL DEFAULT 1,
  volume_cl      REAL,
  position       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_match_drinks_match_id ON match_drinks(match_id);
```

- [ ] **Step 2: Apply locally and verify**

Run: `npm run db:migrate:local && npx wrangler d1 execute petanque --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name; PRAGMA table_info(matches);"`
Expected: `match_drinks` present; `matches` has `time`, `opponent_points`, and no `drink_*`/`wine_region` columns.

- [ ] **Step 3: Commit**

```bash
git add migrations/0002_drinks_and_session.sql
git commit -m "feat(db): v2 schema — match_drinks table, match time + opponent_points"
```

---

### Task 2: Update match field mapping

**Files:**
- Modify: `src/mapping.ts`
- Test: `test/mapping.test.ts`

**Interfaces:**
- Produces: `toRow`/`toApi` covering the match-level keys only — Danish match keys minus the six drink keys, plus `Tid → time` and `Modstander_Point → opponent_points`. `MATCH_COLUMNS` is no longer used by export (export defines its own column list in Task 6); keep exporting it but update it to the new match key set.

- [ ] **Step 1: Update the failing test**

```typescript
// test/mapping.test.ts — replace the mapping describe block
import { describe, it, expect } from "vitest";
import { toRow, toApi } from "../src/mapping";

describe("match mapping v2", () => {
  it("maps match-level Danish keys incl. Tid and Modstander_Point", () => {
    const row = toRow({ Dato: "2026-07-01", Tid: "18:30", Vundet: true, Point: 13, Modstander_Point: 7, Spiller: "Ida" });
    expect(row.date).toBe("2026-07-01");
    expect(row.time).toBe("18:30");
    expect(row.won).toBe(1);
    expect(row.points).toBe(13);
    expect(row.opponent_points).toBe(7);
    expect(row.player).toBe("Ida");
  });

  it("does NOT map drink keys (drinks live in match_drinks now)", () => {
    const row = toRow({ Drik_Type: "Vin", Drik_Navn: "Rosé" } as any);
    expect(row.drink_type).toBeUndefined();
    expect("drink_type" in row).toBe(false);
  });

  it("round-trips a match row back to Danish keys with booleans + new fields", () => {
    const api = toApi({ id: "m1", date: "2026-07-01", time: "18:30", won: 1, is_group: 0, points: 13, opponent_points: 7, player: "Ida" });
    expect(api.Dato).toBe("2026-07-01");
    expect(api.Tid).toBe("18:30");
    expect(api.Vundet).toBe(true);
    expect(api.Gruppe_Bool).toBe(false);
    expect(api.Point).toBe(13);
    expect(api.Modstander_Point).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/mapping.test.ts`
Expected: FAIL — `Tid`/`Modstander_Point` not mapped; drink keys still mapped.

- [ ] **Step 3: Update the implementation**

```typescript
// src/mapping.ts
const KEY_TO_COL: Record<string, string> = {
  Dato: "date",
  Tid: "time",
  Gruppe_Bool: "is_group",
  Gruppe_medlemmer: "group_members",
  "Konsekutive spil": "consecutive_games",
  Spiller: "player",
  Arena: "arena",
  Modstander: "opponent",
  Vundet: "won",
  Point: "points",
  Modstander_Point: "opponent_points",
  "Spillets genstande": "game_items",
};
const COL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_COL).map(([k, v]) => [v, k]),
);
const BOOL_COLS = new Set(["is_group", "won"]);

export const MATCH_COLUMNS = Object.keys(KEY_TO_COL);

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
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mapping.ts test/mapping.test.ts
git commit -m "feat(mapping): match-level keys with Tid/Modstander_Point, drop drink keys"
```

---

### Task 3: Drink (de)serialization helpers

**Files:**
- Create: `src/drinks.ts`
- Test: `test/drinks.test.ts`

**Interfaces:**
- Produces:
  - `drinkToRow(apiDrink, matchId, position)` → `{ id, match_id, drink_type, drink_category, drink_brand, drink_name, drink_country, wine_region, count, volume_cl, position }`. `count` defaults to 1; `volume_cl` null when absent; `id = crypto.randomUUID()`.
  - `drinkToApi(row)` → `{ type, category, brand, name, country, wineRegion, count, volumeCl }`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/drinks.test.ts
import { describe, it, expect } from "vitest";
import { drinkToRow, drinkToApi } from "../src/drinks";

describe("drink mapping", () => {
  it("maps an api drink to a row with defaults", () => {
    const row = drinkToRow({ type: "Vin", category: "Rosé", name: "Whispering Angel", wineRegion: "Provence" }, "m1", 2);
    expect(row.match_id).toBe("m1");
    expect(row.drink_type).toBe("Vin");
    expect(row.drink_category).toBe("Rosé");
    expect(row.wine_region).toBe("Provence");
    expect(row.count).toBe(1);         // default
    expect(row.volume_cl).toBeNull();  // absent -> null
    expect(row.position).toBe(2);
    expect(typeof row.id).toBe("string");
  });

  it("carries count and volume through", () => {
    const row = drinkToRow({ type: "Øl", count: 3, volumeCl: 33 }, "m1", 0);
    expect(row.count).toBe(3);
    expect(row.volume_cl).toBe(33);
  });

  it("maps a row back to an api drink", () => {
    const d = drinkToApi({ drink_type: "Øl", drink_category: null, drink_brand: "Tuborg", drink_name: null, drink_country: "DK", wine_region: null, count: 2, volume_cl: 33 });
    expect(d).toEqual({ type: "Øl", category: null, brand: "Tuborg", name: null, country: "DK", wineRegion: null, count: 2, volumeCl: 33 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/drinks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/drinks.ts
export type ApiDrink = {
  type?: string | null;
  category?: string | null;
  brand?: string | null;
  name?: string | null;
  country?: string | null;
  wineRegion?: string | null;
  count?: number;
  volumeCl?: number | null;
};

export function drinkToRow(d: ApiDrink, matchId: string, position: number) {
  return {
    id: crypto.randomUUID(),
    match_id: matchId,
    drink_type: d.type ?? null,
    drink_category: d.category ?? null,
    drink_brand: d.brand ?? null,
    drink_name: d.name ?? null,
    drink_country: d.country ?? null,
    wine_region: d.wineRegion ?? null,
    count: typeof d.count === "number" && d.count > 0 ? d.count : 1,
    volume_cl: typeof d.volumeCl === "number" ? d.volumeCl : null,
    position,
  };
}

export function drinkToApi(row: Record<string, unknown>): ApiDrink {
  return {
    type: (row.drink_type as string) ?? null,
    category: (row.drink_category as string) ?? null,
    brand: (row.drink_brand as string) ?? null,
    name: (row.drink_name as string) ?? null,
    country: (row.drink_country as string) ?? null,
    wineRegion: (row.wine_region as string) ?? null,
    count: (row.count as number) ?? 1,
    volumeCl: (row.volume_cl as number) ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/drinks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/drinks.ts test/drinks.test.ts
git commit -m "feat(drinks): drink row<->api mapping helpers"
```

---

### Task 4: Matches CRUD v2 (nested drinks + validation)

**Files:**
- Modify: `src/matches.ts`
- Create: `src/validate.ts`
- Test: `test/matches.test.ts` (extend), `test/validate.test.ts`

**Interfaces:**
- Consumes: `toRow`, `toApi` (Task 2), `drinkToRow`, `drinkToApi` (Task 3).
- Produces:
  - `validateMatch(body)` → `string | null` (error message or null). Enforces the validation constraints.
  - Matches routes: `POST /` (insert match + drinks, 400 on invalid), `GET /` (each match includes `drinks` ordered by position), `PUT /:id` (update fields + replace drinks), `DELETE /:id` (delete drinks then match). Responses include `drinks`.

- [ ] **Step 1: Write the failing tests**

```typescript
// test/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateMatch } from "../src/validate";

describe("validateMatch", () => {
  it("requires Dato and Spiller", () => {
    expect(validateMatch({ Spiller: "Ida" })).toMatch(/dato/i);
    expect(validateMatch({ Dato: "2026-07-01" })).toMatch(/spiller/i);
  });
  it("rejects out-of-range scores", () => {
    expect(validateMatch({ Dato: "d", Spiller: "Ida", Point: 99 })).toMatch(/point/i);
    expect(validateMatch({ Dato: "d", Spiller: "Ida", Modstander_Point: -1 })).toMatch(/point/i);
  });
  it("rejects drink count < 1", () => {
    expect(validateMatch({ Dato: "d", Spiller: "Ida", drinks: [{ type: "Øl", count: 0 }] })).toMatch(/count/i);
  });
  it("accepts a valid match", () => {
    expect(validateMatch({ Dato: "d", Spiller: "Ida", Point: 13, Modstander_Point: 7, drinks: [{ type: "Øl", count: 2 }] })).toBeNull();
  });
});
```

```typescript
// test/matches.test.ts — add to the existing suite (keep imports/beforeEach)
it("creates a match with a drinks list and returns them nested", async () => {
  const res = await app.request("/api/matches", {
    method: "POST", headers: H(),
    body: JSON.stringify({
      Dato: "2026-07-01", Tid: "18:30", Spiller: "Ida", Vundet: true, Point: 13, Modstander_Point: 7,
      drinks: [{ type: "Øl", count: 3, volumeCl: 33 }, { type: "Vin", category: "Rosé", count: 1, volumeCl: 15 }],
    }),
  }, env);
  expect(res.status).toBe(201);
  const m = await res.json();
  expect(m.Tid).toBe("18:30");
  expect(m.Modstander_Point).toBe(7);
  expect(m.drinks).toHaveLength(2);
  expect(m.drinks[0]).toMatchObject({ type: "Øl", count: 3, volumeCl: 33 });

  const list = await app.request("/api/matches", { headers: H() }, env);
  const [row] = await list.json();
  expect(row.drinks).toHaveLength(2);
});

it("replaces drinks on update", async () => {
  const created = await (await app.request("/api/matches", {
    method: "POST", headers: H(),
    body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", drinks: [{ type: "Øl", count: 1 }] }),
  }, env)).json();
  const upd = await app.request(`/api/matches/${created.id}`, {
    method: "PUT", headers: H(),
    body: JSON.stringify({ Point: 11, drinks: [{ type: "Vin", count: 2 }] }),
  }, env);
  const m = await upd.json();
  expect(m.drinks).toHaveLength(1);
  expect(m.drinks[0].type).toBe("Vin");
});

it("400s an invalid match", async () => {
  const res = await app.request("/api/matches", {
    method: "POST", headers: H(), body: JSON.stringify({ Spiller: "Ida" }),
  }, env);
  expect(res.status).toBe(400);
});

it("deletes a match and its drinks", async () => {
  const created = await (await app.request("/api/matches", {
    method: "POST", headers: H(),
    body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", drinks: [{ type: "Øl", count: 1 }] }),
  }, env)).json();
  await app.request(`/api/matches/${created.id}`, { method: "DELETE", headers: H() }, env);
  const remaining = await env.DB.prepare("SELECT COUNT(*) AS n FROM match_drinks WHERE match_id = ?").bind(created.id).first();
  expect(remaining.n).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/validate.test.ts test/matches.test.ts`
Expected: FAIL — `validateMatch` missing; drinks not handled.

- [ ] **Step 3: Write validation**

```typescript
// src/validate.ts
export function validateMatch(body: Record<string, any>): string | null {
  if (!body?.Dato) return "Dato is required";
  if (!body?.Spiller) return "Spiller is required";
  for (const key of ["Point", "Modstander_Point"]) {
    const v = body[key];
    if (v === undefined || v === null || v === "") continue;
    if (!Number.isInteger(v) || v < 0 || v > 50) return `${key} must be an integer 0..50`;
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

- [ ] **Step 4: Write matches CRUD v2**

```typescript
// src/matches.ts
import { Hono } from "hono";
import type { AppContext } from "./types";
import { toRow, toApi } from "./mapping";
import { drinkToRow, drinkToApi, type ApiDrink } from "./drinks";
import { validateMatch } from "./validate";

const matches = new Hono<AppContext>();

async function drinksFor(db: D1Database, matchId: string): Promise<ApiDrink[]> {
  const { results } = await db.prepare(
    "SELECT * FROM match_drinks WHERE match_id = ? ORDER BY position",
  ).bind(matchId).all();
  return results.map((r) => drinkToApi(r as Record<string, unknown>));
}

async function insertDrinks(db: D1Database, matchId: string, drinks: ApiDrink[]) {
  for (let i = 0; i < drinks.length; i++) {
    const r = drinkToRow(drinks[i], matchId, i);
    await db.prepare(
      `INSERT INTO match_drinks (id, match_id, drink_type, drink_category, drink_brand, drink_name, drink_country, wine_region, count, volume_cl, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(r.id, r.match_id, r.drink_type, r.drink_category, r.drink_brand, r.drink_name, r.drink_country, r.wine_region, r.count, r.volume_cl, r.position).run();
  }
}

async function matchWithDrinks(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM matches WHERE id = ?").bind(id).first();
  const api = toApi(row as Record<string, unknown>);
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
  await insertDrinks(c.env.DB, id, Array.isArray(body.drinks) ? body.drinks : []);
  return c.json(await matchWithDrinks(c.env.DB, id), 201);
});

matches.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM matches ORDER BY date DESC").all();
  const out = [];
  for (const r of results) {
    const api = toApi(r as Record<string, unknown>);
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
  if (Array.isArray(body.drinks)) {
    await c.env.DB.prepare("DELETE FROM match_drinks WHERE match_id = ?").bind(id).run();
    await insertDrinks(c.env.DB, id, body.drinks);
  }
  return c.json(await matchWithDrinks(c.env.DB, id));
});

matches.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM match_drinks WHERE match_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(id).run();
  return c.json({ message: "Match entry deleted" });
});

export default matches;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/validate.test.ts test/matches.test.ts` then `npm test`
Expected: PASS; full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/matches.ts src/validate.ts test/matches.test.ts test/validate.test.ts
git commit -m "feat(matches): nested drinks CRUD, time/opponent, validation"
```

---

### Task 5: Option normalization

**Files:**
- Modify: `src/options.ts`
- Test: `test/options.test.ts` (extend)

**Interfaces:**
- Produces: `POST /api/options/:collection` trims `name`; if a case-insensitive match exists in the collection, returns that existing `{ id, name }` (201/200) without inserting a duplicate.

- [ ] **Step 1: Write the failing test**

```typescript
// test/options.test.ts — add
it("does not create case/whitespace duplicates", async () => {
  const a = await (await app.request("/api/options/arenas", {
    method: "POST", headers: H(), body: JSON.stringify({ name: "Kongens Have" }),
  }, env)).json();
  const b = await (await app.request("/api/options/arenas", {
    method: "POST", headers: H(), body: JSON.stringify({ name: "  kongens have " }),
  }, env)).json();
  expect(b.id).toBe(a.id);
  const list = await (await app.request("/api/options/arenas", { headers: H() }, env)).json();
  expect(list).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/options.test.ts`
Expected: FAIL — a second option row is created.

- [ ] **Step 3: Update the POST handler**

```typescript
// src/options.ts — replace the POST handler body
options.post("/:collection", async (c) => {
  const collection = c.req.param("collection");
  const raw = (await c.req.json().catch(() => ({}))).name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return c.json({ message: "Name required" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT id, name FROM options WHERE collection = ? AND lower(name) = lower(?)",
  ).bind(collection, name).first<{ id: string; name: string }>();
  if (existing) return c.json(existing, 200);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO options (id, collection, name, created_at) VALUES (?, ?, ?, ?)",
  ).bind(id, collection, name, new Date().toISOString()).run();
  return c.json({ id, name }, 201);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/options.test.ts`
Expected: PASS (existing tests + the dedupe test).

- [ ] **Step 5: Commit**

```bash
git add src/options.ts test/options.test.ts
git commit -m "feat(options): trim + case-insensitive dedupe on add"
```

---

### Task 6: Tidy long-format CSV export

**Files:**
- Modify: `src/export.ts`
- Test: `test/export.test.ts` (rewrite)

**Interfaces:**
- Consumes: `toApi` (Task 2), `drinkToApi` (Task 3), `toCsv` (existing `src/csv.ts`).
- Produces: `GET /api/export` → one row per match×drink with the exact 21-column header list from Global Constraints; match with no drinks emits one row with blank drink cells; booleans `1`/empty; `Margin` computed; BOM + `text/csv`.

- [ ] **Step 1: Rewrite the failing test**

```typescript
// test/export.test.ts — replace the export test body (keep auth beforeEach)
it("exports tidy long format: one row per match x drink with new columns", async () => {
  await app.request("/api/matches", {
    method: "POST", headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({
      Dato: "2026-07-01", Tid: "18:30", Spiller: "Ida", Vundet: true, Point: 13, Modstander_Point: 7,
      drinks: [{ type: "Øl", count: 3, volumeCl: 33 }, { type: "Vin", category: "Rosé", count: 1 }],
    }),
  }, env);
  const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
  const text = await res.text();
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trim().split("\r\n");
  expect(lines[0]).toContain("Modstander_Point");
  expect(lines[0]).toContain("Margin");
  expect(lines[0]).toContain("Antal");
  expect(lines[0]).toContain("Volumen_cl");
  // two drinks -> two data rows
  expect(lines).toHaveLength(3);
  // margin = 13 - 7 = 6 present on the rows
  expect(lines[1]).toContain(",6,");
});

it("emits one row for a match with no drinks", async () => {
  await app.request("/api/matches", {
    method: "POST", headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ Dato: "2026-07-02", Spiller: "Bo" }),
  }, env);
  const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
  const lines = (await res.text()).slice(1).trim().split("\r\n");
  expect(lines.length).toBe(2); // header + one row
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/export.test.ts`
Expected: FAIL — old column set / single-drink shape.

- [ ] **Step 3: Rewrite the export**

```typescript
// src/export.ts
import { Hono } from "hono";
import type { AppContext } from "./types";
import { toApi } from "./mapping";
import { drinkToApi } from "./drinks";
import { toCsv } from "./csv";

const exportRoute = new Hono<AppContext>();

const HEADERS = [
  "Dato", "Tid", "Spiller", "Arena", "Modstander", "Vundet", "Point", "Modstander_Point", "Margin",
  "Gruppe_Bool", "Gruppe_medlemmer", "Konsekutive spil", "Spillets genstande",
  "Drik_Type", "Drik_Kategori", "Drik_Brand", "Drik_Land", "Drik_Navn", "Vin_Region", "Antal", "Volumen_cl",
];
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const b = (v: unknown) => (v ? "1" : "");

exportRoute.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM matches ORDER BY date ASC").all();
  const rows: string[][] = [];
  for (const r of results) {
    const m = toApi(r as Record<string, unknown>);
    const { results: drinkRows } = await c.env.DB.prepare(
      "SELECT * FROM match_drinks WHERE match_id = ? ORDER BY position",
    ).bind(m.id).all();
    const margin = (typeof m.Point === "number" && typeof m.Modstander_Point === "number")
      ? String((m.Point as number) - (m.Modstander_Point as number)) : "";
    const matchCells = [
      s(m.Dato), s(m.Tid), s(m.Spiller), s(m.Arena), s(m.Modstander), b(m.Vundet), s(m.Point), s(m.Modstander_Point), margin,
      b(m.Gruppe_Bool), s(m.Gruppe_medlemmer), s(m["Konsekutive spil"]), s(m["Spillets genstande"]),
    ];
    const drinks = drinkRows.map((d) => drinkToApi(d as Record<string, unknown>));
    if (drinks.length === 0) {
      rows.push([...matchCells, "", "", "", "", "", "", "", ""]);
    } else {
      for (const d of drinks) {
        rows.push([...matchCells, s(d.type), s(d.category), s(d.brand), s(d.country), s(d.name), s(d.wineRegion), s(d.count), s(d.volumeCl)]);
      }
    }
  }
  const csv = "﻿" + toCsv(HEADERS, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=petanque_data.csv",
    },
  });
});

export default exportRoute;
```

- [ ] **Step 4: Run tests + full suite**

Run: `npx vitest run test/export.test.ts` then `npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/export.ts test/export.test.ts
git commit -m "feat(export): tidy long-format CSV (one row per match x drink)"
```

---

## Self-Review

**Spec coverage:** match_drinks + matches columns (Task 1); mapping incl. Tid/Modstander_Point, drop drink keys (Task 2); drink mapping (Task 3); nested-drinks CRUD + validation + cascade delete (Task 4); option normalization (Task 5); tidy CSV (Task 6). ✅

**Placeholder scan:** none. **Type consistency:** `ApiDrink`, `drinkToRow`/`drinkToApi`, `toRow`/`toApi`, `validateMatch` names stable across tasks. ✅

**Note:** `matchWithDrinks` re-reads after write (consistent with v1 patterns); the global `onError` (already in `src/index.ts`) still catches unexpected throws.
