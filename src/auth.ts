// src/auth.ts
import { Hono } from "hono";
import { sign } from "hono/jwt";
import bcrypt from "bcryptjs";
import type { AppContext } from "./types";

const auth = new Hono<AppContext>();

auth.post("/signup", async (c) => {
  const { username, password, email } = await c.req.json().catch(() => ({}));
  if (!username) return c.json({ message: "Username required" }, 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username).first();
  if (existing) return c.json({ message: "Username already exists" }, 400);

  const sanitizedEmail = typeof email === "string" && email.trim() !== "" ? email : "";
  if (sanitizedEmail) {
    const emailTaken = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(sanitizedEmail).first();
    if (emailTaken) return c.json({ message: "Email already exists" }, 400);
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password ?? "", 10);
  await c.env.DB.prepare(
    "INSERT INTO users (id, username, password_hash, email, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, username, passwordHash, sanitizedEmail, new Date().toISOString()).run();

  const token = await sign(
    { userId: id, username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
    c.env.JWT_SECRET,
  );
  return c.json({ token, user: { id, username } }, 201);
});

auth.post("/login", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  if (!username) return c.json({ message: "Username required" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT id, username, password_hash FROM users WHERE username = ?",
  ).bind(username).first<{ id: string; username: string; password_hash: string }>();

  if (!user || !(await bcrypt.compare(password ?? "", user.password_hash))) {
    return c.json({ message: "Invalid username or password" }, 401);
  }

  const token = await sign(
    { userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
    c.env.JWT_SECRET,
  );
  return c.json({ token, user: { id: user.id, username: user.username } });
});

export default auth;
