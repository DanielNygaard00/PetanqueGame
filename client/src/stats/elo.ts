// client/src/stats/elo.ts
import type { Match } from "../api/types";

export type PlayerRating = {
  name: string; elo: number; games: number; wins: number; losses: number;
  winRate: number; avgMargin: number; form: ("W" | "L")[]; provisional: boolean;
};

export function computeElo(
  matches: Match[],
  opts: { base?: number; k?: number; provisionalGames?: number } = {},
): PlayerRating[] {
  const base = opts.base ?? 1000, k = opts.k ?? 24, provisionalGames = opts.provisionalGames ?? 5;

  const eligible = matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !m.Gruppe_Bool && !!m.Spiller && !!m.Modstander && typeof m.Vundet === "boolean")
    .sort((a, b) => {
      const ka = `${a.m.Dato ?? ""}${a.m.Tid ?? ""}`, kb = `${b.m.Dato ?? ""}${b.m.Tid ?? ""}`;
      return ka === kb ? a.i - b.i : ka < kb ? -1 : 1;
    });

  const S = new Map<string, PlayerRating>();
  const marginSum = new Map<string, number>(), marginN = new Map<string, number>();
  const get = (name: string) => {
    let p = S.get(name);
    if (!p) { p = { name, elo: base, games: 0, wins: 0, losses: 0, winRate: 0, avgMargin: 0, form: [], provisional: true }; S.set(name, p); }
    return p;
  };

  for (const { m } of eligible) {
    const A = get(m.Spiller as string), B = get(m.Modstander as string);
    const scoreA = m.Vundet ? 1 : 0;
    const expA = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
    A.elo += k * (scoreA - expA);
    B.elo += k * ((1 - scoreA) - (1 - expA));
    A.games++; B.games++;
    if (m.Vundet) { A.wins++; B.losses++; } else { A.losses++; B.wins++; }
    A.form.push(m.Vundet ? "W" : "L"); B.form.push(m.Vundet ? "L" : "W");
    if (typeof m.Point === "number" && typeof m.Modstander_Point === "number") {
      const d = m.Point - m.Modstander_Point;
      marginSum.set(A.name, (marginSum.get(A.name) ?? 0) + d); marginN.set(A.name, (marginN.get(A.name) ?? 0) + 1);
      marginSum.set(B.name, (marginSum.get(B.name) ?? 0) - d); marginN.set(B.name, (marginN.get(B.name) ?? 0) + 1);
    }
  }

  return [...S.values()].map((p) => ({
    ...p,
    elo: Math.round(p.elo),
    winRate: p.games ? (p.wins / p.games) * 100 : 0,
    avgMargin: (marginN.get(p.name) ?? 0) ? (marginSum.get(p.name) as number) / (marginN.get(p.name) as number) : 0,
    form: p.form.slice(-5),
    provisional: p.games < provisionalGames,
  })).sort((a, b) => b.elo - a.elo);
}
