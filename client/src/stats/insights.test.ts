// client/src/stats/insights.test.ts
import { describe, it, expect } from "vitest";
import { deriveInsights } from "./insights";

// 4 morning wins, 3 evening losses, arena A vs B, opponents Bo/Cae
const M = [
  { id: "1", Dato: "2026-06-01", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 5, Arena: "A", Modstander: "Bo",  Spiller: "Ida", Gruppe_Bool: false, drinks: [] },
  { id: "2", Dato: "2026-06-02", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 6, Arena: "A", Modstander: "Bo",  Spiller: "Ida", Gruppe_Bool: false, drinks: [] },
  { id: "3", Dato: "2026-06-03", Tid: "10:00", Vundet: true,  Point: 13, Modstander_Point: 7, Arena: "A", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [] },
  { id: "4", Dato: "2026-06-04", Tid: "20:00", Vundet: false, Point: 4,  Modstander_Point: 13, Arena: "B", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [{ type: "Øl", count: 4 }] },
  { id: "5", Dato: "2026-06-05", Tid: "20:00", Vundet: false, Point: 6,  Modstander_Point: 13, Arena: "B", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [{ type: "Øl", count: 5 }] },
  { id: "6", Dato: "2026-06-06", Tid: "20:00", Vundet: false, Point: 8,  Modstander_Point: 13, Arena: "B", Modstander: "Cae", Spiller: "Ida", Gruppe_Bool: false, drinks: [{ type: "Øl", count: 3 }] },
] as any;

describe("deriveInsights", () => {
  it("produces readable Danish findings from the data", () => {
    const ins = deriveInsights(M);
    const text = ins.map((i) => i.text).join(" | ");
    expect(ins.length).toBeGreaterThanOrEqual(3);
    expect(text).toMatch(/vundet .* af 6 kampe/i);        // overall win-rate
    expect(text.toLowerCase()).toContain("bedst");         // best time-of-day
    expect(text.toLowerCase()).toContain("bane");          // best arena
  });

  it("returns nothing when there is too little data", () => {
    expect(deriveInsights([{ id: "1", Vundet: true } as any])).toEqual([]);
  });
});
