# Testing

## Local test environments

Use `pnpm exec vitest run` for an automated one-shot run of all client, server, and Storybook Vitest project groups. The projects run serially because concurrent projects race on shared SvelteKit generated state; tests within each project remain parallel. `pnpm run test` starts Vitest in watch mode for interactive development.

To run only the server project, use `pnpm exec vitest run --project server`.

`pnpm run test:e2e` starts its own localhost-only server through `dev:agent`, without running `predev`, Docker startup, or image preparation. Prepare a **disposable local database** separately: run the committed migrations, compile translations, sync SvelteKit, and seed it with the same exported `DATABASE_URL` used by Playwright. Do not use the shared development database for repeatable results; generated E2E users and lists are not cleaned up automatically. Seeding restores seed rows, not accumulated E2E records.

Playwright reads local environment configuration, rejects non-loopback application/database targets, and forwards the selected database URL to both `DATABASE_URL` and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Both matter: the Cloudflare adapter's local binding otherwise takes precedence over `DATABASE_URL`. Upload and email credentials are disabled in the managed E2E server. Set `MPX_APP_PORT` to this worktree's assigned app port when available; otherwise use the project default or an explicitly configured free port. `MPX_APP_URL` takes precedence and `PLAYWRIGHT_BASE_URL`, if supplied, must match that origin.

The setup project runs the route warmup before Chromium tests; Chromium excludes the setup spec so it cannot rerun alongside interaction tests. Setup allows extra navigation time for cold Vite compilation without relaxing the warmed application's navigation limits. Interaction tests must await actual readiness: opening autofocus before moving keyboard focus, and accordion height animations before filling or scrolling clipped descendants. SSR visibility does not prove event handlers are attached; after a full-page navigation, use `waitForAppHydration(page)` before the first hydration-dependent interaction. Visibility alone does not establish these conditions; use the root mounted signal, focus assertions, and animation completion rather than fixed sleeps.

On Windows, browser automation uses Playwright's bundled Chromium to avoid installed Chrome hanging during temporary-profile cleanup. Install it with `pnpm exec playwright install chromium`. Other platforms retain the Chrome channel provisioned by CI.

Never point either command at production.

## Focused E2E iteration

Start with the affected spec or test name, not the full suite:

```bash
pnpm exec playwright test tests/e2e/recipient-no-reservations.spec.ts
pnpm exec playwright test tests/e2e/elevation-motion.spec.ts --repeat-each=3 --retries=0
```

Local retries default to zero so failures remain visible. CI retains a retry for diagnostic traces and uploads `test-results/` even when the retry passes. `test-results/results.json` records per-test durations, attempts, errors, and flaky outcomes; preserve it before the next run replaces the output directory. A retry pass is evidence of a reliability problem, not proof that the first failure was harmless.

For repeated narrow runs, explicitly opt into an **already controlled** server with `PLAYWRIGHT_EXTERNAL_SERVER=1`. Start it through `pnpm dev:agent --port "$MPX_APP_PORT" --strictPort` with the same database and Hyperdrive override, matching `ORIGIN`, local auth secret, test admin, and disabled upload/email credentials as `scripts/playwright-environment.mjs`. Run setup once, then use `--project=chromium --no-deps` for subsequent narrow runs. Do not use this option to attach to an unknown existing development server. Normal runs never reuse a server implicitly.

## Coverage ownership

- E2E protects real cross-boundary workflows: authentication, persistence, recipient privacy, permissions, navigation, and documented request budgets. Shared component variants and event mechanics belong in their existing component/browser tests.
- Derive expectations from current decisions, not the implementation being tested. Remove obsolete negative assertions rather than changing product behavior or decisions to make them pass.
- Prefer visible outcomes and relational geometry: containment, equal insets, square/full-height images, consistent neighboring controls, and stable hit targets. Absolute values belong only where the accepted contract explicitly fixes them, such as the control scale, accessible target minimum, crop aspect, or a user-selected color. Do not pin incidental gaps, radii, shadow recipes, animation durations, or CSS layout mechanisms.
- Wait for hydration, autofocus, image decoding, and relevant animation completion before acting or measuring. Use `waitForDialogMotionToSettle` for dialog geometry. A visible dialog may still be moving. Do not retry non-idempotent clicks; await their acknowledged result. Frame sampling is appropriate when motion itself is the behavior under test.
- Establish positive preconditions before asserting absence: a privacy test must first prove a visitor successfully reserved. Shared global counters must not be asserted as fixed totals or isolated deltas in concurrent E2E.
- Screenshots are not automatically assertions. Keep required sheet-inventory/hover acceptance evidence and failure diagnostics, but avoid repeated diagnostic screenshot matrices in unrelated persistence tests. Preserve the real-zoom hover matrix and the shared mobile-sheet contract required by `DECISIONS.md`.

The ingestion endpoint depends on the `GIFT_INGESTION_RATE_LIMIT` Workers binding. `pnpm preview`
uses local Wrangler, which simulates this binding from `wrangler.jsonc`. The normal Vite-backed e2e
server remains supported for application tests, but intentionally has no Workers binding; if ingestion
credentials are configured there, ingestion fails closed with HTTP 503 rather than bypassing the limit.
