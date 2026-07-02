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
