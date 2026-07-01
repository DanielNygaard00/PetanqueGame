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

export const matchUnits = (m: Match) => (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
export const matchMargin = (m: Match) =>
  typeof m.Point === "number" && typeof m.Modstander_Point === "number" ? m.Point - m.Modstander_Point : null;

export function timeBucket(tid?: string): "morning" | "afternoon" | "evening" | "night" | "unknown" {
  if (!tid) return "unknown";
  const h = Number(tid.slice(0, 2));
  if (h >= 5 && h <= 11) return "morning";
  if (h >= 12 && h <= 16) return "afternoon";
  if (h >= 17 && h <= 21) return "evening";
  return "night";
}
const WEEKDAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
export const weekday = (dato?: string) => (dato ? WEEKDAYS[new Date(dato + "T00:00:00").getDay()] : "?");

function group(matches: Match[], keyOf: (m: Match) => string) {
  const map = new Map<string, { wins: number; games: number; marginSum: number; marginN: number }>();
  for (const m of matches) {
    const k = keyOf(m);
    if (!k) continue;
    const g = map.get(k) ?? { wins: 0, games: 0, marginSum: 0, marginN: 0 };
    g.games++; if (m.Vundet) g.wins++;
    const mg = matchMargin(m); if (mg !== null) { g.marginSum += mg; g.marginN++; }
    map.set(k, g);
  }
  return [...map.entries()].map(([key, g]) => ({
    key, games: g.games,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}

function unitsBucketLabel(u: number) {
  if (u === 0) return "0";
  if (u <= 2) return "1–2";
  if (u <= 4) return "3–4";
  return "5+";
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

  // v2 analytics
  const totalDrinks = matches.reduce((s, m) => s + matchUnits(m), 0);

  const bucketOrder = ["0", "1–2", "3–4", "5+"];
  const byUnitsBucket = bucketOrder.map((bucket) => {
    const inB = matches.filter((m) => unitsBucketLabel(matchUnits(m)) === bucket);
    const w = inB.filter((m) => m.Vundet).length;
    const margins = inB.map(matchMargin).filter((x): x is number => x !== null);
    return {
      bucket, games: inB.length,
      winRate: inB.length ? (w / inB.length) * 100 : 0,
      avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
    };
  });

  const consMap = new Map<string, number>();
  for (const m of matches) {
    const month = (m.Dato ?? "").slice(0, 7);
    if (month) consMap.set(month, (consMap.get(month) ?? 0) + matchUnits(m));
  }
  const consumptionByMonth = [...consMap.entries()]
    .map(([month, units]) => ({ month, units }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const drinkUnits = new Map<string, number>();
  for (const m of matches) for (const d of m.drinks ?? []) {
    const name = d.name || d.brand || d.category || d.type;
    if (name) drinkUnits.set(name, (drinkUnits.get(name) ?? 0) + (d.count ?? 0));
  }
  const topDrinksByUnits = [...drinkUnits.entries()]
    .map(([name, units]) => ({ name, units }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  return {
    // v1 fields (preserved for dashboard)
    total,
    wins,
    winRate: total ? (wins / total) * 100 : 0,
    totalPoints,
    longestStreak,
    topArenas: topBy(matches, "Arena"),
    topDrinks: topBy(matches, "Drik_Navn"),
    pointsOverTime: byDate.map((m) => ({ date: m.Dato ?? "", points: m.Point ?? 0 })),
    // v2 fields
    totalDrinks,
    byUnitsBucket,
    byTimeOfDay: group(matches, (m) => timeBucket(m.Tid)),
    byWeekday: group(matches, (m) => weekday(m.Dato)),
    byArena: group(matches, (m) => m.Arena ?? ""),
    byOpponent: group(matches, (m) => m.Modstander ?? ""),
    consumptionByMonth,
    topDrinksByUnits,
  };
}
