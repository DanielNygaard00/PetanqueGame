// client/src/stats/predict.test.ts
import { describe, it, expect } from "vitest";
import { winProbability } from "./predict";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const win = (id: string, winner: string, loser: string): Match => ({
  id, Dato: `2026-06-${id.padStart(2, "0")}`,
  teams: [
    { team: 0, score: 13, won: true, players: [pl(winner)] },
    { team: 1, score: 5, won: false, players: [pl(loser)] },
  ],
});

describe("winProbability", () => {
  it("gives 0.5 for unknown vs unknown (both at base 1000)", () => {
    expect(winProbability([], ["Ny1"], ["Ny2"])).toBe(0.5);
  });

  it("favours the historically stronger team", () => {
    const history = ["1", "2", "3", "4"].map((i) => win(i, "Ida", "Bo"));
    const p = winProbability(history, ["Ida"], ["Bo"]);
    expect(p).toBeGreaterThan(0.5);
  });

  it("averages team ratings and treats unknown players as base", () => {
    const history = ["1", "2", "3", "4"].map((i) => win(i, "Ida", "Bo"));
    const solo = winProbability(history, ["Ida"], ["Bo"])!;
    const diluted = winProbability(history, ["Ida", "NyMakker"], ["Bo", "NyModstander"])!;
    expect(diluted).toBeGreaterThan(0.5);
    expect(diluted).toBeLessThan(solo);
  });

  it("returns null for an empty team", () => {
    expect(winProbability([], [], ["Bo"])).toBeNull();
    expect(winProbability([], ["Ida"], [])).toBeNull();
  });
});
