// client/src/stats/awards.test.ts
import { describe, it, expect } from "vitest";
import { filterByPeriod, computeAwards } from "./awards";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const game = (id: string, dato: string | undefined, winner: string, ws: number, loser: string, ls: number, extras?: Partial<Match>): Match => ({
  id, Dato: dato,
  teams: [
    { team: 0, score: ws, won: ws > ls, players: [pl(winner)] },
    { team: 1, score: ls, won: ls > ws, players: [pl(loser)] },
  ],
  ...extras,
});
const find = (awards: ReturnType<typeof computeAwards>, key: string) => awards.find((a) => a.key === key);

describe("filterByPeriod", () => {
  const now = new Date(2026, 6, 15); // July 2026
  const ms = [game("1", "2026-07-01", "Ida", 13, "Bo", 5), game("2", "2026-01-01", "Ida", 13, "Bo", 5), game("3", undefined, "Ida", 13, "Bo", 5)];
  it("month keeps only the current calendar month", () => {
    expect(filterByPeriod(ms, "month", now).map((m) => m.id)).toEqual(["1"]);
  });
  it("year keeps the calendar year", () => {
    expect(filterByPeriod(ms, "year", now).map((m) => m.id)).toEqual(["1", "2"]);
  });
  it("all keeps everything including dateless", () => {
    expect(filterByPeriod(ms, "all", now)).toHaveLength(3);
  });
});

describe("computeAwards", () => {
  // Ida beats Bo 4x, Bo beats Ida 1x (newest first like the API) -> 5 decided games each
  const base: Match[] = [
    game("5", "2026-07-05", "Bo", 13, "Ida", 7),
    game("4", "2026-07-04", "Ida", 13, "Bo", 5),
    game("3", "2026-07-03", "Ida", 13, "Bo", 5),
    game("2", "2026-07-02", "Ida", 13, "Bo", 5),
    game("1", "2026-07-01", "Ida", 13, "Bo", 5),
  ];

  it("crowns the best win rate as Periodens spiller", () => {
    const a = find(computeAwards(base, base), "player")!;
    expect(a.winner).toBe("Ida");
    expect(a.detail).toBe("80% sejre i 5 kampe");
  });

  it("gives Træskallen to the worst win rate", () => {
    expect(find(computeAwards(base, base), "wooden")!.winner).toBe("Bo");
  });

  it("omits threshold awards under MIN games", () => {
    const two = base.slice(3); // 2 games
    const awards = computeAwards(two, two);
    expect(find(awards, "player")).toBeUndefined();
    expect(find(awards, "wooden")).toBeUndefined();
  });

  it("finds win and loss streaks chronologically", () => {
    const awards = computeAwards(base, base);
    expect(find(awards, "streak")!.winner).toBe("Ida");
    expect(find(awards, "streak")!.detail).toBe("4 sejre i træk");
    expect(find(awards, "cold")!.winner).toBe("Bo");
    expect(find(awards, "cold")!.detail).toBe("4 nederlag i træk");
  });

  it("awards Største upset only above the +13 floor and Mest forbedret for net gain", () => {
    const awards = computeAwards(base, base);
    // Bo's win in game 5 is against a 4-0 Ida: single-match delta > 13
    expect(find(awards, "upset")!.winner).toBe("Bo");
    // Ida gained 4 wins' worth of Elo, net positive despite the loss
    expect(find(awards, "improved")!.winner).toBe("Ida");
  });

  it("awards Tørstigst and Bedst på promille from attributed drinks", () => {
    const drink = (n: number) => [{ type: "Øl", count: n, player: "Ida" }];
    const boozy: Match[] = [
      game("4", "2026-07-04", "Ida", 13, "Bo", 5, { drinks: drink(3) }),
      game("3", "2026-07-03", "Ida", 13, "Bo", 5, { drinks: drink(4) }),
      game("2", "2026-07-02", "Ida", 13, "Bo", 5, { drinks: drink(3) }),
      game("1", "2026-07-01", "Bo", 13, "Ida", 5, { drinks: drink(1) }),
    ];
    const awards = computeAwards(boozy, boozy);
    expect(find(awards, "thirst")!.winner).toBe("Ida");
    expect(find(awards, "thirst")!.detail).toBe("11 genstande");
    const tipsy = find(awards, "tipsy")!;
    expect(tipsy.winner).toBe("Ida");
    expect(tipsy.detail).toBe("100% sejre med 3+ genstande");
  });

  it("crowns Banekonge at the most-played arena", () => {
    const arena: Match[] = [
      game("4", "2026-07-04", "Ida", 13, "Bo", 5, { Arena: "Parken" }),
      game("3", "2026-07-03", "Ida", 13, "Bo", 5, { Arena: "Parken" }),
      game("2", "2026-07-02", "Ida", 13, "Bo", 5, { Arena: "Parken" }),
      game("1", "2026-07-01", "Bo", 13, "Ida", 5, { Arena: "Havnen" }),
    ];
    const a = find(computeAwards(arena, arena), "arena")!;
    expect(a.winner).toBe("Ida");
    expect(a.detail).toBe("100% sejre på Parken");
  });

  it("returns an empty list for no matches", () => {
    expect(computeAwards([], [])).toEqual([]);
  });
});
