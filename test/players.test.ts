// test/players.test.ts
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

async function logMatch(a: string, b: string) {
  return (await app.request("/api/matches", {
    method: "POST", headers: H(),
    body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: [a] }, { score: 5, players: [b] }] }),
  }, env)).json();
}

describe("players", () => {
  it("counts games from match_players", async () => {
    await logMatch("Ida", "Bo");
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bo = players.find((p: any) => p.name === "Bo");
    expect(bo.games).toBe(1);
  });

  it("renames a player and match_players follow via id", async () => {
    await logMatch("Ida", "Bo");
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bo = players.find((p: any) => p.name === "Bo");
    await app.request(`/api/players/${bo.id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ name: "Bob" }) }, env);
    const after = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(after.find((p: any) => p.name === "Bob").games).toBe(1);
    expect(after.some((p: any) => p.name === "Bo")).toBe(false);
  });

  it("merges two players, repointing participants and drinks", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Ras"] }],
        drinks: [{ type: "Øl", count: 1, player: "Ras" }] }),
    }, env);
    await logMatch("Ida", "Rasmus");
    let players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const ras = players.find((p: any) => p.name === "Ras");
    const rasmus = players.find((p: any) => p.name === "Rasmus");
    await app.request(`/api/players/${ras.id}/merge`, { method: "POST", headers: H(), body: JSON.stringify({ intoId: rasmus.id }) }, env);
    players = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(players.some((p: any) => p.name === "Ras")).toBe(false);
    expect(players.find((p: any) => p.name === "Rasmus").games).toBe(2);
    const drink = await env.DB.prepare("SELECT player_id FROM match_drinks LIMIT 1").first<{ player_id: string }>();
    expect(drink!.player_id).toBe(rasmus.id);
  });

  it("deduplicates same-match rows when merging — games count is 1, not 2", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", teams: [{ score: 13, players: ["Ras"] }, { score: 5, players: ["Rasmus"] }] }),
    }, env);
    let players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const ras = players.find((p: any) => p.name === "Ras");
    const rasmus = players.find((p: any) => p.name === "Rasmus");
    await app.request(`/api/players/${ras.id}/merge`, { method: "POST", headers: H(), body: JSON.stringify({ intoId: rasmus.id }) }, env);
    players = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(players.find((p: any) => p.name === "Rasmus").games).toBe(1);
  });
});
