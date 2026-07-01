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
});
