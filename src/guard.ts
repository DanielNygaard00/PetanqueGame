// src/guard.ts
import { verify } from "hono/jwt";
import type { MiddlewareHandler } from "hono";
import type { AppContext } from "./types";

export const guard: MiddlewareHandler<AppContext> = async (c, next) => {
  const header = c.req.header("authorization");
  const bearer = header?.split(" ")[1];
  if (!bearer) return c.json({ message: "Authentication required" }, 401);
  try {
    const payload = await verify(bearer, c.env.JWT_SECRET, "HS256");
    c.set("userId", payload.userId as string);
    c.set("username", payload.username as string);
    await next();
  } catch {
    return c.json({ message: "Invalid or expired token" }, 403);
  }
};
