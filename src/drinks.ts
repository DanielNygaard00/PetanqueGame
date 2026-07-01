// src/drinks.ts
export type ApiDrink = {
  type?: string | null;
  category?: string | null;
  brand?: string | null;
  name?: string | null;
  country?: string | null;
  wineRegion?: string | null;
  count?: number;
  volumeCl?: number | null;
};

export function drinkToRow(d: ApiDrink, matchId: string, position: number) {
  return {
    id: crypto.randomUUID(),
    match_id: matchId,
    drink_type: d.type ?? null,
    drink_category: d.category ?? null,
    drink_brand: d.brand ?? null,
    drink_name: d.name ?? null,
    drink_country: d.country ?? null,
    wine_region: d.wineRegion ?? null,
    count: typeof d.count === "number" && d.count > 0 ? d.count : 1,
    volume_cl: typeof d.volumeCl === "number" ? d.volumeCl : null,
    position,
  };
}

export function drinkToApi(row: Record<string, unknown>): ApiDrink {
  return {
    type: (row.drink_type as string) ?? null,
    category: (row.drink_category as string) ?? null,
    brand: (row.drink_brand as string) ?? null,
    name: (row.drink_name as string) ?? null,
    country: (row.drink_country as string) ?? null,
    wineRegion: (row.wine_region as string) ?? null,
    count: (row.count as number) ?? 1,
    volumeCl: (row.volume_cl as number) ?? null,
  };
}
