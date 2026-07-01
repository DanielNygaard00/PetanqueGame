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
