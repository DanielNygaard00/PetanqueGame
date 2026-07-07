// test/options.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

let auth = "";
beforeEach(async () => {
  await env.DB.exec("DELETE FROM options");
  await env.DB.exec("DELETE FROM users");
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ida", code: "test-code" }),
  }, env);
  auth = `Bearer ${(await res.json()).token}`;
});
const H = () => ({ authorization: auth, "content-type": "application/json" });

describe("options", () => {
  it("adds and lists options in a collection", async () => {
    const add = await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Kongens Have" }),
    }, env);
    expect(add.status).toBe(201);
    const list = await app.request("/api/options/arenas", { headers: H() }, env);
    expect((await list.json())[0].name).toBe("Kongens Have");
  });

  it("does not create case/whitespace duplicates", async () => {
    const a = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Kongens Have" }),
    }, env)).json();
    const b = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "  kongens have " }),
    }, env)).json();
    expect(b.id).toBe(a.id);
    const list = await (await app.request("/api/options/arenas", { headers: H() }, env)).json();
    expect(list).toHaveLength(1);
  });

  it("dedupes Danish/accented names across case", async () => {
    const a = await (await app.request("/api/options/drink_types", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Øl" }),
    }, env)).json();
    const b = await (await app.request("/api/options/drink_types", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "øl" }),
    }, env)).json();
    expect(b.id).toBe(a.id);
    const list = await (await app.request("/api/options/drink_types", { headers: H() }, env)).json();
    expect(list).toHaveLength(1);
  });

  async function seedMatchWithArenaAndBeer() {
    // Creates a decided match at "Parken" where "A" drank one Øl.
    const res = await app.request("/api/matches", {
      method: "POST", headers: H(),
      body: JSON.stringify({
        Dato: "2026-07-01",
        Arena: "Parken",
        teams: [{ score: 13, players: ["A"] }, { score: 5, players: ["B"] }],
        drinks: [{ type: "Øl", count: 1, player: "A" }],
      }),
    }, env);
    expect(res.status).toBe(201);
  }

  it("reports usage counts in the list", async () => {
    await seedMatchWithArenaAndBeer();
    const opt = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Parken" }),
    }, env)).json();
    const list = await (await app.request("/api/options/arenas", { headers: H() }, env)).json();
    expect(list.find((o: { id: string }) => o.id === opt.id).uses).toBe(1);
  });

  it("renames an option and cascades into historical matches", async () => {
    await seedMatchWithArenaAndBeer();
    const opt = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Parken" }),
    }, env)).json();
    const res = await app.request(`/api/options/arenas/${opt.id}`, {
      method: "PATCH", headers: H(), body: JSON.stringify({ name: "Kongens Have" }),
    }, env);
    expect(res.status).toBe(200);
    const matches = await (await app.request("/api/matches", { headers: H() }, env)).json();
    expect(matches[0].Arena).toBe("Kongens Have");
  });

  it("cascades drink-type renames into match_drinks", async () => {
    await seedMatchWithArenaAndBeer();
    const opt = await (await app.request("/api/options/drink_types", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Øl" }),
    }, env)).json();
    await app.request(`/api/options/drink_types/${opt.id}`, {
      method: "PATCH", headers: H(), body: JSON.stringify({ name: "Pilsner" }),
    }, env);
    const matches = await (await app.request("/api/matches", { headers: H() }, env)).json();
    expect(matches[0].drinks[0].type).toBe("Pilsner");
  });

  it("merges on case-insensitive rename collision", async () => {
    const a = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Parken" }),
    }, env)).json();
    const b = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Havnen" }),
    }, env)).json();
    const res = await app.request(`/api/options/arenas/${b.id}`, {
      method: "PATCH", headers: H(), body: JSON.stringify({ name: "  parken " }),
    }, env);
    expect((await res.json()).id).toBe(a.id);
    const list = await (await app.request("/api/options/arenas", { headers: H() }, env)).json();
    expect(list).toHaveLength(1);
  });

  it("PATCH validates name and id", async () => {
    const opt = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Parken" }),
    }, env)).json();
    const empty = await app.request(`/api/options/arenas/${opt.id}`, {
      method: "PATCH", headers: H(), body: JSON.stringify({ name: "  " }),
    }, env);
    expect(empty.status).toBe(400);
    const missing = await app.request("/api/options/arenas/nope", {
      method: "PATCH", headers: H(), body: JSON.stringify({ name: "X" }),
    }, env);
    expect(missing.status).toBe(404);
  });

  it("deletes an option but keeps historical match text", async () => {
    await seedMatchWithArenaAndBeer();
    const opt = await (await app.request("/api/options/arenas", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Parken" }),
    }, env)).json();
    const res = await app.request(`/api/options/arenas/${opt.id}`, { method: "DELETE", headers: H() }, env);
    expect(res.status).toBe(200);
    const list = await (await app.request("/api/options/arenas", { headers: H() }, env)).json();
    expect(list).toHaveLength(0);
    const matches = await (await app.request("/api/matches", { headers: H() }, env)).json();
    expect(matches[0].Arena).toBe("Parken");
  });

  it("DELETE 404s on unknown id", async () => {
    const res = await app.request("/api/options/arenas/nope", { method: "DELETE", headers: H() }, env);
    expect(res.status).toBe(404);
  });

  it("returns the drink hierarchy shape", async () => {
    await app.request("/api/options/drink_types", {
      method: "POST", headers: H(), body: JSON.stringify({ name: "Vin" }),
    }, env);
    const res = await app.request("/api/options/drinks/hierarchy", { headers: H() }, env);
    const body = await res.json();
    expect(Array.isArray(body.types)).toBe(true);
    expect(body.types[0].name).toBe("Vin");
    expect(body).toHaveProperty("categories");
    expect(body).toHaveProperty("brands");
    expect(body).toHaveProperty("names");
  });
});
