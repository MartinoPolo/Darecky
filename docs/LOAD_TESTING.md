# Load Testing Runbook

Repeatable capacity tests for the expected workloads (issue #110): 10 concurrent users as a
sustained interactive workload, 100 concurrent users as a bounded burst, plus reservation-contention
correctness.

The harness lives in `tests/load/` and talks to the app **exactly like a browser**: SSR page loads
and SvelteKit remote-function calls with cookies (better-auth sessions, anonymous-visitor cookies).
Direct DB access is used only for fixtures, statement counts, and integrity verification.

## Scenarios (REQ-3)

| Scenario                         | What it does                                                            |
| -------------------------------- | ----------------------------------------------------------------------- |
| `page:anonymous-view`            | Anonymous SSR load of the shared arena wishlist `/w/loadtest-arena`     |
| `page:authed-view`               | The same page with a logged-in loadtest account (also exercises follow) |
| `command:createGift`             | `createGift` on the VU's own draft wishlist                             |
| `command:reserveGift-distinct`   | Each VU reserves (then releases) its **own** single-unit gift           |
| `command:reserveGift-contention` | All VUs race for the final unit of **one** gift — exactly one must win  |

## Profiles (REQ-4)

| Profile        | Shape                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `smoke`        | 2 VUs, one pass through every scenario — endpoint sanity                                          |
| `sustained-10` | 10 VUs, mixed interactive loop with think time (default 120 s)                                    |
| `burst-100`    | 100 VUs, bounded burst: view + distinct reserve/release + creates, then a 100-way contention race |
| `contention`   | Pure final-unit race (default 10 VUs)                                                             |

## Reports (REQ-5)

Each run writes `tests/load/reports/<timestamp>-<profile>.{json,md}` (gitignored) containing:
p50/p95/p99/max latency per operation, dynamic request count, DB statement count (pg_stat_statements
delta), HTTP 4xx/5xx, Cloudflare Worker resource-limit outcomes (error codes **1102**/**1027**
parsed from error bodies), reservation-integrity results (over-reservation query + contention
winners), and a pass/fail verdict. The runner exits non-zero when acceptance fails.

## Data isolation (REQ-6)

Fixtures are dedicated rows: `loadtest-` prefixed ids, `@loadtest.invalid` emails (undeliverable by
definition), a dedicated arena wishlist, and per-VU wishlists. Rows the app creates during a run
(reservations, sessions, follows, notifications, created gifts) are identified through their FKs to
loadtest rows. `pnpm loadtest:cleanup` deletes **only** these and cannot touch real user rows.

## Running locally

```bash
pnpm db:start            # local Postgres (compose enables pg_stat_statements)
pnpm db:migrate          # schema (or db:push for a dev-iterated DB)
pnpm loadtest:setup      # idempotent fixtures (100 VU accounts + arena)
pnpm run dev             # in a second terminal; open the MPX-assigned localhost app URL

pnpm loadtest --profile smoke
pnpm loadtest --profile sustained-10 --duration 120
pnpm loadtest --profile burst-100
pnpm loadtest --profile contention

pnpm loadtest:cleanup    # remove all loadtest rows
```

Use the MPX-assigned app URL on `localhost`. For a non-default checkout or worktree, pass that exact
URL to the load test, for example:

```bash
pnpm loadtest --url http://localhost:8405 --profile smoke
```

On an existing container created before the compose change, enable statement counts once with:

```bash
docker exec <db-container> psql -U root -d local -c "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';"
docker restart <db-container>
```

(Without it, reports show `DB statements: n/a` and everything else still works.)

## Running against a preview (Workers runtime)

```powershell
pnpm run build
pnpm run preview         # wrangler dev on :4173, local bindings
pnpm loadtest --target preview --profile smoke
```

`ORIGIN` must match the target origin for logins to succeed (better-auth rejects mismatched origins
outside the dev trusted list).

## Running against production — explicit authorization only (AC-8)

A production run touches the live Worker, live Neon, and free-tier quotas (100k req/day Workers; the
burst profile issues ~500 dynamic requests, logins count toward better-auth rate limits). It is
disabled unless **both** guards are provided:

```powershell
$env:LOADTEST_ALLOW_PRODUCTION = "I_UNDERSTAND_THIS_RUNS_AGAINST_PRODUCTION"
# Optional but recommended — Neon *direct* URL, enables fixtures/integrity/statement metrics:
$env:LOADTEST_DATABASE_URL = "postgresql://USER:PASS@HOST/db?sslmode=require"

pnpm loadtest:setup      # fixtures on the production DB (loadtest- rows only)
pnpm loadtest --target production --allow-production --profile sustained-10
pnpm loadtest:cleanup    # ALWAYS clean up afterwards
```

Notes for production runs:

- Fixture setup/cleanup refuse non-local databases without the env guard; the runner refuses
  non-local URLs without `--allow-production` **and** the env.
- Without `LOADTEST_DATABASE_URL`, DB-dependent features (fixtures reset, statement counts,
  integrity queries) are skipped and the report says so — client-observed contention correctness
  still verifies.
- Statement counts include every client of the database; run when otherwise idle for meaningful
  numbers.
- better-auth rate-limits sign-in in production; the harness staggers logins (5 at a time, retries)
  — prefer `sustained-10` over `burst-100` there.

## Acceptance mapping (issue #110)

- **10-user scenario, zero 5xx/1102/1027/integrity errors** → `sustained-10` verdict.
- **100-user burst, zero over-reservation + percentile/request/statement report** → `burst-100`
  verdict + report file.
- **Exactly one successful reservation under contention** → `contention` / burst phase B verdict
  (client-observed successes + DB active-reservation count).
- **Cleanup without touching real rows** → `loadtest:cleanup` (prefix/FK scoped).
