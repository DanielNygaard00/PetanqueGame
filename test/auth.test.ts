// test/auth.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";

async function post(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, env);
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM users");
});

describe("auth", () => {
  it("signs up a new user and returns a token", async () => {
    const res = await post("/api/auth/signup", { username: "ida", password: "pw" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.username).toBe("ida");
  });

  it("rejects duplicate usernames", async () => {
    await post("/api/auth/signup", { username: "ida" });
    const res = await post("/api/auth/signup", { username: "ida" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct password", async () => {
    await post("/api/auth/signup", { username: "ida", password: "pw" });
    const res = await post("/api/auth/login", { username: "ida", password: "pw" });
    expect(res.status).toBe(200);
    expect((await res.json()).token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    await post("/api/auth/signup", { username: "ida", password: "pw" });
    const res = await post("/api/auth/login", { username: "ida", password: "nope" });
    expect(res.status).toBe(401);
  });
});
