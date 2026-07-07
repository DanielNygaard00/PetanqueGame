// client/src/stats/predict.ts
import type { Match } from "../api/types";
import { computeElo } from "./elo";

const BASE = 1000;

export function winProbability(matches: Match[], teamA: string[], teamB: string[]): number | null {
  if (teamA.length === 0 || teamB.length === 0) return null;
  const ratings = new Map(computeElo(matches).map((r) => [r.name, r.elo]));
  const avg = (team: string[]) => team.reduce((s, n) => s + (ratings.get(n) ?? BASE), 0) / team.length;
  return 1 / (1 + Math.pow(10, (avg(teamB) - avg(teamA)) / 400));
}
