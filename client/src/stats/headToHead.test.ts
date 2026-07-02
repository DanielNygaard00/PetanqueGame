import { describe, it, expect } from "vitest";
import { headToHead } from "./headToHead";
const M = [
  { id: "1", Spiller: "Ida", Modstander: "Bo", Vundet: true, Point: 13, Modstander_Point: 5, Gruppe_Bool: false },
  { id: "2", Spiller: "Bo", Modstander: "Ida", Vundet: true, Point: 13, Modstander_Point: 9, Gruppe_Bool: false },
  { id: "3", Spiller: "Ida", Modstander: "Cae", Vundet: false, Point: 7, Modstander_Point: 13, Gruppe_Bool: false },
  { id: "4", Spiller: "Ida", Modstander: "Bo", Vundet: true, Gruppe_Bool: true }, // group excluded
] as any;
describe("headToHead", () => {
  it("aggregates Ida's record per opponent (both directions, non-group)", () => {
    const rows = headToHead(M, "Ida");
    const vsBo = rows.find((r) => r.opponent === "Bo")!;
    expect(vsBo.games).toBe(2);      // match 1 (win) + match 2 (Ida was Modstander, Bo won → Ida loss)
    expect(vsBo.wins).toBe(1);
    expect(vsBo.losses).toBe(1);
    expect(vsBo.avgMargin).toBe(2);  // match1: 13−5=+8; match2 (Ida as Modstander): 9−13=−4; avg=(8+−4)/2=2
    const vsCae = rows.find((r) => r.opponent === "Cae")!;
    expect(vsCae.games).toBe(1);
    expect(vsCae.losses).toBe(1);
  });
});
