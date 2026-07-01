// src/index.ts
import { Hono } from "hono";
import auth from "./auth";
import { guard } from "./guard";
import users from "./users";
import matches from "./matches";
import options from "./options";
import exportRoute from "./export";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/auth", auth);
app.use("/api/users", guard);
app.use("/api/users/*", guard);
app.route("/api/users", users);
app.use("/api/matches", guard);
app.use("/api/matches/*", guard);
app.route("/api/matches", matches);
app.use("/api/options", guard);
app.use("/api/options/*", guard);
app.route("/api/options", options);
app.use("/api/export", guard);
app.route("/api/export", exportRoute);

export default app;
