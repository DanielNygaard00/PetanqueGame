// src/index.ts
import { Hono } from "hono";
import auth from "./auth";
import { guard } from "./guard";
import users from "./users";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/auth", auth);
app.use("/api/users", guard);
app.use("/api/users/*", guard);
app.route("/api/users", users);

export default app;
