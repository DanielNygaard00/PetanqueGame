// test/export.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM match_drinks");
  await env.DB.exec("DELETE FROM match_players");
  await env.DB.exec("DELETE FROM matches");
  await env.DB.exec("DELETE FROM players");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Ida", code: "test-code" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

describe("export", () => {
  it("exports one row per participant with opponents and drinks", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Bo"] }],
        drinks: [{ name: "Grøn", count: 2, player: "Ida" }] }),
    }, env);
    const res = await app.request("/api/export", { headers: H() }, env);
    const csv = await res.text();
    expect(csv).toContain("Dato,Tid,Arena,Hold,Spiller,Point,Vundet,Modstandere,Konsekutive spil,Spillets genstande,Drikke");
    expect(csv).toContain("Ida");
    const idaRow = csv.split("\r\n").find((line) => line.startsWith("2026-07-01") && line.includes("Ida"))!;
    expect(idaRow).toContain("Bo");
    expect(csv).toContain("2× Grøn");
  });
});
