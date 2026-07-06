// src/mapping.ts
const KEY_TO_COL: Record<string, string> = {
  Dato: "date",
  Tid: "time",
  Arena: "arena",
  "Konsekutive spil": "consecutive_games",
  "Spillets genstande": "game_items",
};
const COL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_COL).map(([k, v]) => [v, k]),
);

export const MATCH_COLUMNS = Object.keys(KEY_TO_COL);

export function toRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(KEY_TO_COL)) {
    if (!(key in body)) continue;
    row[col] = body[key];
  }
  return row;
}

export function toApi(row: Record<string, unknown>): Record<string, unknown> {
  const api: Record<string, unknown> = { id: row.id };
  for (const [col, key] of Object.entries(COL_TO_KEY)) {
    if (!(col in row) || row[col] === null || row[col] === undefined) continue;
    api[key] = row[col];
  }
  return api;
}
