// client/src/stats/derive.ts
import type { Match } from "../api/types";

function topBy(matches: Match[], key: keyof Match) {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const v = m[key];
    if (typeof v === "string" && v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
}

export function deriveStats(matches: Match[]) {
  const byDate = [...matches].sort((a, b) => (a.Dato ?? "").localeCompare(b.Dato ?? ""));
  const total = matches.length;
  const wins = matches.filter((m) => m.Vundet).length;
  const totalPoints = matches.reduce((s, m) => s + (m.Point ?? 0), 0);

  let streak = 0, longestStreak = 0;
  for (const m of byDate) {
    if (m.Vundet) { streak++; longestStreak = Math.max(longestStreak, streak); }
    else streak = 0;
  }

  return {
    total,
    wins,
    winRate: total ? (wins / total) * 100 : 0,
    totalPoints,
    longestStreak,
    topArenas: topBy(matches, "Arena"),
    topDrinks: topBy(matches, "Drik_Navn"),
    pointsOverTime: byDate.map((m) => ({ date: m.Dato ?? "", points: m.Point ?? 0 })),
  };
}
