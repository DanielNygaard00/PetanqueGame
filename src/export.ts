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
