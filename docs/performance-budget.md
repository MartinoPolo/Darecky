# Initial-Load Performance Budget

Guards the two public entry pages — landing (`/`) and login (`/login`) — against
two regressions (issue #106):

1. **Code fan-out** — an anonymous visitor must never download authenticated app
   code (dashboards, settings, import wizard, wishlist/gift management, the app
   shell) before they interact.
2. **Payload creep** — the initial JavaScript request count and transferred bytes
   must stay within a measured budget.

The gate is the automated Playwright spec
[`tests/e2e/performance-budget.spec.ts`](../tests/e2e/performance-budget.spec.ts).

---

## The budget

| Page             | Max JS requests | Max transferred JS bytes |
| ---------------- | --------------- | ------------------------ |
| Landing (`/`)    | **444**         | **17,102,094**           |
| Login (`/login`) | **202**         | **12,110,852**           |

Budget = **measured baseline + ~25% headroom** (`ceil(measured × 1.25)`), per
page, for both request count and bytes. The headroom absorbs benign churn (a new
icon, a copy string) while still catching a real code-fan-out regression.

### Measured baseline

| Page    | Measured   | JS requests | Transferred JS bytes |
| ------- | ---------- | ----------- | -------------------- |
| Landing | Current CI | 355         | 13,681,675           |
| Login   | 2026-07-12 | 161         | 9,688,681            |

The landing budget was re-baselined from current deterministic CI evidence after the
real demo and shared presentation dependency graph settled at 355 requests and
13,681,675 bytes. Applying the authoritative `ceil(measured × 1.25)` rule yields 444
requests and 17,102,094 bytes. The forbidden-module gate remains unchanged, so this
headroom covers intentional public presentation fan-out without admitting authenticated
application code.

The landing baseline first jumped on **2026-08-01** when the interactive demo section
(issue #218) shipped: it server-renders the real `GiftCard`/`GiftListItem`
(REQ-3, REQ-10), which pulls the gift block components and their dependencies
into the landing module graph. That is the intended cost of a demo that cannot
drift from the shipped product.

> Measure on a **warm** dev server. The 2.5 s post-hydration settle window is a
> fixed budget, so a cold server that is still transforming modules when it
> expires reports a lower count (CI has been seen at 245–265 for the same tree
> that measures a stable 274 warm). Truncation only ever _under_-counts, so it
> cannot cause a false failure — but always baseline from the warm, higher
> number.

> **These are Vite _dev-mode_ module counts and bytes, not production chunk
> sizes.** The e2e suite is local-only and runs against the dev server
> (`pnpm run dev`), where modules arrive unbundled and untransformed — so a
> "request" is one source module and "bytes" is uncompressed dev output. The
> numbers are large and would look alarming as production figures; they are not.
> What makes them useful is that they are **deterministic for a given source
> tree**: the same commit always fans out to the same module graph. That makes
> them a reliable **code-fan-out regression gate**, which is the point — not an
> estimate of what ships to users.

---

## What the fan-out gate forbids

Before any user interaction, a request URL from `/` or `/login` matching any of
these path fragments fails the test:

| Forbidden fragment                                 | What it is                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `/routes/(app)/`                                   | All authenticated routes (dashboards, settings, `/w/` management) |
| `/lib/modules/import/`                             | Import wizard                                                     |
| `/lib/modules/wishlists/`                          | Wishlist management module                                        |
| `/lib/modules/gifts/`                              | Gift management module                                            |
| `/lib/modules/notifications/`                      | Authenticated shell notifications                                 |
| `/lib/components/blocks/navbar/Navbar.svelte`      | Authenticated app-shell root                                      |
| `/lib/components/blocks/navbar/UserMenu.svelte`    | App-shell user menu                                               |
| `/lib/components/blocks/navbar/MobileNav.svelte`   | App-shell mobile nav                                              |
| `/lib/components/blocks/navbar/NavDropdown.svelte` | App-shell nav dropdown                                            |

The navbar entries are listed individually on purpose: the `navbar/` folder also
contains `LogoMark.svelte`, a dependency-light shared logo used by the **public**
`LandingNav`/`LandingFooter` and the auth pages. Guarding the whole folder would
false-positive on that shared logo, so only the true app-shell components are
listed. `Navbar.svelte` is the shell root and transitively pulls the others, so
gating it already covers the real authenticated chrome.

### Landing-only exceptions (issue #218)

The landing demo section server-renders the real `GiftCard`/`GiftListItem`
(REQ-3: the demo must never drift from the shipped product), so these modules are
public code by design and are allowed **on `/` only**:

| Allowed on `/`                                    | Why the demo needs it              |
| ------------------------------------------------- | ---------------------------------- |
| `/lib/modules/gifts/types.ts`                     | Gift view types                    |
| `/lib/modules/gifts/gift_display.ts`              | Price/label formatting             |
| `/lib/modules/gifts/gift_display_state.ts`        | Reserved/archived render state     |
| `/lib/modules/gifts/gift_url.ts`                  | External-link rendering            |
| `/lib/modules/gifts/gifts.context.svelte.ts`      | Context the demo stubs locally     |
| `/lib/modules/wishlists/types.ts`                 | `WishlistRole`                     |
| `/lib/modules/wishlists/wishlist_capabilities.ts` | Release capability (empty in demo) |
| `/lib/modules/wishlists/dashboard_types.ts`       | Status badge label + tone map      |
| `/lib/modules/wishlists/event_countdown.ts`       | Countdown chip string              |

The last two arrived with the demo's `WishlistHeader` hero (the real wishlist header
above the two panes, rendered with `role: visitor`). Both are pure presentation helpers.

The demo's own like counter needs **no** exception: `$lib/modules/likes/` and
`$lib/modules/landing/` are not guarded folders, so `LikeButton`'s likes context and the
demo's `landing_demo_likes.remote.ts` load on `/` without a hole in the gate. That is
intentional — those two modules are anonymous-visitor endpoints by design, not
authenticated app code. Reservations remain fixture-only and reach no remote function at
all, which is what `tests/e2e/landing-demo.spec.ts` asserts.

They are enumerated file by file, never folder-wide: gift/wishlist
**management** (drafts, deletion rules, dashboards, wishlist creation) and every
`*.remote.ts` data module stay forbidden, so a new fan-out into that code still
fails the gate. `/login` passes **no** exceptions and remains fully strict.

---

## Preloading strategy

The budget is only meaningful alongside the preloading rules that keep public
pages lean while still making the first in-app navigation fast:

- **No unconditional preloading.** The root `+layout.svelte` does **not**
  eagerly `preloadCode()` any routes. Public and auth pages therefore never pull
  authenticated app code up front.
- **Intent-based preloading (everyone).** `<body data-sveltekit-preload-data="hover">`
  (in `src/app.html`) lets SvelteKit preload a route's code + data on hover / tap
  intent. Anonymous visitors on public wishlist pages rely on this alone.
- **Selective idle-time preloading (authenticated only).** `(app)/+layout.svelte`
  warms only `/followed` from the overview (the observed dominant destination),
  or `/home` from another authenticated route. It uses `requestIdleCallback`
  with a bounded Safari timer fallback and skips idle preloading when the
  optional Network Information API reports data-saving mode, `slow-2g`, or
  `2g`. Hover/tap intent remains the fallback everywhere.

> **Not the same as vite dev-warmup.** `server.warmup.clientFiles` in
> `vite.config.ts` also lists these primary routes, but that is a **dev-server
> pre-transform** optimization only — it makes the local dev server compile those
> modules ahead of time and has no effect on what a browser fetches in production.
> It is independent of the runtime `preloadCode()` strategy above and is
> intentionally retained. Do **not** re-add an unconditional root-layout
> `preloadCode()` to "match" the warmup list — that is exactly the fan-out this
> budget guards against.

---

## Running the gate

Prerequisites: a seeded local DB (`pnpm db:seed`, idempotent). The spec's
`webServer` starts its own dev server.

Port 5173 is often held by another worktree's dev server; because
`reuseExistingServer` is `true`, point the run at a dedicated free port so it
doesn't reuse the wrong code:

```powershell
$env:PLAYWRIGHT_DEV_SERVER_PORT = 5199
pnpm exec playwright test tests/e2e/performance-budget.spec.ts --project=chromium
```

(`PLAYWRIGHT_DEV_SERVER_PORT` overrides both the Playwright `baseURL` and the
`webServer` port; default is 5173.)

---

## Re-baselining after an intentional change

If a legitimate change moves a page's module graph (adds a section, a real new
dependency, etc.) and the budget assertion — not the fan-out assertion — fails:

