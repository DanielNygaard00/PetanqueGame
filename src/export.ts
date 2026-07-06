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
