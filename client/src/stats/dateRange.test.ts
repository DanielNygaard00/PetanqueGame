import { describe, it, expect } from "vitest";
import { filterByRange } from "./dateRange";
const M = [
  { id: "1", Dato: "2026-07-01" }, { id: "2", Dato: "2026-06-01" },
  { id: "3", Dato: "2025-12-31" }, { id: "4", Dato: "2026-07-10" },
] as any;
const now = new Date("2026-07-11T12:00:00");
describe("filterByRange", () => {
  it("all → everything", () => expect(filterByRange(M, "all", now)).toHaveLength(4));
  it("year → same calendar year", () => expect(filterByRange(M, "year", now).map((m) => m.id).sort()).toEqual(["1", "2", "4"]));
  it("30d → within last 30 days", () => expect(filterByRange(M, "30d", now).map((m) => m.id).sort()).toEqual(["1", "4"]));
});
