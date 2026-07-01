// test/mapping.test.ts — replace the mapping describe block
import { describe, it, expect } from "vitest";
import { toRow, toApi } from "../src/mapping";

describe("match mapping v2", () => {
  it("maps match-level Danish keys incl. Tid and Modstander_Point", () => {
    const row = toRow({ Dato: "2026-07-01", Tid: "18:30", Vundet: true, Point: 13, Modstander_Point: 7, Spiller: "Ida" });
    expect(row.date).toBe("2026-07-01");
    expect(row.time).toBe("18:30");
    expect(row.won).toBe(1);
    expect(row.points).toBe(13);
    expect(row.opponent_points).toBe(7);
    expect(row.player).toBe("Ida");
  });

  it("does NOT map drink keys (drinks live in match_drinks now)", () => {
    const row = toRow({ Drik_Type: "Vin", Drik_Navn: "Rosé" } as any);
    expect(row.drink_type).toBeUndefined();
    expect("drink_type" in row).toBe(false);
  });

  it("round-trips a match row back to Danish keys with booleans + new fields", () => {
    const api = toApi({ id: "m1", date: "2026-07-01", time: "18:30", won: 1, is_group: 0, points: 13, opponent_points: 7, player: "Ida" });
    expect(api.Dato).toBe("2026-07-01");
    expect(api.Tid).toBe("18:30");
    expect(api.Vundet).toBe(true);
    expect(api.Gruppe_Bool).toBe(false);
    expect(api.Point).toBe(13);
    expect(api.Modstander_Point).toBe(7);
  });
});
