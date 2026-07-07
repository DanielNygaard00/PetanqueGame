// test/app.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("app wiring", () => {
  it("serves /health", async () => {
    const res = await app.request("/health", {}, env);
    expect(await res.json()).toEqual({ status: "ok" });
  });
  it("sends CORS headers", async () => {
    const res = await app.request("/api/matches", { headers: { origin: "http://localhost:5173" } }, env);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });
  it("guards protected api routes", async () => {
    const res = await app.request("/api/matches", {}, env);
    expect(res.status).toBe(401);
  });
  it("returns JSON 404 for unknown /api/* paths", async () => {
    const res = await app.request("/api/does-not-exist", {}, env);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ message: "Not found" });
  });
  it("returns 404 JSON for PUT to unknown match id", async () => {
    // Sign up to get a valid token
    const signupRes = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "errtest_user", password: "pw", code: "test-code" }),
    }, env);
    const { token } = await signupRes.json();

    // PUT to a non-existent match id — now returns 404 before touching any participants.
    const res = await app.request("/api/matches/does-not-exist", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ Spiller: "test" }),
    }, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Not found" });
  });
});