1. **First confirm the fan-out assertion still passes.** If the test fails
   because a _forbidden_ authenticated module is now being fetched, that is a
   **real regression** to investigate, not a budget to relax. Do not raise the
   budget to hide it. The only way a forbidden module becomes acceptable is a
   deliberate product decision to make it public — and then it goes into the
   landing-only exception list above, named file by file with its reason, never
   by deleting a folder-wide fragment.
2. Run the spec (command above) against a **warm** dev server and read the
   `[budget]` console lines, e.g.:
    ```
    [budget] landing: 274 JS requests, 11996812 bytes
    [budget] login: 161 JS requests, 9688825 bytes
    ```
3. Set each new budget constant in `tests/e2e/performance-budget.spec.ts`
   (`LANDING_BUDGET` / `LOGIN_BUDGET`) to `ceil(measured × 1.25)` for both
   request count and bytes.
4. Update the **budget** and **measured baseline** tables in this doc (and the
   measurement date), so the numbers and their rationale stay in sync with the
   spec.

---

## Production delta report

The CI performance-report job runs only for PRs whose head branch starts with `perf/` or
that carry the `performance-report` label.

The pull-request production report complements, rather than replaces, the Vite dev-mode
fan-out gate above. It builds the base and head commits and compares the actual startup-window
production JS/CSS assets for `/` and `/login`, avoiding the unbundled module fan-out that
makes the existing dev budgets intentionally unsuitable as production bundle figures.
The existing dev budgets remain unchanged and blocking.

