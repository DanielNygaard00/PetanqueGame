import { describe, it, expect } from "vitest";
import { playerDrinkStats } from "./drinkStats";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const matches: Match[] = [
  { id: "1", teams: [
      { team: 0, score: 13, won: true, players: [pl("Ida")] },
      { team: 1, score: 5, won: false, players: [pl("Bo")] }],
    drinks: [{ count: 2, volumeCl: 50, player: "Ida" }, { count: 1, volumeCl: 33, player: "Bo" }] },
  { id: "2", teams: [
      { team: 0, score: 7, won: false, players: [pl("Ida")] },
      { team: 1, score: 13, won: true, players: [pl("Bo")] }],
    drinks: [{ count: 1, volumeCl: 50, player: "Ida" }] },
];

describe("playerDrinkStats", () => {
  it("aggregates units, litres, games and wins per drinker", () => {
    const s = playerDrinkStats(matches);
    const ida = s.find((r) => r.name === "Ida")!;
    expect(ida.units).toBe(3);           // 2 + 1
    expect(ida.litres).toBeCloseTo(1.5); // (2×50 + 1×50) cl = 150 cl = 1.5 L
    expect(s[0].name).toBe("Ida");       // most units first
  });
});
