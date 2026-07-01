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

export default options;
