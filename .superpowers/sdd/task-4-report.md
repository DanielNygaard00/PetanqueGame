# Task 4 Report: Auth routes (signup, login)

## TDD Evidence

### RED — Failing test run

Test file written at `test/auth.test.ts`. First run (before `src/auth.ts` and mount existed):

```
Tests  4 failed (4)
FAIL  test/auth.test.ts > auth > signs up a new user and returns a token  → 404 expected 201
FAIL  test/auth.test.ts > auth > rejects duplicate usernames              → 404 expected 400
FAIL  test/auth.test.ts > auth > logs in with correct password            → 404 expected 200
FAIL  test/auth.test.ts > auth > rejects wrong password                   → 404 expected 401
```

All 404 — `/api/auth/*` not mounted, confirming genuine RED.

**Note on migration setup:** The brief stated "Workers test pool applies migrations automatically," but the starter `vitest.config.ts` had no migration wiring. Two changes were required to get migrations running:

1. `vitest.config.ts` updated to call `readD1Migrations("migrations")` at config-build time (Node context) and inject results via vitest's `provide`.
2. `test/auth.test.ts` uses `inject("d1Migrations")` + `applyD1Migrations(env.DB, migrations)` in `beforeAll`. This is the standard `@cloudflare/vitest-pool-workers` pattern for D1 in tests.

These additions are infrastructure, not new behavior; all four verbatim test assertions from the brief are preserved unchanged.

### GREEN — Passing test run

After writing `src/auth.ts` (verbatim from brief) and adding `app.route("/api/auth", auth)` to `src/index.ts`:

```
✓ test/auth.test.ts (4 tests) 408ms
Tests  4 passed (4)
```

## Full Suite Result

```
✓ test/auth.test.ts  (4 tests) 400ms
✓ test/mapping.test.ts (3 tests) 8ms

Test Files  2 passed (2)
Tests  7 passed (7)
```

No regressions.

## Files Changed

| File | Action | Notes |
|---|---|---|
| `src/auth.ts` | Created | Verbatim from brief — signup + login routes |
| `test/auth.test.ts` | Created | Verbatim assertions from brief + `beforeAll` migration setup |
| `src/index.ts` | Modified | Added `import auth from "./auth"` + `app.route("/api/auth", auth)` |
| `vitest.config.ts` | Modified | Added `readD1Migrations` + `provide: { d1Migrations }` for D1 test wiring |

## Self-Review

**Correctness**
- All 4 tests pass: signup 201 + token, duplicate 400, login 200 + token, wrong password 401.
- `bcrypt.hash(password ?? "", 10)` handles missing password gracefully.
- `bcrypt.compare` correctly rejects wrong passwords.
- JWT payload matches spec: `{ userId, username, exp: now + 24h }`, signed with `c.env.JWT_SECRET`.
- `crypto.randomUUID()` for IDs; ISO timestamps.

**Security**
- Passwords hashed with bcrypt cost 10 — appropriate for Workers (sync hashing would block; bcryptjs is async).
- Empty password allowed per spec (`password ?? ""`).
- Email deduplication only triggers when email is non-empty.

**Architecture**
- Mount is intentionally temporary per plan-mandated incremental wiring. Task 9 will replace the route table.
- `Hono<AppContext>` provides typed `c.env.DB` and `c.env.JWT_SECRET`.

---

## Fix: globalize D1 migration setup

### Files Changed

| File | Action | Notes |
|---|---|---|
| `test/apply-migrations.ts` | Created | Shared vitest setup file — calls `applyD1Migrations` once for all test files |
| `vitest.config.ts` | Modified | Added `setupFiles: ["./test/apply-migrations.ts"]` inside `test: { ... }` |
| `test/auth.test.ts` | Modified | Removed `beforeAll` block + unused imports (`applyD1Migrations`, `beforeAll`, `inject`) |

### Test suite result

Command: `npx vitest run`

```
 ✓ test/auth.test.ts (4 tests) 433ms
 ✓ test/mapping.test.ts (3 tests) 28ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  13:52:20
   Duration  2.45s (transform 78ms, setup 317ms, collect 32ms, tests 461ms, environment 0ms, prepare 456ms)
```

All 7 tests pass. No regressions.

### Concerns

None. The `provide.d1Migrations` entry in `vitest.config.ts` is retained — it is still required for `inject("d1Migrations")` inside the new setup file to resolve correctly.

---

## Concerns

1. **bcrypt cost factor 10 in Workers**: bcryptjs is pure JS and cost 10 is ~80–100ms per hash. This is acceptable for auth routes but should be revisited if latency SLOs tighten. Workers has a 10ms CPU time limit for free plans; this task is on a paid/workers plan so it's fine for now.

2. **Migration setup deviation from brief**: The brief said migrations apply automatically, but they did not with the starter config. The fix required modifying `vitest.config.ts` (a non-brief file). This is an infrastructure gap in the starter, not a bug in the implementation.

3. **`singleWorker: true` added to vitest config**: Required for `applyD1Migrations` to share state across test hooks. Without this, migrations applied in `beforeAll` of one worker instance wouldn't be visible to tests running in another.
