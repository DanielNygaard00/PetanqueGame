// client/src/stats/derive.test.ts
import { describe, it, expect } from "vitest";
import { deriveStats } from "./derive";

const M = [
  { id: "1", Dato: "2026-06-01", Vundet: true, Point: 13, Arena: "A", Drik_Navn: "Rosé" },
  { id: "2", Dato: "2026-06-02", Vundet: true, Point: 11, Arena: "A", Drik_Navn: "Rosé" },
  { id: "3", Dato: "2026-06-03", Vundet: false, Point: 7, Arena: "B", Drik_Navn: "Øl" },
] as any;

describe("deriveStats", () => {
  it("computes win rate, points, streak and tops", () => {
    const s = deriveStats(M);
    expect(s.total).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.winRate).toBeCloseTo(66.67, 1);
    expect(s.totalPoints).toBe(31);
    expect(s.longestStreak).toBe(2);
    expect(s.topArenas[0]).toEqual({ name: "A", count: 2 });
    expect(s.topDrinks[0]).toEqual({ name: "Rosé", count: 2 });
    expect(s.pointsOverTime).toHaveLength(3);
  });
});
