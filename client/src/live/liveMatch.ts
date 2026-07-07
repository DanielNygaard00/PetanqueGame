// client/src/live/liveMatch.ts
import type { MatchInput } from "../api/types";

export type LiveTeam = { players: string[]; points: number };
export type LiveEnd = { team: 0 | 1; points: number };
export type LiveState = {
  status: "setup" | "playing" | "finished";
  startedAt: string;                 // local "YYYY-MM-DDTHH:MM", empty until play starts
  arena?: string;
  target: number;
  teams: [LiveTeam, LiveTeam];
  ends: LiveEnd[];
};

export function initialLiveState(): LiveState {
  return {
    status: "setup", startedAt: "", target: 13,
    teams: [{ players: [], points: 0 }, { players: [], points: 0 }],
    ends: [],
  };
}

export function validateSetup(state: LiveState): string | null {
  if (state.teams.some((t) => t.players.length === 0)) return "Hvert hold skal have mindst én spiller";
  if (state.teams[0].players.some((p) => state.teams[1].players.includes(p))) return "En spiller kan ikke være på begge hold";
  if (state.target < 1) return "Målscore skal være mindst 1";
  return null;
}

export function startMatch(state: LiveState, now: string): LiveState {
  const err = validateSetup(state);
  if (err) throw new Error(err);
  return { ...state, status: "playing", startedAt: now };
}

// Team points are always derived from ends — the single source of truth.
function recompute(state: LiveState, ends: LiveEnd[]): [LiveTeam, LiveTeam] {
  const pts: [number, number] = [0, 0];
  for (const e of ends) pts[e.team] += e.points;
  return [
    { ...state.teams[0], points: pts[0] },
    { ...state.teams[1], points: pts[1] },
  ];
}

export function scoreEnd(state: LiveState, team: 0 | 1, points: number): LiveState {
  if (state.status !== "playing") return state;
  const p = Math.min(6, Math.max(1, Math.round(points)));
  const ends = [...state.ends, { team, points: p }];
  const teams = recompute(state, ends);
  const finished = teams[0].points >= state.target || teams[1].points >= state.target;
  return { ...state, ends, teams, status: finished ? "finished" : "playing" };
}

export function undoEnd(state: LiveState): LiveState {
  if (state.ends.length === 0) return state;
  const ends = state.ends.slice(0, -1);
  return { ...state, ends, teams: recompute(state, ends), status: "playing" };
}

export function finishMatch(state: LiveState): LiveState {
  if (state.status !== "playing") return state;
  if (state.teams[0].points === state.teams[1].points) return state;
  return { ...state, status: "finished" };
}

export function winnerIndex(state: LiveState): 0 | 1 | null {
  if (state.status !== "finished") return null;
  if (state.teams[0].points === state.teams[1].points) return null;
  return state.teams[0].points > state.teams[1].points ? 0 : 1;
}

export function toMatchInput(state: LiveState): MatchInput {
  return {
    Dato: state.startedAt.slice(0, 10),
    Tid: state.startedAt.slice(11, 16),
    Arena: state.arena,
    teams: state.teams.map((t) => ({ score: t.points, players: t.players })),
  };
}
