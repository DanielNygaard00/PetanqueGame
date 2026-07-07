// src/options.ts
import { Hono } from "hono";
import type { AppContext } from "./types";

const options = new Hono<AppContext>();

// Historical text columns per collection. Trusted constants — never derive from input.
const COLUMN_MAP: Record<string, { table: string; column: string }> = {
  arenas: { table: "matches", column: "Arena" },
  drink_types: { table: "match_drinks", column: "drink_type" },
  drink_categories: { table: "match_drinks", column: "drink_category" },
  drink_brands: { table: "match_drinks", column: "drink_brand" },
  drink_names: { table: "match_drinks", column: "drink_name" },
};

async function listCollection(db: D1Database, collection: string) {
  const { results } = await db.prepare(
    "SELECT id, name FROM options WHERE collection = ? ORDER BY name",
  ).bind(collection).all();
  const map = COLUMN_MAP[collection];
  const out = [];
  for (const r of results as { id: string; name: string }[]) {
    let uses = 0;
    if (map) {
      const row = await db.prepare(
        `SELECT COUNT(*) AS n FROM ${map.table} WHERE ${map.column} = ?`,
      ).bind(r.name).first<{ n: number }>();
      uses = row?.n ?? 0;
    }
    out.push({ ...r, uses });
  }
  return out;
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
  const collection = c.req.param("collection");
  const raw = (await c.req.json().catch(() => ({}))).name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return c.json({ message: "Name required" }, 400);

  const key = name.toLowerCase(); // Unicode-aware in JS
  const { results } = await c.env.DB.prepare(
    "SELECT id, name FROM options WHERE collection = ?",
  ).bind(collection).all();
  const existing = (results as { id: string; name: string }[])
    .find((r) => r.name.toLowerCase() === key);
  if (existing) return c.json({ id: existing.id, name: existing.name }, 200);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO options (id, collection, name, created_at) VALUES (?, ?, ?, ?)",
  ).bind(id, collection, name, new Date().toISOString()).run();
  return c.json({ id, name }, 201);
});

options.patch("/:collection/:id", async (c) => {
  const collection = c.req.param("collection");
  const id = c.req.param("id");
  const newName = (((await c.req.json().catch(() => ({}))).name ?? "") as string).trim();
  if (!newName) return c.json({ message: "Name required" }, 400);
  const row = await c.env.DB.prepare(
    "SELECT id, name FROM options WHERE id = ? AND collection = ?",
  ).bind(id, collection).first<{ id: string; name: string }>();
  if (!row) return c.json({ message: "Not found" }, 404);

  const map = COLUMN_MAP[collection];
  const { results } = await c.env.DB.prepare(
    "SELECT id, name FROM options WHERE collection = ?",
  ).bind(collection).all();
  const target = (results as { id: string; name: string }[])
    .find((r) => r.name.toLowerCase() === newName.toLowerCase() && r.id !== id);

  const stmts: D1PreparedStatement[] = [];
  if (target) {
    // Merge: historical text moves to the surviving option's exact name.
    if (map) stmts.push(c.env.DB.prepare(`UPDATE ${map.table} SET ${map.column} = ? WHERE ${map.column} = ?`).bind(target.name, row.name));
    stmts.push(c.env.DB.prepare("DELETE FROM options WHERE id = ?").bind(id));
    await c.env.DB.batch(stmts);
    return c.json({ id: target.id, name: target.name });
  }
  if (map) stmts.push(c.env.DB.prepare(`UPDATE ${map.table} SET ${map.column} = ? WHERE ${map.column} = ?`).bind(newName, row.name));
  stmts.push(c.env.DB.prepare("UPDATE options SET name = ? WHERE id = ?").bind(newName, id));
  await c.env.DB.batch(stmts);
  return c.json({ id, name: newName });
});

options.delete("/:collection/:id", async (c) => {
  const collection = c.req.param("collection");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT id FROM options WHERE id = ? AND collection = ?",
  ).bind(id, collection).first();
  if (!row) return c.json({ message: "Not found" }, 404);
  await c.env.DB.prepare("DELETE FROM options WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

export default options;
