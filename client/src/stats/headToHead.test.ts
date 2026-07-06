// client/src/stats/headToHead.test.ts
import { describe, it, expect } from "vitest";
import { headToHead } from "./headToHead";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });

// Match 1: Ida wins vs Bo (13-5)
// Match 2: Bo wins vs Ida (13-9, so Ida loses with margin 9-13 = -4)
// Match 3: Ida loses vs Cae (7-13)
const M: Match[] = [
  {
    id: "1",
    teams: [
      { team: 0, score: 13, won: true,  players: [pl("Ida")] },
      { team: 1, score: 5,  won: false, players: [pl("Bo")] },
    ],
    drinks: [],
  },
  {
    id: "2",
    teams: [
      { team: 0, score: 13, won: true,  players: [pl("Bo")] },
      { team: 1, score: 9,  won: false, players: [pl("Ida")] },
    ],
    drinks: [],
  },
  {
    id: "3",
    teams: [
      { team: 0, score: 7,  won: false, players: [pl("Ida")] },
      { team: 1, score: 13, won: true,  players: [pl("Cae")] },
    ],
    drinks: [],
  },
];

describe("headToHead", () => {
  it("aggregates Ida's record per opponent", () => {
    const rows = headToHead(M, "Ida");
    const vsBo = rows.find((r) => r.opponent === "Bo")!;
    expect(vsBo.games).toBe(2);   // match 1 (Ida won) + match 2 (Ida lost)
    expect(vsBo.wins).toBe(1);
    expect(vsBo.losses).toBe(1);
    // match1: margin = 13-5 = +8; match2: margin = 9-13 = -4; avg = (8 + -4) / 2 = 2
    expect(vsBo.avgMargin).toBe(2);

    const vsCae = rows.find((r) => r.opponent === "Cae")!;
    expect(vsCae.games).toBe(1);
    expect(vsCae.losses).toBe(1);
    expect(vsCae.wins).toBe(0);
    expect(vsCae.winRate).toBe(0);
  });

  it("returns empty array when viewer not in any match", () => {
    const rows = headToHead(M, "Ghost");
    expect(rows).toEqual([]);
  });

  it("sorts by games descending", () => {
    const rows = headToHead(M, "Ida");
    // Bo has 2 games, Cae has 1 — Bo should come first
    expect(rows[0].opponent).toBe("Bo");
    expect(rows[1].opponent).toBe("Cae");
  });
});
