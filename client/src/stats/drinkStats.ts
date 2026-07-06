import type { Match } from "../api/types";

export type PlayerDrinkStat = {
  name: string; units: number; litres: number; games: number; wins: number; unitsPerGame: number;
};

export function playerDrinkStats(matches: Match[]): PlayerDrinkStat[] {
  const agg = new Map<string, { units: number; litres: number; games: number; wins: number }>();
  const get = (name: string) => {
    let a = agg.get(name);
    if (!a) { a = { units: 0, litres: 0, games: 0, wins: 0 }; agg.set(name, a); }
    return a;
  };

  for (const m of matches) {
    for (const d of m.drinks ?? []) {
      if (!d.player) continue;
      const a = get(d.player);
      const count = d.count ?? 1;
      a.units += count;
      if (typeof d.volumeCl === "number") a.litres += (count * d.volumeCl) / 100;
    }
    const scores = (m.teams ?? []).map((t) => t.score).filter((s): s is number => typeof s === "number");
    const max = scores.length ? Math.max(...scores) : null;
    for (const t of m.teams ?? []) {
      const won = max !== null && t.score === max;
      for (const p of t.players) { const a = get(p.name); a.games++; if (won) a.wins++; }
    }
  }

  return [...agg.entries()]
    .map(([name, a]) => ({ name, ...a, unitsPerGame: a.games ? a.units / a.games : 0 }))
    .sort((x, y) => y.units - x.units);
}
