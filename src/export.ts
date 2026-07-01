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
