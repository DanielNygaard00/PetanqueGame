// client/src/stats/insights.test.ts
import { describe, it, expect } from "vitest";
import { deriveInsights } from "./insights";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });

// 3 morning wins (Arena A) vs Cae/Bo, 3 evening losses (Arena B) vs Cae with drinks
// Provides enough data for time-of-day, arena, opponent, and drink insights
const M: Match[] = [
  {
    id: "1", Dato: "2026-06-01", Tid: "10:00", Arena: "A",
    teams: [
      { team: 0, score: 13, won: true,  players: [pl("Ida")] },
      { team: 1, score: 5,  won: false, players: [pl("Bo")] },
    ],
    drinks: [],
  },
  {
    id: "2", Dato: "2026-06-02", Tid: "10:00", Arena: "A",
    teams: [
      { team: 0, score: 13, won: true,  players: [pl("Ida")] },
      { team: 1, score: 6,  won: false, players: [pl("Bo")] },
    ],
    drinks: [],
  },
  {
    id: "3", Dato: "2026-06-03", Tid: "10:00", Arena: "A",
    teams: [
      { team: 0, score: 13, won: true,  players: [pl("Ida")] },
      { team: 1, score: 7,  won: false, players: [pl("Cae")] },
    ],
    drinks: [],
  },
  {
    id: "4", Dato: "2026-06-04", Tid: "20:00", Arena: "B",
    teams: [
      { team: 0, score: 4,  won: false, players: [pl("Ida")] },
      { team: 1, score: 13, won: true,  players: [pl("Cae")] },
    ],
    drinks: [{ type: "Øl", count: 4 }],
  },
  {
    id: "5", Dato: "2026-06-05", Tid: "20:00", Arena: "B",
    teams: [
      { team: 0, score: 6,  won: false, players: [pl("Ida")] },
      { team: 1, score: 13, won: true,  players: [pl("Cae")] },
    ],
    drinks: [{ type: "Øl", count: 5 }],
  },
  {
    id: "6", Dato: "2026-06-06", Tid: "20:00", Arena: "B",
    teams: [
      { team: 0, score: 8,  won: false, players: [pl("Ida")] },
      { team: 1, score: 13, won: true,  players: [pl("Cae")] },
    ],
    drinks: [{ type: "Øl", count: 3 }],
  },
];

describe("deriveInsights", () => {
  it("produces readable Danish findings from the data", () => {
    const ins = deriveInsights(M, "Ida");
    const text = ins.map((i) => i.text).join(" | ");
    expect(ins.length).toBeGreaterThanOrEqual(3);
    // Overall win-rate insight must mention "vundet" and show 6 games
    expect(text).toMatch(/vundet .* af 6 kampe/i);
    // Time-of-day insight
    expect(text.toLowerCase()).toContain("bedst");
    // Arena insight
    expect(text.toLowerCase()).toContain("bane");
  });

  it("win-rate insight reflects 50% when exactly half won", () => {
    const ins = deriveInsights(M, "Ida");
    // 3 wins out of 6 = 50%
    const winRateInsight = ins.find((i) => i.text.includes("vundet"));
    expect(winRateInsight).toBeDefined();
    expect(winRateInsight!.text).toMatch(/50%/);
  });

  it("returns nothing when there is too little data", () => {
    // Single match — below MIN threshold of 3
    const single: Match[] = [{
      id: "1",
      teams: [
        { team: 0, score: 13, won: true,  players: [pl("Ida")] },
        { team: 1, score: 5,  won: false, players: [pl("Bo")] },
      ],
      drinks: [],
    }];
    expect(deriveInsights(single, "Ida")).toEqual([]);
  });

  it("returns nothing for a viewer not in any match", () => {
    expect(deriveInsights(M, "Ghost")).toEqual([]);
  });
});
