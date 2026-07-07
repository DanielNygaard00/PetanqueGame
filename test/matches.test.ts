// test/matches.test.ts
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

const twoTeam = {
  Dato: "2026-07-01", Tid: "18:30",
  teams: [{ score: 13, players: ["Ida"] }, { score: 7, players: ["Bo"] }],
};

describe("matches CRUD (participants)", () => {
  it("creates a match with teams and derives the winner", async () => {
    const res = await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify(twoTeam) }, env);
    expect(res.status).toBe(201);
    const m = await res.json();
    expect(m.teams).toHaveLength(2);
    expect(m.teams[0]).toMatchObject({ team: 0, score: 13, won: true });
    expect(m.teams[0].players[0].name).toBe("Ida");
    expect(m.teams[1].won).toBe(false);
  });

  it("supports N-way games and drink attribution", async () => {
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({
        Dato: "2026-07-02",
        teams: [{ score: 11, players: ["Ida"] }, { score: 5, players: ["Bo"] }, { score: 0, players: ["Cy"] }],
        drinks: [{ type: "Øl", count: 1, player: "Ida" }, { type: "Øl", count: 1 }],
      }),
    }, env);
    expect(res.status).toBe(201);
    const m = await res.json();
    expect(m.teams).toHaveLength(3);
    expect(m.teams[0].won).toBe(true);
    expect(m.drinks[0].player).toBe("Ida");
    expect(m.drinks[1].player).toBeNull();
  });

  it("registers all participants in the roster", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify(twoTeam) }, env);
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(players.map((p: any) => p.name).sort()).toEqual(["Bo", "Ida"]);
  });

  it("updates teams and drinks, then deletes with cascade", async () => {
    const created = await (await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify(twoTeam) }, env)).json();
    const upd = await app.request(`/api/matches/${created.id}`, {
      method: "PUT", headers: H(),
      body: JSON.stringify({ teams: [{ score: 3, players: ["Ida"] }, { score: 13, players: ["Bo"] }] }),
    }, env);
    const m = await upd.json();
    expect(m.teams[1].won).toBe(true);

    await app.request(`/api/matches/${created.id}`, { method: "DELETE", headers: H() }, env);
    const mp = await env.DB.prepare("SELECT COUNT(*) AS n FROM match_players WHERE match_id = ?").bind(created.id).first();
    expect(mp.n).toBe(0);
  });

  it("400s a match with fewer than two teams", async () => {
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", teams: [{ players: ["Ida"] }] }),
    }, env);
    expect(res.status).toBe(400);
  });

  it("404s PUT on unknown match id", async () => {
    const fakeId = crypto.randomUUID();
    const res = await app.request(`/api/matches/${fakeId}`, {
      method: "PUT", headers: H(),
      body: JSON.stringify({ teams: [{ score: 13, players: ["Ida"] }, { score: 7, players: ["Bo"] }] }),
    }, env);
    expect(res.status).toBe(404);
  });
});
