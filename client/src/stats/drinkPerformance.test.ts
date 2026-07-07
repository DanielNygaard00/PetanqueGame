// client/src/stats/drinkPerformance.test.ts
import { describe, it, expect } from "vitest";
import { winRateByDrinkType } from "./drinkPerformance";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const game = (id: string, won: boolean, drinks: Match["drinks"]): Match => ({
  id, Dato: `2026-07-${id.padStart(2, "0")}`,
  teams: [
    { team: 0, score: won ? 13 : 5, won, players: [pl("Ida")] },
    { team: 1, score: won ? 5 : 13, won: !won, players: [pl("Bo")] },
  ],
  drinks,
});

describe("winRateByDrinkType", () => {
  it("counts a match under each distinct own drink type", () => {
    const r = winRateByDrinkType([
      game("1", true, [{ type: "Øl", count: 1, player: "Ida" }, { type: "Vin", count: 1, player: "Ida" }]),
      game("2", false, [{ type: "Øl", count: 2, player: "Ida" }]),
    ], "Ida");
    const beer = r.find((x) => x.type === "Øl")!;
    expect(beer.games).toBe(2);
    expect(beer.winRate).toBe(50);
    expect(r.find((x) => x.type === "Vin")!.winRate).toBe(100);
  });

  it("buckets drink-free matches as Ingen and typeless drinks as Andet", () => {
    const r = winRateByDrinkType([
      game("1", true, []),
      game("2", true, [{ count: 1, player: "Ida" }]),
    ], "Ida");
    expect(r.find((x) => x.type === "Ingen")!.games).toBe(1);
    expect(r.find((x) => x.type === "Andet")!.games).toBe(1);
  });

  it("ignores other players' drinks and undecided matches", () => {
    const undecided: Match = { id: "9", teams: [
      { team: 0, score: null, won: false, players: [pl("Ida")] },
      { team: 1, score: null, won: false, players: [pl("Bo")] },
    ] };
    const r = winRateByDrinkType([
      game("1", true, [{ type: "Øl", count: 1, player: "Bo" }]),
      undecided,
    ], "Ida");
    expect(r.find((x) => x.type === "Øl")).toBeUndefined();
    expect(r.find((x) => x.type === "Ingen")!.games).toBe(1);
  });

  it("sorts by games descending", () => {
    const r = winRateByDrinkType([
      game("1", true, [{ type: "Vin", count: 1, player: "Ida" }]),
      game("2", true, [{ type: "Øl", count: 1, player: "Ida" }]),
      game("3", false, [{ type: "Øl", count: 1, player: "Ida" }]),
    ], "Ida");
    expect(r[0].type).toBe("Øl");
  });
});
