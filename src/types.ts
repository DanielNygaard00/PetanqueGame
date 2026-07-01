// src/types.ts
export type Env = { DB: D1Database; JWT_SECRET: string; ASSETS: Fetcher };
export type AppContext = {
  Bindings: Env;
  Variables: { userId: string; username: string };
};
