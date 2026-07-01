// src/index.ts
import { Hono } from "hono";
import auth from "./auth";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/auth", auth);

export default app;
