// test/export.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ida" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});

describe("export", () => {
  it("returns BOM-prefixed CSV with the 16 Danish headers", async () => {
    await app.request("/api/matches", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Point: 13 }),
    }, env);
    const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("petanque_data.csv");
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("Dato,");
    expect(text).toContain("Spillets genstande");
  });

  it("renders Vundet as 1 for won and empty string for lost (legacy CSV format)", async () => {
    // POST a won match (2026-07-01) and a lost match (2026-07-02)
    await app.request("/api/matches", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Vundet: true, Point: 13 }),
    }, env);
    await app.request("/api/matches", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ Dato: "2026-07-02", Spiller: "Ida", Vundet: false, Point: 7 }),
    }, env);

    const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
    const raw = await res.text();

    // Strip BOM, split on CRLF, drop empty trailing lines
    const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
    const lines = text.split("\r\n").filter((l) => l.length > 0);

    // Find Vundet column index from header row
    const headers = lines[0].split(",");
    const vundedIdx = headers.indexOf("Vundet");
    expect(vundedIdx).toBeGreaterThanOrEqual(0);

    // export orders by date ASC: won match is row 0, lost match is row 1
    const wonRow = lines[1].split(",");
    const lostRow = lines[2].split(",");

    expect(wonRow[vundedIdx]).toBe("1");
    expect(lostRow[vundedIdx]).toBe("");
  });
});
