// client/src/stats/awards.ts
import type { Match } from "../api/types";
import { matchPerspective } from "./perspective";
import { computeEloWithHistory } from "./elo";

export type AwardPeriod = "month" | "year" | "all";
export type Award = { key: string; emoji: string; title: string; winner: string; detail: string };

const MIN = 3;
const UPSET_FLOOR = 13; // strictly above K/2 = 12: only genuine underdog wins

export function filterByPeriod(matches: Match[], period: AwardPeriod, now: Date): Match[] {
  if (period === "all") return matches;
  const y = String(now.getFullYear());
  const prefix = period === "year" ? y : `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return matches.filter((m) => m.Dato?.startsWith(prefix));
}

type Tally = { games: number; wins: number; units: number; tipsyGames: number; tipsyWins: number };

const players = (m: Match) => (m.teams ?? []).flatMap((t) => t.players.map((p) => p.name));

export function computeAwards(periodMatches: Match[], allMatches: Match[]): Award[] {
  const out: Award[] = [];
  if (periodMatches.length === 0) return out;

  const names = [...new Set(periodMatches.flatMap(players))];
  const { deltas } = computeEloWithHistory(allMatches);

  // Chronological (oldest first) for streaks; input is newest first.
  const chrono = [...periodMatches].reverse();

  const tally = new Map<string, Tally>();
  const get = (n: string) => {
    let t = tally.get(n);
    if (!t) { t = { games: 0, wins: 0, units: 0, tipsyGames: 0, tipsyWins: 0 }; tally.set(n, t); }
    return t;
  };
  const winStreak = new Map<string, { cur: number; best: number }>();
  const lossStreak = new Map<string, { cur: number; best: number }>();
  const bump = (map: Map<string, { cur: number; best: number }>, n: string, hit: boolean) => {
    const s = map.get(n) ?? { cur: 0, best: 0 };
    s.cur = hit ? s.cur + 1 : 0;
    s.best = Math.max(s.best, s.cur);
    map.set(n, s);
  };

  const improvedSum = new Map<string, number>();
  let upsetBest: { name: string; delta: number } | null = null;

  for (const m of chrono) {
    const matchDeltas = deltas.get(m.id);
    for (const n of new Set(players(m))) {
      const p = matchPerspective(m, n);
      if (!p || p.won === null) continue;
      const t = get(n);
      t.games++;
      if (p.won) t.wins++;
      const units = (m.drinks ?? []).filter((d) => d.player === n).reduce((s, d) => s + (d.count ?? 1), 0);
      t.units += units;
      if (units >= 3) { t.tipsyGames++; if (p.won) t.tipsyWins++; }
      bump(winStreak, n, p.won);
      bump(lossStreak, n, !p.won);
      const d = matchDeltas?.get(n);
      if (typeof d === "number") {
        improvedSum.set(n, (improvedSum.get(n) ?? 0) + d);
        if (d >= UPSET_FLOOR && (!upsetBest || d > upsetBest.delta)) upsetBest = { name: n, delta: d };
      }
    }
  }

  const rate = (t: Tally) => (t.games ? (t.wins / t.games) * 100 : 0);
  const qualified = names.map((n) => ({ n, t: get(n) })).filter((x) => x.t.games >= MIN);
  const byRate = (dir: 1 | -1) => [...qualified].sort((a, b) =>
    dir * (rate(b.t) - rate(a.t)) || b.t.games - a.t.games || a.n.localeCompare(b.n));

  const best = byRate(1)[0];
  if (best) out.push({ key: "player", emoji: "🏅", title: "Periodens spiller", winner: best.n, detail: `${rate(best.t).toFixed(0)}% sejre i ${best.t.games} kampe` });

  const improved = [...improvedSum.entries()].filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (improved) out.push({ key: "improved", emoji: "📈", title: "Mest forbedret", winner: improved[0], detail: `+${Math.round(improved[1])} Elo` });

  if (upsetBest) out.push({ key: "upset", emoji: "💥", title: "Største upset", winner: upsetBest.name, detail: `+${Math.round(upsetBest.delta)} Elo i én kamp` });

  const streaks = [...winStreak.entries()].filter(([, s]) => s.best >= MIN).sort((a, b) => b[1].best - a[1].best || a[0].localeCompare(b[0]))[0];
  if (streaks) out.push({ key: "streak", emoji: "🔥", title: "Sejrsstime", winner: streaks[0], detail: `${streaks[1].best} sejre i træk` });

  const thirst = names.map((n) => ({ n, t: get(n) })).filter((x) => x.t.units >= 1).sort((a, b) => b.t.units - a.t.units || a.n.localeCompare(b.n))[0];
  if (thirst) out.push({ key: "thirst", emoji: "🍺", title: "Tørstigst", winner: thirst.n, detail: `${thirst.t.units} genstande` });

  const tipsy = names.map((n) => ({ n, t: get(n) })).filter((x) => x.t.tipsyGames >= MIN)
    .sort((a, b) => (b.t.tipsyWins / b.t.tipsyGames) - (a.t.tipsyWins / a.t.tipsyGames) || b.t.tipsyGames - a.t.tipsyGames || a.n.localeCompare(b.n))[0];
  if (tipsy) out.push({ key: "tipsy", emoji: "🥴", title: "Bedst på promille", winner: tipsy.n, detail: `${((tipsy.t.tipsyWins / tipsy.t.tipsyGames) * 100).toFixed(0)}% sejre med 3+ genstande` });

  const arenaCounts = new Map<string, number>();
  for (const m of periodMatches) if (m.Arena) arenaCounts.set(m.Arena, (arenaCounts.get(m.Arena) ?? 0) + 1);
  const topArena = [...arenaCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (topArena) {
    const arenaTally = new Map<string, { games: number; wins: number }>();
    for (const m of periodMatches) {
      if (m.Arena !== topArena) continue;
      for (const n of new Set(players(m))) {
        const p = matchPerspective(m, n);
        if (!p || p.won === null) continue;
        const t = arenaTally.get(n) ?? { games: 0, wins: 0 };
        t.games++; if (p.won) t.wins++;
        arenaTally.set(n, t);
      }
    }
    const king = [...arenaTally.entries()].filter(([, t]) => t.games >= MIN)
      .sort((a, b) => (b[1].wins / b[1].games) - (a[1].wins / a[1].games) || b[1].games - a[1].games || a[0].localeCompare(b[0]))[0];
    if (king) out.push({ key: "arena", emoji: "🏟️", title: "Banekonge", winner: king[0], detail: `${((king[1].wins / king[1].games) * 100).toFixed(0)}% sejre på ${topArena}` });
  }

  const worst = byRate(-1)[0];
  if (worst) out.push({ key: "wooden", emoji: "🥄", title: "Træskallen", winner: worst.n, detail: `${rate(worst.t).toFixed(0)}% sejre i ${worst.t.games} kampe` });

  const cold = [...lossStreak.entries()].filter(([, s]) => s.best >= MIN).sort((a, b) => b[1].best - a[1].best || a[0].localeCompare(b[0]))[0];
  if (cold) out.push({ key: "cold", emoji: "🧊", title: "Kold tørn", winner: cold[0], detail: `${cold[1].best} nederlag i træk` });

  return out;
}
