// client/src/stats/elo.ts
import type { Match } from "../api/types";

export type PlayerRating = {
  name: string; elo: number; games: number; wins: number; losses: number;
  winRate: number; avgMargin: number; form: ("W" | "L" | "D")[]; provisional: boolean;
};

export type EloHistory = {
  ratings: PlayerRating[];
  /** matchId -> playerName -> rounded Elo change from that match */
  deltas: Map<string, Map<string, number>>;
};

export function computeEloWithHistory(
  matches: Match[],
  opts: { base?: number; k?: number; provisionalGames?: number } = {},
): EloHistory {
  const base = opts.base ?? 1000, k = opts.k ?? 24, provisionalGames = opts.provisionalGames ?? 5;
  const deltas = new Map<string, Map<string, number>>();

  const eligible = matches
    .filter((m) => (m.teams?.length ?? 0) >= 2)
    .map((m, i) => ({ m, i }))
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
    const teams = (m.teams ?? []).filter((t) => typeof t.score === "number" && t.players.length > 0);
    if (teams.length < 2) continue;

    // Snapshot ratings so all pairwise expectations in this match use pre-match values.
    const snap = new Map<string, number>();
    for (const t of teams) for (const pl of t.players) snap.set(pl.name, get(pl.name).elo);
    const teamAvg = (t: typeof teams[number]) => t.players.reduce((s, pl) => s + snap.get(pl.name)!, 0) / t.players.length;

    const delta = new Map<string, number>();
    const addDelta = (name: string, d: number) => delta.set(name, (delta.get(name) ?? 0) + d);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const ti = teams[i], tj = teams[j];
        const si = ti.score as number, sj = tj.score as number;
        const ri = teamAvg(ti), rj = teamAvg(tj);
        const scoreI = si > sj ? 1 : si < sj ? 0 : 0.5;
        const expI = 1 / (1 + Math.pow(10, (rj - ri) / 400));
        const di = k * (scoreI - expI);
        for (const pl of ti.players) {
          addDelta(pl.name, di);
          const p = get(pl.name); p.games++;
          if (scoreI === 1) p.wins++; else if (scoreI === 0) p.losses++;
          p.form.push(scoreI === 1 ? "W" : scoreI === 0 ? "L" : "D");
          marginSum.set(pl.name, (marginSum.get(pl.name) ?? 0) + (si - sj)); marginN.set(pl.name, (marginN.get(pl.name) ?? 0) + 1);
        }
        for (const pl of tj.players) {
          addDelta(pl.name, -di);
          const p = get(pl.name); p.games++;
          if (scoreI === 0) p.wins++; else if (scoreI === 1) p.losses++;
          p.form.push(scoreI === 0 ? "W" : scoreI === 1 ? "L" : "D");
          marginSum.set(pl.name, (marginSum.get(pl.name) ?? 0) + (sj - si)); marginN.set(pl.name, (marginN.get(pl.name) ?? 0) + 1);
        }
      }
    }
    const matchDeltas = new Map<string, number>();
    for (const [name, d] of delta) {
      get(name).elo += d;
      matchDeltas.set(name, Math.round(d));
    }
    if (matchDeltas.size > 0) deltas.set(m.id, matchDeltas);
  }

  const ratings = [...S.values()].map((p) => ({
    ...p,
    elo: Math.round(p.elo),
    winRate: p.games ? (p.wins / p.games) * 100 : 0,
    avgMargin: (marginN.get(p.name) ?? 0) ? (marginSum.get(p.name) as number) / (marginN.get(p.name) as number) : 0,
    form: p.form.slice(-5),
    provisional: p.games < provisionalGames,
  })).sort((a, b) => b.elo - a.elo);

  return { ratings, deltas };
}

export function computeElo(
  matches: Match[],
  opts: { base?: number; k?: number; provisionalGames?: number } = {},
): PlayerRating[] {
  return computeEloWithHistory(matches, opts).ratings;
}
