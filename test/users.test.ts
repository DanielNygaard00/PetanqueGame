// test/users.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

async function token(username = "ida") {
  const res = await app.request("/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, code: "test-code" }),
  }, env);
  return (await res.json()).token as string;
}

beforeEach(async () => { await env.DB.exec("DELETE FROM users"); });

describe("users + guard", () => {
  it("401 without a token", async () => {
    const res = await app.request("/api/users", {}, env);
    expect(res.status).toBe(401);
  });

  it("403 with a bad token", async () => {
    const res = await app.request("/api/users", { headers: { authorization: "Bearer nope" } }, env);
    expect(res.status).toBe(403);
  });

  it("lists users as {id, name}", async () => {
    const t = await token("ida");
    const res = await app.request("/api/users", { headers: { authorization: `Bearer ${t}` } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe("ida");
  });
});