Run a checkout locally with a dedicated port and commit label. On Windows Git Bash use:

```bash
pnpm.exe perf:collect -- --project . --output performance-reports/head.json --port 8402 --commit HEAD --runs 5
pnpm.exe perf:compare -- --base performance-reports/base.json --head performance-reports/head.json --output performance-reports/summary.md
```

On macOS or Linux use:

```sh
pnpm perf:collect -- --project . --output performance-reports/head.json --port 8402 --commit HEAD --runs 5
pnpm perf:compare -- --base performance-reports/base.json --head performance-reports/head.json --output performance-reports/summary.md
```

Collection uses five fresh, no-cache Chromium contexts per route and reports medians with
a fixed 390×844 viewport, 4× CPU throttling, 150 ms latency, and 1.6 Mbps download. Asset
totals include responses through a fixed 2.5-second post-load startup window, so they may
include dynamically loaded work in that bounded window. The workflow uploads the base JSON, head JSON, and Markdown summary for 14 days, appends the
summary to the job page, and updates one marker-based PR comment.

Warnings highlight relative increases of **10% or more in startup-window JS/CSS Brotli bytes**
and **15% or more in runtime metrics**. They are informational and nonblocking: build,
browser, collection, missing-input, comparison, artifact, or comment failures must not
gate a pull request, and failed reports remain visibly represented in the Markdown.

These figures are raw Chromium diagnostics. They are **not Lighthouse scores** and do not
model deployed-edge behavior, production network routing, caches, or geographic latency.
Autonomous agents must disclose significant regressions called out by this report in their
completion summary, even though the report does not block merging.
