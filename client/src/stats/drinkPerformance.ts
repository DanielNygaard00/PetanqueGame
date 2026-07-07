// client/src/stats/drinkPerformance.ts
import type { Match } from "../api/types";
import { matchPerspective } from "./perspective";

export type TypePerf = { type: string; games: number; wins: number; winRate: number };

export function winRateByDrinkType(matches: Match[], player: string): TypePerf[] {
  const agg = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    const p = matchPerspective(m, player);
    if (!p || p.won === null) continue;
    const own = (m.drinks ?? []).filter((d) => d.player === player);
    const types = own.length ? [...new Set(own.map((d) => d.type ?? "Andet"))] : ["Ingen"];
    for (const t of types) {
      const a = agg.get(t) ?? { games: 0, wins: 0 };
      a.games++; if (p.won) a.wins++;
      agg.set(t, a);
    }
  }
  return [...agg.entries()]
    .map(([type, a]) => ({ type, ...a, winRate: a.games ? (a.wins / a.games) * 100 : 0 }))
    .sort((x, y) => y.games - x.games);
}
