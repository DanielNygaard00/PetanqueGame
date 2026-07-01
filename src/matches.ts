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
