// test/players.test.ts
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

describe("players roster", () => {
  it("upserts and dedupes case-insensitively", async () => {
    const a = await (await app.request("/api/players", { method: "POST", headers: H(), body: JSON.stringify({ name: "Ida" }) }, env)).json();
    const b = await (await app.request("/api/players", { method: "POST", headers: H(), body: JSON.stringify({ name: " ida " }) }, env)).json();
    expect(b.id).toBe(a.id);
    const list = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(list).toHaveLength(1);
  });

  it("lists players with game counts", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Ida", Modstander: "Bo", Vundet: true }) }, env);
    const list = await (await app.request("/api/players", { headers: H() }, env)).json();
    const ida = list.find((p: any) => p.name === "Ida");
    const bo = list.find((p: any) => p.name === "Bo");
    expect(ida.games).toBe(1);
    expect(bo.games).toBe(1);
  });

  it("renames a player and rewrites matches", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Bob", Modstander: "Ida", Vundet: false }) }, env);
    const list = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bob = list.find((p: any) => p.name === "Bob");
    await app.request(`/api/players/${bob.id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ name: "Bo" }) }, env);
    const matches = await (await app.request("/api/matches", { headers: H() }, env)).json();
    expect(matches[0].Spiller).toBe("Bo");
  });

  it("merges one player into another", async () => {
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-01", Spiller: "Bob", Modstander: "Ida", Vundet: true }) }, env);
    await app.request("/api/matches", { method: "POST", headers: H(), body: JSON.stringify({ Dato: "2026-07-02", Spiller: "Bo", Modstander: "Ida", Vundet: true }) }, env);
    let list = await (await app.request("/api/players", { headers: H() }, env)).json();
    const bob = list.find((p: any) => p.name === "Bob");
    const bo = list.find((p: any) => p.name === "Bo");
    await app.request(`/api/players/${bob.id}/merge`, { method: "POST", headers: H(), body: JSON.stringify({ intoId: bo.id }) }, env);
    list = await (await app.request("/api/players", { headers: H() }, env)).json();
    expect(list.find((p: any) => p.name === "Bob")).toBeUndefined();
    expect(list.find((p: any) => p.name === "Bo").games).toBe(2);
  });
});
