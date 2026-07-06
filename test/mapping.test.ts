import { describe, it, expect } from "vitest";
import { toRow, toApi } from "../src/mapping";

describe("mapping", () => {
  it("maps api keys to slim columns", () => {
    expect(toRow({ Dato: "2026-07-01", Tid: "18:00", Arena: "Park", "Spillets genstande": "n" }))
      .toEqual({ date: "2026-07-01", time: "18:00", arena: "Park", game_items: "n" });
  });
  it("ignores unknown keys (teams/drinks handled elsewhere)", () => {
    expect(toRow({ Dato: "2026-07-01", teams: [], drinks: [] })).toEqual({ date: "2026-07-01" });
  });
  it("maps columns back to api keys", () => {
    expect(toApi({ id: "x", date: "2026-07-01", arena: "Park" }))
      .toEqual({ id: "x", Dato: "2026-07-01", Arena: "Park" });
  });
});
