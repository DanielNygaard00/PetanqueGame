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
  it("exports tidy long format: one row per match x drink with new columns", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({
        Dato: "2026-07-01", Tid: "18:30", Spiller: "Ida", Vundet: true, Point: 13, Modstander_Point: 7,
        drinks: [{ type: "Øl", count: 3, volumeCl: 33 }, { type: "Vin", category: "Rosé", count: 1 }],
      }),
    }, env);
    const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).trim().split("\r\n");
    expect(lines[0]).toContain("Modstander_Point");
    expect(lines[0]).toContain("Margin");
    expect(lines[0]).toContain("Antal");
    expect(lines[0]).toContain("Volumen_cl");
    // two drinks -> two data rows
    expect(lines).toHaveLength(3);
    // margin = 13 - 7 = 6 present on the rows
    expect(lines[1]).toContain(",6,");
  });

  it("emits one row for a match with no drinks", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ Dato: "2026-07-02", Spiller: "Bo" }),
    }, env);
    const res = await app.request("/api/export", { headers: { authorization: auth } }, env);
    const lines = (await res.text()).slice(1).trim().split("\r\n");
    expect(lines.length).toBe(2); // header + one row
  });
});
