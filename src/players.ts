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
    const row = await c.env.DB.prepare("SELECT COUNT(DISTINCT match_id) AS n FROM match_players WHERE player_id = ?").bind(p.id).first<{ n: number }>();
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
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE players SET name = ? WHERE id = ?").bind(newName, id),
  ]);
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

export default players;
