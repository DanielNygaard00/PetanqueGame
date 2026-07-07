// client/src/pages/matchFormDraft.test.ts
import { describe, it, expect } from "vitest";
import { formHasSubstance } from "./MatchFormPage";

const empty = { teams: [{ score: null, players: ["daniel"] }, { score: null, players: [] }], drinks: [] };

describe("formHasSubstance", () => {
  it("treats the prefilled default form as insubstantial", () => {
    expect(formHasSubstance({ ...empty, Dato: "2026-07-07", Tid: "18:00", Arena: "Fælledparken" })).toBe(false);
  });

  it("counts drinks as substance", () => {
    expect(formHasSubstance({ ...empty, drinks: [{ type: "Øl", count: 1 }] })).toBe(true);
  });

  it("counts a second player on team 0 as substance", () => {
    expect(formHasSubstance({ ...empty, teams: [{ score: null, players: ["daniel", "Ida"] }, { score: null, players: [] }] })).toBe(true);
  });

  it("counts players on team 1 as substance", () => {
    expect(formHasSubstance({ ...empty, teams: [{ score: null, players: ["daniel"] }, { score: null, players: ["Bo"] }] })).toBe(true);
  });

  it("counts a score as substance", () => {
    expect(formHasSubstance({ ...empty, teams: [{ score: 13, players: ["daniel"] }, { score: null, players: [] }] })).toBe(true);
  });

  it("counts Spillets genstande as substance", () => {
    expect(formHasSubstance({ ...empty, "Spillets genstande": "Kugler" })).toBe(true);
  });
});
