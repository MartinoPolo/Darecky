# Testing

## Local test environments

Use `pnpm exec vitest run` for an automated one-shot run of all client, server, and Storybook Vitest project groups. The projects run serially because concurrent projects race on shared SvelteKit generated state; tests within each project remain parallel. `pnpm run test` starts Vitest in watch mode for interactive development.

To run only the server project, use `pnpm exec vitest run --project server`.

`pnpm run test:e2e` starts its own localhost-only development server with a non-production signing secret. R2 variables are intentionally absent, so uploads use the local in-memory fallback. Set `MPX_APP_PORT` to the app port assigned in this worktree's `.worktree-ports.json` and free that port before running it. An explicit `MPX_APP_URL` takes precedence, so it must agree with the assigned port.

The setup project runs the route warmup before Chromium tests; Chromium excludes the setup spec so it cannot rerun alongside interaction tests. Setup allows extra navigation time for cold Vite compilation without relaxing the warmed application's navigation limits. Interaction tests must await actual readiness: opening autofocus before moving keyboard focus, and accordion height animations before filling or scrolling clipped descendants. SSR visibility does not prove event handlers are attached; after a full-page navigation, use `waitForAppHydration(page)` before the first hydration-dependent interaction. Visibility alone does not establish these conditions; use the root mounted signal, focus assertions, and animation completion rather than fixed sleeps.

Never point either command at production.

The ingestion endpoint depends on the `GIFT_INGESTION_RATE_LIMIT` Workers binding. `pnpm preview`
uses local Wrangler, which simulates this binding from `wrangler.jsonc`. The normal Vite-backed e2e
server remains supported for application tests, but intentionally has no Workers binding; if ingestion
credentials are configured there, ingestion fails closed with HTTP 503 rather than bypassing the limit.
