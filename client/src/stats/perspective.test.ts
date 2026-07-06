import { describe, it, expect } from "vitest";
import { matchPerspective, isGroup, matchUnits } from "./perspective";
import type { Match } from "../api/types";

const pl = (name: string) => ({ id: name, name });
const m1: Match = { id: "1", teams: [
  { team: 0, score: 13, won: true, players: [pl("Ida")] },
  { team: 1, score: 5, won: false, players: [pl("Bo")] },
] };
const threeWay: Match = { id: "2", teams: [
  { team: 0, score: 11, won: true, players: [pl("Ida")] },
  { team: 1, score: 5, won: false, players: [pl("Bo")] },
  { team: 2, score: 0, won: false, players: [pl("Cy")] },
], drinks: [{ count: 2 }, { count: 1 }] };

describe("matchPerspective", () => {
  it("returns win + opponents for the viewer", () => {
    const p = matchPerspective(m1, "Ida")!;
    expect(p.won).toBe(true); expect(p.myScore).toBe(13); expect(p.oppScore).toBe(5);
    expect(p.opponents).toEqual(["Bo"]); expect(p.teammates).toEqual([]);
  });
  it("returns loss for the other side", () => {
    expect(matchPerspective(m1, "Bo")!.won).toBe(false);
  });
  it("null when viewer did not play", () => {
    expect(matchPerspective(m1, "Zed")).toBeNull();
  });
  it("N-way: opponents are everyone on other teams, oppScore is the best of them", () => {
    const p = matchPerspective(threeWay, "Ida")!;
    expect(p.opponents.sort()).toEqual(["Bo", "Cy"]);
    expect(p.oppScore).toBe(5); expect(p.won).toBe(true);
  });
  it("isGroup true for N-way and doubles", () => {
    expect(isGroup(m1)).toBe(false);
    expect(isGroup(threeWay)).toBe(true);
  });
  it("matchUnits sums drink counts", () => {
    expect(matchUnits(threeWay)).toBe(3);
  });
});
