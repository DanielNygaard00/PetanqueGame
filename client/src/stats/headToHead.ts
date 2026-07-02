import type { Match } from "../api/types";
export type H2HRow = { opponent: string; games: number; wins: number; losses: number; winRate: number; avgMargin: number };
export function headToHead(matches: Match[], player: string): H2HRow[] {
  const agg = new Map<string, { games: number; wins: number; marginSum: number; marginN: number }>();
  const bothScores = (m: Match) => typeof m.Point === "number" && typeof m.Modstander_Point === "number";
  for (const m of matches) {
    if (m.Gruppe_Bool || typeof m.Vundet !== "boolean" || !m.Spiller || !m.Modstander) continue;
    let opp: string, won: boolean, margin: number | null;
    if (m.Spiller === player) { opp = m.Modstander; won = m.Vundet; margin = bothScores(m) ? (m.Point! - m.Modstander_Point!) : null; }
    else if (m.Modstander === player) { opp = m.Spiller; won = !m.Vundet; margin = bothScores(m) ? (m.Modstander_Point! - m.Point!) : null; }
    else continue;
    const g = agg.get(opp) ?? { games: 0, wins: 0, marginSum: 0, marginN: 0 };
    g.games++; if (won) g.wins++;
    if (margin !== null) { g.marginSum += margin; g.marginN++; }
    agg.set(opp, g);
  }
  return [...agg.entries()].map(([opponent, g]) => ({
    opponent, games: g.games, wins: g.wins, losses: g.games - g.wins,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}
