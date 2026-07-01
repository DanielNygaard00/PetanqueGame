import { describe, it, expect, beforeEach, vi } from "vitest";
import { api, setToken, TOKEN_KEY } from "./client";

describe("api client", () => {
  beforeEach(() => localStorage.clear());

  it("attaches the bearer token to requests", async () => {
    setToken("abc123");
    const cfg = await (api.interceptors.request as any).handlers[0].fulfilled({ headers: {} });
    expect(cfg.headers.Authorization).toBe("Bearer abc123");
  });

  it("clears token and redirects on 401", async () => {
    setToken("abc");
    const rejected = (api.interceptors.response as any).handlers[0].rejected;
    const redirect = vi.fn();
    Object.defineProperty(window, "location", { value: { assign: redirect, href: "" }, writable: true });
    await rejected({ response: { status: 401 } }).catch(() => {});
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
