// client/src/stats/monthGroups.test.ts
import { describe, it, expect } from "vitest";
import { groupMatchesByMonth } from "./monthGroups";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const m = (id: string, dato: string | undefined, winner: string, loser: string): Match => ({
  id, Dato: dato,
  teams: [
    { team: 0, score: 13, won: true, players: [pl(winner)] },
    { team: 1, score: 7, won: false, players: [pl(loser)] },
  ],
});

describe("groupMatchesByMonth", () => {
  it("groups by month with Danish labels, preserving order", () => {
    const groups = groupMatchesByMonth([m("1", "2026-07-05", "Ida", "Bo"), m("2", "2026-07-01", "Bo", "Ida"), m("3", "2026-06-20", "Ida", "Bo")]);
    expect(groups.map((g) => g.key)).toEqual(["2026-07", "2026-06"]);
    expect(groups[0].label).toBe("juli 2026");
    expect(groups[1].label).toBe("juni 2026");
    expect(groups[0].matches.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("counts wins for the given user", () => {
    const groups = groupMatchesByMonth([m("1", "2026-07-05", "Ida", "Bo"), m("2", "2026-07-01", "Bo", "Ida")], "Ida");
    expect(groups[0].wins).toBe(1);
    expect(groups[0].participated).toBe(true);
  });

  it("marks non-participants", () => {
    const groups = groupMatchesByMonth([m("1", "2026-07-05", "Ida", "Bo")], "Cy");
    expect(groups[0].participated).toBe(false);
    expect(groups[0].wins).toBe(0);
  });

  it("groups undated matches last under Uden dato", () => {
    const groups = groupMatchesByMonth([m("1", undefined, "Ida", "Bo"), m("2", "2026-07-01", "Ida", "Bo")]);
    expect(groups.map((g) => g.label)).toEqual(["juli 2026", "Uden dato"]);
  });
});
