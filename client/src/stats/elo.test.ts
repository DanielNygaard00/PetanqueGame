// client/src/stats/elo.test.ts
import { describe, it, expect } from "vitest";
import { computeElo } from "./elo";

const wins = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: String(i), Dato: `2026-06-${String(i + 1).padStart(2, "0")}`,
  Spiller: "Ida", Modstander: "Bo", Vundet: true, Point: 13, Modstander_Point: 5, Gruppe_Bool: false,
})) as any;

describe("computeElo", () => {
  it("ranks a consistent winner above the loser", () => {
    const r = computeElo(wins(6));
    expect(r[0].name).toBe("Ida");
    expect(r[0].elo).toBeGreaterThan(1000);
    expect(r[1].name).toBe("Bo");
    expect(r[1].elo).toBeLessThan(1000);
    expect(r[0].wins).toBe(6);
    expect(r[1].losses).toBe(6);
    expect(r[0].provisional).toBe(false); // 6 >= 5
    expect(r[0].form).toEqual(["W", "W", "W", "W", "W"]); // last 5
  });

  it("excludes group matches and indecisive results", () => {
    const r = computeElo([
      { id: "1", Dato: "2026-06-01", Spiller: "Ida", Modstander: "Bo", Vundet: true, Gruppe_Bool: true },
      { id: "2", Dato: "2026-06-02", Spiller: "Ida", Modstander: "Bo" },
    ] as any);
    expect(r).toHaveLength(0);
  });

  it("computes avgMargin from each player's perspective", () => {
    const r = computeElo(wins(1));
    const ida = r.find((p) => p.name === "Ida")!;
    const bo = r.find((p) => p.name === "Bo")!;
    expect(ida.avgMargin).toBe(8);   // 13 - 5
    expect(bo.avgMargin).toBe(-8);
  });
});
