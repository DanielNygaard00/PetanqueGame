# PétanqueGame

Cloudflare Worker (Hono) API + D1 (SQLite), serving a Vite/React SPA.

## Local development

```bash
npm install
npm run db:migrate:local        # applies migrations to a local SQLite D1
npm run dev                     # wrangler dev on http://localhost:8787
npm test                        # backend (Workers pool) tests — test/**/*.test.ts only
cd client && npm test           # frontend (jsdom) tests — client/src/**/*.test.tsx
```

## First-time Cloudflare setup

```bash
npx wrangler login
npx wrangler d1 create petanque            # copy the printed database_id into wrangler.toml
npm run db:migrate:remote                  # apply schema to the remote D1
npx wrangler secret put JWT_SECRET         # set a strong secret (do NOT rely on [vars])
```

## Deploy (free tier)

```bash
# build the frontend first (see client/ plan) so client/dist exists
npm run deploy                             # wrangler deploy — API + SPA in one Worker
```
