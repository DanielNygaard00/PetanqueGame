// test/mapping.test.ts
import { describe, it, expect } from "vitest";
import { toRow, toApi, MATCH_COLUMNS } from "../src/mapping";

describe("match mapping", () => {
  it("maps Danish API keys to snake_case columns", () => {
    const row = toRow({ Dato: "2026-07-01", Vundet: true, Point: 13, Spiller: "Ida", Gruppe_Bool: false });
    expect(row.date).toBe("2026-07-01");
    expect(row.won).toBe(1);
    expect(row.is_group).toBe(0);
    expect(row.points).toBe(13);
    expect(row.player).toBe("Ida");
  });

  it("round-trips columns back to Danish keys with booleans restored", () => {
    const api = toApi({ id: "abc", date: "2026-07-01", won: 1, is_group: 0, points: 13, player: "Ida" });
    expect(api.id).toBe("abc");
    expect(api.Dato).toBe("2026-07-01");
    expect(api.Vundet).toBe(true);
    expect(api.Gruppe_Bool).toBe(false);
    expect(api.Spiller).toBe("Ida");
  });

  it("exposes the 16 export columns in order", () => {
    expect(MATCH_COLUMNS[0]).toBe("Dato");
    expect(MATCH_COLUMNS).toHaveLength(16);
    expect(MATCH_COLUMNS[MATCH_COLUMNS.length - 1]).toBe("Spillets genstande");
  });
});
