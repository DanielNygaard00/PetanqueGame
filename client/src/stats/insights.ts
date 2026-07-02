// client/src/stats/insights.ts
import type { Match } from "../api/types";
import { deriveStats } from "./derive";

export type Insight = { text: string; tone?: "good" | "bad" | "neutral" };
const MIN = 3;
const TIME_LABEL: Record<string, string> = { morning: "om morgenen", afternoon: "om eftermiddagen", evening: "om aftenen", night: "om natten", unknown: "" };

export function deriveInsights(matches: Match[]): Insight[] {
  const s = deriveStats(matches);
  const out: Insight[] = [];
  if (s.total < MIN) return out;

  out.push({ text: `Du har vundet ${s.winRate.toFixed(0)}% af ${s.total} kampe`, tone: s.winRate >= 50 ? "good" : "neutral" });

  const tod = s.byTimeOfDay.filter((t) => t.games >= MIN && t.key !== "unknown").sort((a, b) => b.winRate - a.winRate);
  if (tod.length) out.push({ text: `Bedst ${TIME_LABEL[tod[0].key] ?? tod[0].key}: ${tod[0].winRate.toFixed(0)}% sejre`, tone: "good" });

  const b0 = s.byUnitsBucket.find((b) => b.bucket === "0");
  const tipsy = s.byUnitsBucket.filter((b) => b.bucket === "3–4" || b.bucket === "5+");
  const tipsyGames = tipsy.reduce((n, b) => n + b.games, 0);
  const tipsyWins = tipsy.reduce((n, b) => n + (b.winRate * b.games) / 100, 0);
  if (b0 && b0.games >= MIN && tipsyGames >= MIN) {
    const tr = (tipsyWins / tipsyGames) * 100;
    out.push({ text: `Ædru: ${b0.winRate.toFixed(0)}% sejre — efter 3+ genstande: ${tr.toFixed(0)}%`, tone: b0.winRate > tr ? "bad" : "neutral" });
  }

  const arenas = s.byArena.filter((a) => a.games >= MIN).sort((a, b) => b.avgMargin - a.avgMargin);
  if (arenas.length) out.push({ text: `Bedste bane: ${arenas[0].key} (${arenas[0].avgMargin >= 0 ? "+" : ""}${arenas[0].avgMargin.toFixed(1)} margin)`, tone: "good" });

  const opps = s.byOpponent.filter((o) => o.games >= MIN).sort((a, b) => a.winRate - b.winRate);
  if (opps.length) out.push({ text: `Sværeste modstander: ${opps[0].key} (${opps[0].winRate.toFixed(0)}% sejre)`, tone: "bad" });

  if (s.topDrinksByUnits.length) out.push({ text: `Mest loggede drik: ${s.topDrinksByUnits[0].name} (${s.topDrinksByUnits[0].units} stk.)`, tone: "neutral" });

  if (s.longestStreak >= MIN) out.push({ text: `Længste sejrsstime: ${s.longestStreak} i træk`, tone: "good" });

  return out;
}
