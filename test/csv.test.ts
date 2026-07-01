// test/csv.test.ts
import { describe, it, expect } from "vitest";
import { toCsv } from "../src/csv";

describe("toCsv", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    const out = toCsv(["a", "b"], [["x,y", 'he said "hi"']]);
    expect(out).toBe('a,b\r\n"x,y","he said ""hi"""\r\n');
  });
});
