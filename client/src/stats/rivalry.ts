// client/src/stats/rivalry.ts
import type { Match } from "../api/types";
import { matchPerspective } from "./perspective";

export type Rivalry = {
  a: string;
  b: string;
  games: number;
  aWins: number;
  bWins: number;
  avgMarginA: number;
  streak: { player: string; count: number } | null;
  meetings: Match[];
  series: { game: number; diff: number }[];
};

export const rivalryPath = (a: string, b: string) =>
  `/rivalry/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;

export function computeRivalry(matches: Match[], a: string, b: string): Rivalry {
  const meetings: Match[] = [];
  const results: boolean[] = []; // aligned with meetings (newest first); true = a won
  let marginSum = 0, marginN = 0;
  for (const m of matches) {
    const p = matchPerspective(m, a);
    if (!p || p.won === null || !p.opponents.includes(b)) continue;
    meetings.push(m);
    results.push(p.won);
    if (p.myScore !== null && p.oppScore !== null) { marginSum += p.myScore - p.oppScore; marginN++; }
  }
  const aWins = results.filter(Boolean).length;
  const bWins = results.length - aWins;

  let streak: Rivalry["streak"] = null;
  if (results.length) {
    const latest = results[0];
    let count = 1;
    while (count < results.length && results[count] === latest) count++;
    streak = { player: latest ? a : b, count };
  }

  const series: { game: number; diff: number }[] = [];
  let diff = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    diff += results[i] ? 1 : -1;
    series.push({ game: series.length + 1, diff });
  }

  return {
    a, b, games: results.length, aWins, bWins,
    avgMarginA: marginN ? marginSum / marginN : 0,
    streak, meetings, series,
  };
}
