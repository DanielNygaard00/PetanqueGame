// client/src/stats/derive.test.ts
import { describe, it, expect } from "vitest";
import { deriveStats, matchUnits, matchMargin, timeBucket } from "./derive";

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

const V2 = [
  { id: "1", Dato: "2026-06-01", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 5, Arena: "A", drinks: [] },
  { id: "2", Dato: "2026-06-02", Tid: "19:00", Vundet: false, Point: 8,  Modstander_Point: 13, Arena: "A", drinks: [{ type: "Øl", count: 3 }] },
  { id: "3", Dato: "2026-06-03", Tid: "20:00", Vundet: false, Point: 6,  Modstander_Point: 13, Arena: "B", drinks: [{ type: "Øl", count: 2 }, { type: "Vin", count: 3 }] },
] as any;

describe("deriveStats v2", () => {
  it("computes units and margin helpers", () => {
    expect(matchUnits(V2[2])).toBe(5);
    expect(matchMargin(V2[0])).toBe(8);      // 13 - 5
    expect(timeBucket("10:00")).toBe("morning");
    expect(timeBucket("19:00")).toBe("evening");
  });

  it("buckets win-rate by units drunk", () => {
    const s = deriveStats(V2);
    const zero = s.byUnitsBucket.find((b) => b.bucket === "0")!;
    expect(zero.games).toBe(1);
    expect(zero.winRate).toBe(100);          // the sober game was won
    const five = s.byUnitsBucket.find((b) => b.bucket === "5+")!;
    expect(five.games).toBe(1);
    expect(five.winRate).toBe(0);
    expect(s.totalDrinks).toBe(8); // 0 + 3 + (2+3) = 8
  });

  it("aggregates by arena with avg margin", () => {
    const s = deriveStats(V2);
    const a = s.byArena.find((x) => x.key === "A")!;
    expect(a.games).toBe(2);
  });
});
