import { describe, it, expect } from "vitest";
import { validateMatch } from "../src/validate";

const base = { Dato: "2026-07-01", teams: [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Bo"] }] };

describe("validateMatch", () => {
  it("accepts a valid match", () => { expect(validateMatch(base)).toBeNull(); });
  it("requires Dato", () => { expect(validateMatch({ ...base, Dato: "" })).toMatch(/Dato/); });
  it("requires at least two teams", () => {
    expect(validateMatch({ Dato: "x", teams: [{ score: 1, players: ["Ida"] }] })).toMatch(/two teams/);
  });
  it("requires each team to have a player", () => {
    expect(validateMatch({ Dato: "x", teams: [{ players: ["Ida"] }, { players: [] }] })).toMatch(/at least one player/);
  });
  it("rejects out-of-range scores", () => {
    expect(validateMatch({ Dato: "x", teams: [{ score: 99, players: ["Ida"] }, { players: ["Bo"] }] })).toMatch(/0\.\.50/);
  });
  it("rejects bad drink count", () => {
    expect(validateMatch({ ...base, drinks: [{ count: 0 }] })).toMatch(/drink count/);
  });
  it("rejects duplicate player across teams", () => {
    expect(validateMatch({ Dato: "x", teams: [{ players: ["Ida"] }, { players: ["Ida"] }] })).toMatch(/once per match/);
  });
});
