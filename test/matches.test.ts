// test/matches.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM match_drinks");
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

describe("matches CRUD", () => {
  it("creates, lists, updates and deletes a match", async () => {
    const create = await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Vundet: true, Point: 13 }),
    }, env);
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.Vundet).toBe(true);
    const id = created.id;

    const list = await app.request("/api/matches", { headers: H() }, env);
    expect((await list.json()).length).toBe(1);

    const upd = await app.request(`/api/matches/${id}`, {
      method: "PUT", headers: H(), body: JSON.stringify({ Point: 7, Vundet: false }),
    }, env);
    expect(upd.status).toBe(200);
    expect((await upd.json()).Vundet).toBe(false);

    const del = await app.request(`/api/matches/${id}`, { method: "DELETE", headers: H() }, env);
    expect(del.status).toBe(200);
    const empty = await app.request("/api/matches", { headers: H() }, env);
    expect((await empty.json()).length).toBe(0);
  });

  it("creates a match with a drinks list and returns them nested", async () => {
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({
        Dato: "2026-07-01", Tid: "18:30", Spiller: "Ida", Vundet: true, Point: 13, Modstander_Point: 7,
        drinks: [{ type: "Øl", count: 3, volumeCl: 33 }, { type: "Vin", category: "Rosé", count: 1, volumeCl: 15 }],
      }),
    }, env);
    expect(res.status).toBe(201);
    const m = await res.json();
    expect(m.Tid).toBe("18:30");
    expect(m.Modstander_Point).toBe(7);
    expect(m.drinks).toHaveLength(2);
    expect(m.drinks[0]).toMatchObject({ type: "Øl", count: 3, volumeCl: 33 });

    const list = await app.request("/api/matches", { headers: H() }, env);
    const [row] = await list.json();
    expect(row.drinks).toHaveLength(2);
  });

  it("replaces drinks on update", async () => {
    const created = await (await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", drinks: [{ type: "Øl", count: 1 }] }),
    }, env)).json();
    const upd = await app.request(`/api/matches/${created.id}`, {
      method: "PUT", headers: H(),
      body: JSON.stringify({ Point: 11, drinks: [{ type: "Vin", count: 2 }] }),
    }, env);
    const m = await upd.json();
    expect(m.drinks).toHaveLength(1);
    expect(m.drinks[0].type).toBe("Vin");
  });

  it("400s an invalid match", async () => {
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(), body: JSON.stringify({ Spiller: "Ida" }),
    }, env);
    expect(res.status).toBe(400);
  });

  it("deletes a match and its drinks", async () => {
    const created = await (await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", drinks: [{ type: "Øl", count: 1 }] }),
    }, env)).json();
    await app.request(`/api/matches/${created.id}`, { method: "DELETE", headers: H() }, env);
    const remaining = await env.DB.prepare("SELECT COUNT(*) AS n FROM match_drinks WHERE match_id = ?").bind(created.id).first();
    expect(remaining.n).toBe(0);
  });

  it("registers Spiller and Modstander in the roster on create", async () => {
    await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Modstander: "Bo", Vundet: true }),
    }, env);
    const players = await (await app.request("/api/players", { headers: H() }, env)).json();
    const names = players.map((p: any) => p.name).sort();
    expect(names).toEqual(["Bo", "Ida"]);
  });
});
