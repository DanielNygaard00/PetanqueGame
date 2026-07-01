// src/mapping.ts
// Danish API key -> DB column. Booleans stored as 0/1.
const KEY_TO_COL: Record<string, string> = {
  Dato: "date",
  Gruppe_Bool: "is_group",
  Gruppe_medlemmer: "group_members",
  "Konsekutive spil": "consecutive_games",
  Spiller: "player",
  Arena: "arena",
  Modstander: "opponent",
  Vundet: "won",
  Point: "points",
  Drik_Type: "drink_type",
  Drik_Kategori: "drink_category",
  Drik_Brand: "drink_brand",
  Drik_Land: "drink_country",
  Drik_Navn: "drink_name",
  Vin_Region: "wine_region",
  "Spillets genstande": "game_items",
};
const COL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_COL).map(([k, v]) => [v, k]),
);
const BOOL_COLS = new Set(["is_group", "won"]);

export const MATCH_COLUMNS = Object.keys(KEY_TO_COL); // 16 keys in insertion order

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
