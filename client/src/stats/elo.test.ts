// client/src/stats/elo.test.ts
import { describe, it, expect } from "vitest";
import { computeElo } from "./elo";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const oneVone = (a: string, sa: number, b: string, sb: number, i: number): Match => ({
  id: String(i), Dato: `2026-06-${String(i + 1).padStart(2, "0")}`, Tid: "18:00",
  teams: [{ team: 0, score: sa, won: sa > sb, players: [pl(a)] }, { team: 1, score: sb, won: sb > sa, players: [pl(b)] }],
});

describe("computeElo", () => {
  it("ranks a consistent winner above the loser", () => {
    const r = computeElo(Array.from({ length: 6 }, (_, i) => oneVone("Ida", 13, "Bo", 5, i)));
    expect(r[0].name).toBe("Ida");
    expect(r[0].elo).toBeGreaterThan(1000);
    expect(r[1].elo).toBeLessThan(1000);
    expect(r[0].wins).toBe(6);
    expect(r[0].provisional).toBe(false);
    expect(r[0].form).toEqual(["W", "W", "W", "W", "W"]);
  });

  it("rates every member of a 2v2 game", () => {
    const m: Match = { id: "1", Dato: "2026-06-01", teams: [
      { team: 0, score: 13, won: true, players: [pl("Ida"), pl("Ann")] },
      { team: 1, score: 7, won: false, players: [pl("Bo"), pl("Cy")] },
    ] };
    const r = computeElo([m]);
    expect(r.map((p) => p.name).sort()).toEqual(["Ann", "Bo", "Cy", "Ida"]);
    expect(r.find((p) => p.name === "Ida")!.wins).toBe(1);
    expect(r.find((p) => p.name === "Bo")!.losses).toBe(1);
  });

  it("decomposes a 3-way into pairwise matchups", () => {
    const m: Match = { id: "1", Dato: "2026-06-01", teams: [
      { team: 0, score: 11, won: true, players: [pl("Ida")] },
      { team: 1, score: 5, won: false, players: [pl("Bo")] },
      { team: 2, score: 0, won: false, players: [pl("Cy")] },
    ] };
    const r = computeElo([m]);
    const ida = r.find((p) => p.name === "Ida")!;
    expect(ida.wins).toBe(2);   // beat Bo and Cy
    expect(ida.games).toBe(2);
    expect(r.find((p) => p.name === "Cy")!.losses).toBe(2);
    expect(r[0].name).toBe("Ida");
  });

  it("computes avgMargin from each player's perspective", () => {
    const r = computeElo([oneVone("Ida", 13, "Bo", 5, 0)]);
    expect(r.find((p) => p.name === "Ida")!.avgMargin).toBe(8);
    expect(r.find((p) => p.name === "Bo")!.avgMargin).toBe(-8);
  });
});
