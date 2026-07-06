// client/src/stats/headToHead.ts
import type { Match } from "../api/types";
import { matchPerspective } from "./perspective";

export type H2HRow = { opponent: string; games: number; wins: number; losses: number; winRate: number; avgMargin: number };

export function headToHead(matches: Match[], player: string): H2HRow[] {
  const agg = new Map<string, { games: number; wins: number; marginSum: number; marginN: number }>();
  for (const m of matches) {
    const p = matchPerspective(m, player);
    if (!p || p.won === null) continue;
    const margin = p.myScore !== null && p.oppScore !== null ? p.myScore - p.oppScore : null;
    for (const opp of p.opponents) {
      const g = agg.get(opp) ?? { games: 0, wins: 0, marginSum: 0, marginN: 0 };
      g.games++; if (p.won) g.wins++;
      if (margin !== null) { g.marginSum += margin; g.marginN++; }
      agg.set(opp, g);
    }
  }
  return [...agg.entries()].map(([opponent, g]) => ({
    opponent, games: g.games, wins: g.wins, losses: g.games - g.wins,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}
