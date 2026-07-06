// client/src/stats/derive.test.ts
import { describe, it, expect } from "vitest";
import { deriveStats, matchUnits, timeBucket } from "./derive";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });

// Helper: Ida wins against Bo, optional drink units
const win = (i: number, units = 0): Match => ({
  id: String(i),
  Dato: `2026-06-${String(i + 1).padStart(2, "0")}`,
  Tid: "18:00",
  Arena: "Park",
  teams: [
    { team: 0, score: 13, won: true,  players: [pl("Ida")] },
    { team: 1, score: 5,  won: false, players: [pl("Bo")] },
  ],
  drinks: units ? [{ count: units }] : [],
});

// Helper: Ida loses against Bo
const loss = (i: number, units = 0): Match => ({
  id: String(i),
  Dato: `2026-06-${String(i + 1).padStart(2, "0")}`,
  Tid: "20:00",
  Arena: "Strand",
  teams: [
    { team: 0, score: 5,  won: false, players: [pl("Ida")] },
    { team: 1, score: 13, won: true,  players: [pl("Bo")] },
  ],
  drinks: units ? [{ count: units }] : [],
});

describe("deriveStats", () => {
  it("computes total, wins, winRate, longestStreak correctly", () => {
    // 2 wins then 1 loss
    const matches = [win(0), win(1), loss(2)];
    const s = deriveStats(matches, "Ida");
    expect(s.total).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.winRate).toBeCloseTo(66.67, 1);
    expect(s.longestStreak).toBe(2);
  });

  it("returns zero stats for viewer not in any match", () => {
    const s = deriveStats([win(0), win(1)], "Unknown");
    expect(s.total).toBe(0);
    expect(s.wins).toBe(0);
    expect(s.winRate).toBe(0);
  });

  it("totalPoints sums myScore across all matches", () => {
    // Ida scores 13 in each win (score is 13 per win fixture)
    const s = deriveStats([win(0), win(1)], "Ida");
    expect(s.totalPoints).toBe(26);
  });

  it("topArenas aggregates by arena name", () => {
    // win(0) and win(1) both use Arena "Park"; loss(2) uses "Strand"
    const s = deriveStats([win(0), win(1), loss(2)], "Ida");
    expect(s.topArenas[0]).toEqual({ name: "Park", count: 2 });
  });

  it("byOpponent groups by opponent name", () => {
    const s = deriveStats([win(0), win(1), loss(2)], "Ida");
    // All 3 matches are against "Bo"
    expect(s.byOpponent[0].key).toBe("Bo");
    expect(s.byOpponent[0].games).toBe(3);
  });

  it("pointsOverTime has one entry per match, sorted by date", () => {
    const s = deriveStats([loss(2), win(0), win(1)], "Ida");
    expect(s.pointsOverTime).toHaveLength(3);
    // First entry should be the earliest date (win 0 = 2026-06-01)
    expect(s.pointsOverTime[0].date).toBe("2026-06-01");
  });
});

describe("deriveStats v2 — units and buckets", () => {
  it("matchUnits sums drink counts", () => {
    const m: Match = {
      id: "x", teams: [],
      drinks: [{ count: 2 }, { count: 3 }],
    };
    expect(matchUnits(m)).toBe(5);
  });

  it("timeBucket classifies time strings", () => {
    expect(timeBucket("10:00")).toBe("morning");
    expect(timeBucket("19:00")).toBe("evening");
    expect(timeBucket("14:00")).toBe("afternoon");
    expect(timeBucket("02:00")).toBe("night");
    expect(timeBucket(undefined)).toBe("unknown");
  });

  it("byUnitsBucket: sober game win-rate vs drunk games", () => {
    // 1 sober win, 1 loss with 3 drinks, 1 loss with 5 drinks
    const matches: Match[] = [
      win(0, 0),   // sober win
      loss(1, 3),  // loss, 3-4 bucket
      loss(2, 5),  // loss, 5+ bucket
    ];
    const s = deriveStats(matches, "Ida");
    const zero = s.byUnitsBucket.find((b) => b.bucket === "0")!;
    expect(zero.games).toBe(1);
    expect(zero.winRate).toBe(100);

    const bucket34 = s.byUnitsBucket.find((b) => b.bucket === "3–4")!;
    expect(bucket34.games).toBe(1);
    expect(bucket34.winRate).toBe(0);

    const bucket5 = s.byUnitsBucket.find((b) => b.bucket === "5+")!;
    expect(bucket5.games).toBe(1);
    expect(bucket5.winRate).toBe(0);
  });

  it("totalDrinks sums all drink units across matches", () => {
    const s = deriveStats([win(0, 0), loss(1, 3), loss(2, 5)], "Ida");
    expect(s.totalDrinks).toBe(8); // 0 + 3 + 5
  });

  it("consumptionByMonth aggregates drink units per month", () => {
    // All matches in June 2026
    const s = deriveStats([win(0, 2), loss(1, 3)], "Ida");
    expect(s.consumptionByMonth).toHaveLength(1);
    expect(s.consumptionByMonth[0].month).toBe("2026-06");
    expect(s.consumptionByMonth[0].units).toBe(5);
  });

  it("byArena computes games and winRate per arena", () => {
    // win(0) → Park, win(1) → Park, loss(2) → Strand
    const s = deriveStats([win(0), win(1), loss(2)], "Ida");
    const park = s.byArena.find((a) => a.key === "Park")!;
    expect(park.games).toBe(2);
    expect(park.winRate).toBe(100);
    const strand = s.byArena.find((a) => a.key === "Strand")!;
    expect(strand.games).toBe(1);
    expect(strand.winRate).toBe(0);
  });
});
