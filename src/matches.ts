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
  // N+1 by design: this friend-group app has few matches; batch-join if the list ever grows large.
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
  const existing = await c.env.DB.prepare("SELECT id FROM matches WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ message: "Not found" }, 404);
  const row = toRow(body);
  if (Object.keys(row).length) {
    row.updated_at = new Date().toISOString();
    const assignments = Object.keys(row).map((k) => `${k} = ?`).join(", ");
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
