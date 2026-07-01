// test/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateMatch } from "../src/validate";

describe("validateMatch", () => {
  it("requires Dato and Spiller", () => {
    expect(validateMatch({ Spiller: "Ida" })).toMatch(/dato/i);
    expect(validateMatch({ Dato: "2026-07-01" })).toMatch(/spiller/i);
  });
  it("rejects out-of-range scores", () => {
    expect(validateMatch({ Dato: "d", Spiller: "Ida", Point: 99 })).toMatch(/point/i);
    expect(validateMatch({ Dato: "d", Spiller: "Ida", Modstander_Point: -1 })).toMatch(/point/i);
  });
  it("rejects drink count < 1", () => {
    expect(validateMatch({ Dato: "d", Spiller: "Ida", drinks: [{ type: "Øl", count: 0 }] })).toMatch(/count/i);
  });
  it("accepts a valid match", () => {
    expect(validateMatch({ Dato: "d", Spiller: "Ida", Point: 13, Modstander_Point: 7, drinks: [{ type: "Øl", count: 2 }] })).toBeNull();
  });
});
