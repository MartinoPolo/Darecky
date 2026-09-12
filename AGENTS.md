# Project Instructions

- App is in production (prejemesi.cz) with real user data. Preserve data integrity: avoid
  destructive schema operations, and migrate existing rows rather than dropping or recreating
  tables. Code may still be freely refactored, but breaking schema/API changes need a migration
  plan.
- Before implementation, read `.mpx/CONTEXT.md` (domain language, feature index, constraints) and
  `.mpx/DECISIONS.md` (settled architectural choices).
- Always fix unrelated errors you encounter (merge artifacts, stale imports, broken references,
  prior bugs) — they accumulate if ignored. Commit fixes separately from main work. If a fix fails
  after two attempts, revert and continue with the main task. Always notify user — both for fixes
  made and problems left unresolved.
- Prefer targeted shell reads: `rg -l`, path-scoped `rg`, `git diff --stat`, and
  `git diff -- <files>`. Inspect a full log only when the tail does not identify the failure.
- Use sub-agents for broad or third-party exploration when explicitly requested or already required
  by these instructions. Ask them for concise findings and file paths, not full command output.

## Stack

- SvelteKit + Vite
- TypeScript (strict)
- Tailwind CSS
- Drizzle ORM (PostgreSQL, strict mode)
- Vitest + Playwright

## Nested Corner Geometry

For an equal inset inside a bordered rounded parent, use
`inner radius = max(0, parent outer radius - border thickness - padding)` so the curves remain
parallel; this is the W3C padding/content-edge derivation and is equivalent to Cloud Four’s
`outerRadius - gap = innerRadius` rule
([W3C CSS Backgrounds §4.2](https://www.w3.org/TR/css-backgrounds-3/#corner-shaping),
[Paul Hebert, Cloud Four](https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/)).
For unequal horizontal and vertical insets, calculate the two radii independently instead of forcing
one radius. Treat shadow clearance separately from the geometric inset because a shadow does not
change the element’s box. Keep the actionable hit target distinct from the visible nested surface so
accessible target size does not distort the corner geometry.

## Cloned OSS Repositories

When debugging or analyzing issues related to third-party libraries, delegate exploration to a
sub-agent pointing at the cloned source in `C:\_MP_github_cloned\` **Available**: svelte
(+sveltekit), bits-ui, shadcn-svelte, storybook, fallow, lucide, tailwindcss

## Testing

- When writing tests, always derive expected behavior from requirements (GitHub issue descriptions
  and comments, `DECISIONS.md`, `CONTEXT.md`, or other docs) — never adapt tests to match the
  implementation. If a test reveals a bug, report it to the user or fix it immediately.

## Visual / Browser Testing

- Chrome DevTools MCP and Playwright MCP are unreliable in this project (they routinely fail to
  connect — the plugin pins a `chrome-devtools-mcp` version blocked by the global npm `before`
  time-pin, and Playwright MCP isn't registered here). Do NOT burn time trying to (re)connect them.
- **Default to raw Playwright** via the project's own installed `playwright` dependency — it has no
  MCP layer, so it works in every session:
    - Quick screenshot / crawl / click:
      `node scripts/shot.mjs <route> [--user martin|jana|petr|eva|tomas] [--mobile] [--dark] [--full] [--wait <sel>]`.
      Prints the PNG path; Read it back to view. Run from **PowerShell** (Git Bash mangles
      leading-slash args; from Bash prefix `MSYS_NO_PATHCONV=1`).
    - Repeatable verification: a `tests/e2e/*.spec.ts` with `@playwright/test`, reusing
      `tests/e2e/fixtures/{auth,wishlist}-helpers.ts`.
- Prereqs: dev server (`pnpm run dev`) + seeded DB (`pnpm db:seed`). Authed routes are under the
  `(app)` group: `/my-lists`, `/followed`, `/moderated`, `/settings`, `/w/<id>`.
- Prefer explicit `waitForSelector` over `waitUntil: 'networkidle'` (networkidle hangs on
  SSE/long-poll surfaces).

## Commands

- On Windows, use `pnpm.cmd` for package commands. Corepack's pnpm store lives outside the
  workspace, so package commands may need sandbox escalation.
- `pnpm run dev` -- dev server
- `pnpm run check` -- typecheck
- `pnpm run check:all` -- full check suite (format + lint + typecheck + stylelint + fallow +
  migration safety + vykání)
- `pnpm run check:vykani` -- fails if Czech copy slips into tykání (informal address); see
  `scripts/check_vykani.mjs`
- `pnpm run test` -- all client, server, and Storybook unit tests
- `pnpm exec vitest run --project server` -- server unit tests only
- `pnpm run test:e2e` -- E2E tests
- `pnpm run db:seed` -- populate DB with test data (idempotent, safe to re-run)
- `pnpm loadtest --profile smoke|sustained-10|burst-100|contention` -- load tests (fixtures:
  `pnpm loadtest:setup` / `pnpm loadtest:cleanup`; runbook: `docs/LOAD_TESTING.md`)

## Deployment

- Production deploys are gated: push to `production` → checks for the exact SHA → GitHub
  `production` environment approval → `wrangler deploy`. Schema changes follow expand → migrate →
  deploy → contract, enforced by `pnpm check:migrations`. Runbook: `docs/DEPLOYMENT.md`.

## Git Workflow

- Branch model: feature PRs → `dev` (default branch); releases via PR `dev` → `production` (merge
  auto-deploys). `master` was deleted — do not recreate. `production` enforces the `checks` gate for
  admins too, so a red `dev` CI blocks releases.
- For verified branch-delete-only pushes, use `git push --no-verify origin --delete ...` unless the
  user explicitly wants hooks run.

## Database

- Drizzle with `strict: true` -- always enabled to prevent data loss on renames.
- Use file-based migrations (`pnpm db:migrate` locally). Before every production deployment, run
  `pnpm db:verify:prod`; if PENDING migrations are reviewed and explicitly authorized, run
  `pnpm db:migrate:prod -- --yes`, then verify again and require EXACT. DRIFT blocks migration and
  deployment. `drizzle-kit push` is never used in production.
- Schema in `src/lib/server/db/schema.ts`
- Seed script: `src/lib/server/db/seed.ts` — run `pnpm db:seed` to populate test data.

### Test Accounts (shared sign-in value: `SEED_PASSWORD` in seed.ts)

Two most-used personas below (recipient + gifter). For the full roster (jana/eva/tomas), fixture
layout, and which UI states each exercises, read `src/lib/server/db/seed.ts` — seed IDs are prefixed
`seed-`.

| Email          | Name         | Role                                                    |
| -------------- | ------------ | ------------------------------------------------------- |
| martin@test.cz | Martin Novák | Primary recipient — owns self-lists + for-someone lists |
| petr@test.cz   | Petr Svoboda | Active gifter — many reservations                       |
