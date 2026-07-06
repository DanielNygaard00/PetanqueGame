import type { Match } from "../api/types";

export type Perspective = {
  won: boolean | null;
  myScore: number | null;
  oppScore: number | null;
  teammates: string[];
  opponents: string[];
};

export function matchPerspective(m: Match, viewer: string): Perspective | null {
  const teams = m.teams ?? [];
  const myTeam = teams.find((t) => t.players.some((p) => p.name === viewer));
  if (!myTeam) return null;
  const others = teams.filter((t) => t !== myTeam);
  const myScore = myTeam.score ?? null;
  const oppScores = others.map((t) => t.score).filter((s): s is number => typeof s === "number");
  const oppScore = oppScores.length ? Math.max(...oppScores) : null;
  const decided = myScore !== null && oppScore !== null;
  const won = decided ? (myScore > oppScore! ? true : myScore < oppScore! ? false : null) : null;
  return {
    won,
    myScore,
    oppScore,
    teammates: myTeam.players.filter((p) => p.name !== viewer).map((p) => p.name),
    opponents: others.flatMap((t) => t.players.map((p) => p.name)),
  };
}

export function isGroup(m: Match): boolean {
  const teams = m.teams ?? [];
  return teams.length > 2 || teams.some((t) => t.players.length > 1);
}

export const matchUnits = (m: Match) => (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
