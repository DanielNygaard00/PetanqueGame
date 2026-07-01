// src/mapping.ts
const KEY_TO_COL: Record<string, string> = {
  Dato: "date",
  Tid: "time",
  Gruppe_Bool: "is_group",
  Gruppe_medlemmer: "group_members",
  "Konsekutive spil": "consecutive_games",
  Spiller: "player",
  Arena: "arena",
  Modstander: "opponent",
  Vundet: "won",
  Point: "points",
  Modstander_Point: "opponent_points",
  "Spillets genstande": "game_items",
};
const COL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_COL).map(([k, v]) => [v, k]),
);
const BOOL_COLS = new Set(["is_group", "won"]);

export const MATCH_COLUMNS = Object.keys(KEY_TO_COL);

export function toRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(KEY_TO_COL)) {
    if (!(key in body)) continue;
    const val = body[key];
    row[col] = BOOL_COLS.has(col) ? (val ? 1 : 0) : val;
  }
  return row;
}

export function toApi(row: Record<string, unknown>): Record<string, unknown> {
  const api: Record<string, unknown> = { id: row.id };
  for (const [col, key] of Object.entries(COL_TO_KEY)) {
    if (!(col in row)) continue;
    api[key] = BOOL_COLS.has(col) ? Boolean(row[col]) : row[col];
  }
  return api;
}
