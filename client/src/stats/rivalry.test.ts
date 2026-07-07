// client/src/stats/rivalry.test.ts
import { describe, it, expect } from "vitest";
import { computeRivalry, rivalryPath } from "./rivalry";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
// Input is newest-first, matching API order.
const meet = (id: string, winner: string, ws: number, loser: string, ls: number): Match => ({
  id, Dato: `2026-07-${id.padStart(2, "0")}`,
  teams: [
    { team: 0, score: ws, won: true, players: [pl(winner)] },
    { team: 1, score: ls, won: false, players: [pl(loser)] },
  ],
});

describe("computeRivalry", () => {
  it("counts only decided meetings between the two players", () => {
    const teammatesMatch: Match = {
      id: "9", Dato: "2026-07-09",
      teams: [
        { team: 0, score: 13, won: true, players: [pl("Ida"), pl("Bo")] },
        { team: 1, score: 7, won: false, players: [pl("Cy")] },
      ],
    };
    const r = computeRivalry([meet("2", "Ida", 13, "Bo", 7), teammatesMatch, meet("1", "Bo", 13, "Ida", 11)], "Ida", "Bo");
    expect(r.games).toBe(2);
    expect(r.aWins).toBe(1);
    expect(r.bWins).toBe(1);
  });

  it("computes avg margin from a's perspective", () => {
    const r = computeRivalry([meet("2", "Ida", 13, "Bo", 7), meet("1", "Bo", 13, "Ida", 11)], "Ida", "Bo");
    expect(r.avgMarginA).toBe(2); // (+6 + -2) / 2
  });

  it("finds the current streak walking newest backwards", () => {
    const r = computeRivalry([
      meet("3", "Ida", 13, "Bo", 5),
      meet("2", "Ida", 13, "Bo", 9),
      meet("1", "Bo", 13, "Ida", 7),
    ], "Ida", "Bo");
    expect(r.streak).toEqual({ player: "Ida", count: 2 });
  });

  it("builds the cumulative series oldest to newest", () => {
    const r = computeRivalry([
      meet("3", "Ida", 13, "Bo", 5),
      meet("2", "Bo", 13, "Ida", 9),
      meet("1", "Ida", 13, "Bo", 7),
    ], "Ida", "Bo");
    expect(r.series).toEqual([
      { game: 1, diff: 1 },
      { game: 2, diff: 0 },
      { game: 3, diff: 1 },
    ]);
  });

  it("returns an empty rivalry for strangers", () => {
    const r = computeRivalry([meet("1", "Ida", 13, "Bo", 7)], "Ida", "Cy");
    expect(r.games).toBe(0);
    expect(r.streak).toBeNull();
    expect(r.meetings).toEqual([]);
  });
});

describe("rivalryPath", () => {
  it("URL-encodes both names", () => {
    expect(rivalryPath("Søren Å", "Bo")).toBe(`/rivalry/${encodeURIComponent("Søren Å")}/Bo`);
  });
});
