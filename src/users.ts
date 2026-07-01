// src/users.ts
import { Hono } from "hono";
import type { AppContext } from "./types";

const users = new Hono<AppContext>();

users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, username FROM users").all();
  return c.json(results.map((r: any) => ({ id: r.id, name: r.username })));
});

export default users;
