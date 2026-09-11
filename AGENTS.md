# Project Instructions

- App is in production (prejemesi.cz) with real user data. Preserve data integrity: avoid destructive schema operations, and migrate existing rows rather than dropping or recreating tables. Code may still be freely refactored, but breaking schema/API changes need a migration plan.
- Before implementation, read `.mpx/CONTEXT.md` and `.mpx/DECISIONS.md`.
- Always fix unrelated errors you encounter (merge artifacts, stale imports, broken references, prior bugs) — they accumulate if ignored. Commit fixes separately from main work. If a fix fails after two attempts, revert and continue with the main task. Always notify user — both for fixes made and problems left unresolved.
- Prefer targeted shell reads: `rg -l`, path-scoped `rg`, `git diff --stat`, and `git diff -- <files>`.
  Inspect a full log only when the tail does not identify the failure.
- Use sub-agents for broad or third-party exploration when explicitly requested or already required by these instructions. Ask them for concise findings and file paths, not full command output.

## Stack

- SvelteKit + Vite
- TypeScript (strict)
- Tailwind CSS
- Drizzle ORM (PostgreSQL, strict mode)
- Vitest + Playwright

## Component Reuse

- Follow the component tiers: `src/lib/components/base/` contains managed primitives. Reusable wrappers in `src/lib/components/derived/`. Feature composition in `src/lib/components/blocks/`.
- Before using or extending a component, read its local API, variants, and stories. Local contracts take precedence over generic shadcn examples (for example, `Button` uses `intent`, not `variant`).
- Reuse an existing variant first. If a shared presentation is genuinely missing, add a justified derived component or variant rather than inventing appearance per caller with radius, height, shadow, or descendant overrides. Exceptions require explanation and user approval.
- Comparable neighboring controls (Button right next to a SelectBox) must have the same visual size, radii, shadow and elevation, though intent may change color.
- Keep behavior consistent at the same viewport across roles and layouts. For example all desktop "More" actions use the same dropdown but mobile "More" actions use the same bottom sheet
- Never weaken recipient privacy or expose inference-producing states.
- Add stories plus focused behavior and geometry coverage for every new shared presentation.

## Nested Corner Geometry

- For an equal inset inside a bordered rounded parent, use `inner radius = max(0, parent outer radius - border thickness - padding)` so the curves remain parallel
- This is the W3C padding/content-edge derivation and is equivalent to Cloud Four’s `outerRadius - gap = innerRadius` rule ([W3C CSS Backgrounds §4.2](https://www.w3.org/TR/css-backgrounds-3/#corner-shaping)).
- Treat shadow clearance separately from the geometric inset because a shadow does not change the element’s box.
- Keep the actionable hit target distinct from the visible nested surface so accessible target size does not distort the corner geometry.

## Cloned OSS Repositories

When debugging or analyzing issues related to third-party libraries, delegate exploration to a sub-agent pointing at the cloned source in `C:\_MP_github_cloned\`
**Available**: svelte (+sveltekit), bits-ui, shadcn-svelte, storybook, fallow, lucide, tailwindcss

## Testing

- When writing tests, always derive expected behavior from requirements (GitHub issue descriptions and comments, `DECISIONS.md`, `CONTEXT.md`, or other docs) — never adapt tests to match the implementation. If a test reveals a bug, report it to the user or fix it immediately.

## Visual / Browser Testing

- **Default to raw Playwright** via the project's own installed `playwright` dependency:
    - Quick screenshot / crawl / click: `node scripts/shot.mjs <route> [--user martin|jana|petr|eva|tomas] [--mobile] [--dark] [--full] [--wait <sel>]`. Prints the PNG path; Read it back to view. Run from **PowerShell** (Git Bash mangles leading-slash args; from Bash prefix `MSYS_NO_PATHCONV=1`).
    - Repeatable verification: a `tests/e2e/*.spec.ts` with `@playwright/test`, reusing `tests/e2e/fixtures/{auth,wishlist}-helpers.ts`.
- Automation prereqs are explicit: prepare the seeded DB separately, then start the assigned isolated server with `pnpm dev:agent --port <assigned-port>` (use `.worktree-ports.json` if available). This command does not run `predev`, start/seed a database, or open a browser. Manual `pnpm dev` and its existing `predev`/auto-open behavior are unchanged.
- Prefer explicit `waitForSelector` over `waitUntil: 'networkidle'` (networkidle hangs on SSE/long-poll surfaces).

## Common Commands

- `pnpm run dev` -- dev server
- `pnpm run check:all` -- full check suite (format + lint + typecheck + stylelint + fallow + migration safety + vykání)
- `pnpm run test` -- all client, server, and Storybook unit tests
- `pnpm exec vitest run --project server` -- server unit tests only
- `pnpm run test:e2e` -- E2E tests
- `pnpm run db:seed` -- populate DB with test data (idempotent, safe to re-run)
  See package.json for all scripts

## Deployment

- Production deploys are gated: push to `production` → checks for the exact SHA → GitHub
  `production` environment approval → `wrangler deploy`. Schema changes follow
  expand → migrate → deploy → contract, enforced by `pnpm check:migrations`.
  Runbook: `docs/DEPLOYMENT.md`.

## Git Workflow

- Branch model: feature PRs → `dev` (default branch); releases via PR `dev` → `production` (merge auto-deploys).
- For verified branch-delete-only pushes, use `git push --no-verify origin --delete ...` unless the user explicitly wants hooks run.

## Database

- Drizzle with `strict: true` -- always enabled to prevent data loss on renames.
- Use file-based migrations (`pnpm db:migrate` locally). Before every production deployment, run `pnpm db:verify:prod`; if PENDING migrations are reviewed and explicitly authorized, run `pnpm db:migrate:prod -- --yes`, then verify again and require EXACT. DRIFT blocks migration and deployment. `drizzle-kit push` is never used in production.
- Schema in `src/lib/server/db/schema.ts`
- Seed script: `src/lib/server/db/seed.ts` — run `pnpm db:seed` to populate test data.

### Test Accounts (shared sign-in value: `SEED_PASSWORD` in seed.ts)

Two most-used personas below (recipient + gifter). More info in `src/lib/server/db/seed.ts`

| Email          | Name         | Role                                                    |
| -------------- | ------------ | ------------------------------------------------------- |
| martin@test.cz | Martin Novák | Primary recipient — owns self-lists + for-someone lists |
| petr@test.cz   | Petr Svoboda | Active gifter — many reservations                       |
