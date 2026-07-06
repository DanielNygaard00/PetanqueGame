// client/src/stats/derive.ts
import type { Match } from "../api/types";
import { matchPerspective, matchUnits } from "./perspective";

export { matchUnits };

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

type View = { m: Match; won: boolean | null; margin: number | null; opponents: string[]; units: number };

function viewsFor(matches: Match[], viewer: string): View[] {
  const out: View[] = [];
  for (const m of matches) {
    const p = matchPerspective(m, viewer);
    if (!p) continue;
    out.push({
      m, won: p.won,
      margin: p.myScore !== null && p.oppScore !== null ? p.myScore - p.oppScore : null,
      opponents: p.opponents, units: matchUnits(m),
    });
  }
  return out;
}

function group(views: View[], keyOf: (v: View) => string | string[]) {
  const map = new Map<string, { wins: number; games: number; marginSum: number; marginN: number }>();
  for (const v of views) {
    const keys = keyOf(v);
    const keyArr = Array.isArray(keys) ? keys : [keys];
    for (const k of keyArr) {
      if (!k) continue;
      const g = map.get(k) ?? { wins: 0, games: 0, marginSum: 0, marginN: 0 };
      g.games++; if (v.won) g.wins++;
      if (v.margin !== null) { g.marginSum += v.margin; g.marginN++; }
      map.set(k, g);
    }
  }
  return [...map.entries()].map(([key, g]) => ({
    key, games: g.games,
    winRate: g.games ? (g.wins / g.games) * 100 : 0,
    avgMargin: g.marginN ? g.marginSum / g.marginN : 0,
  })).sort((a, b) => b.games - a.games);
}

function topArenas(views: View[]) {
  const counts = new Map<string, number>();
  for (const v of views) { const a = v.m.Arena; if (a) counts.set(a, (counts.get(a) ?? 0) + 1); }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

function unitsBucketLabel(u: number) {
  if (u === 0) return "0";
  if (u <= 2) return "1–2";
  if (u <= 4) return "3–4";
  return "5+";
}

export function deriveStats(matches: Match[], viewer: string) {
  const views = viewsFor(matches, viewer);
  const byDate = [...views].sort((a, b) => (a.m.Dato ?? "").localeCompare(b.m.Dato ?? ""));
  const total = views.length;
  const wins = views.filter((v) => v.won).length;
  const totalPoints = views.reduce((s, v) => s + (matchPerspective(v.m, viewer)?.myScore ?? 0), 0);

  let streak = 0, longestStreak = 0;
  for (const v of byDate) { if (v.won) { streak++; longestStreak = Math.max(longestStreak, streak); } else streak = 0; }

  const totalDrinks = views.reduce((s, v) => s + v.units, 0);

  const bucketOrder = ["0", "1–2", "3–4", "5+"];
  const byUnitsBucket = bucketOrder.map((bucket) => {
    const inB = views.filter((v) => unitsBucketLabel(v.units) === bucket);
    const w = inB.filter((v) => v.won).length;
    const margins = inB.map((v) => v.margin).filter((x): x is number => x !== null);
    return {
      bucket, games: inB.length,
      winRate: inB.length ? (w / inB.length) * 100 : 0,
      avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
    };
  });

  const consMap = new Map<string, number>();
  for (const v of views) { const month = (v.m.Dato ?? "").slice(0, 7); if (month) consMap.set(month, (consMap.get(month) ?? 0) + v.units); }
  const consumptionByMonth = [...consMap.entries()].map(([month, units]) => ({ month, units })).sort((a, b) => a.month.localeCompare(b.month));

  const drinkUnits = new Map<string, number>();
  for (const v of views) for (const d of v.m.drinks ?? []) {
    const name = d.name || d.brand || d.category || d.type;
    if (name) drinkUnits.set(name, (drinkUnits.get(name) ?? 0) + (d.count ?? 0));
  }
  const topDrinksByUnits = [...drinkUnits.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units).slice(0, 5);

  return {
    total, wins,
    winRate: total ? (wins / total) * 100 : 0,
    totalPoints, longestStreak,
    topArenas: topArenas(views),
    topDrinks: topDrinksByUnits.map((d) => ({ name: d.name, count: d.units })),
    pointsOverTime: byDate.map((v) => ({ date: v.m.Dato ?? "", points: matchPerspective(v.m, viewer)?.myScore ?? 0 })),
    totalDrinks,
    byUnitsBucket,
    byTimeOfDay: group(views, (v) => timeBucket(v.m.Tid)),
    byWeekday: group(views, (v) => weekday(v.m.Dato)),
    byArena: group(views, (v) => v.m.Arena ?? ""),
    byOpponent: group(views, (v) => v.opponents),
    consumptionByMonth,
    topDrinksByUnits,
  };
}
