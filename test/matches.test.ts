// test/matches.test.ts
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
});
