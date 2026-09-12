# Přejeme si

**Přejeme si** (from Czech _"dárečky"_ – presents) is a shareable wishlist web app. Users create lists of
gifts they'd love to receive and share a link with friends and family. Visitors reserve gifts so nobody
buys the same thing twice – and the wishlist recipient **never sees which gifts are reserved**, keeping the
surprise intact.

## How It Works

- **Create a wishlist** — ongoing or for a specific occasion — then add gifts (name, link, price, image,
  priority, quantity), pick a color, and arrange them in your preferred order. Add gifts one at a time,
  **batch-add** multiple rows at once, or use the **import wizard** (CSV upload, paste cells, or a
  Google Sheets link) for a 3-step
  Source → Review → Confirm flow. Each gift can carry up to 10 links (**multi-link**); the first is
  treated as the primary.
- **Share a link.** Anyone with the link can view and reserve gifts – no account required to reserve
  (anonymous visitors just provide a display name). Logged-in visitors auto-follow the list.
- **Reserve & like.** Visitors reserve gifts (with quantity support) to prevent duplicate buying, and
  "like" gifts to signal interest – if a liked gift gets reserved by someone else, the liker is notified.
- **Stay surprised.** A linked recipient can manage their list, but reservation state is stripped from
  everything they see (enforced at both the API and UI level). After sharing, editing follows uniform
  per-field rules: identity-sensitive fields are frozen while presentation and information can still be updated.
- **Delegate.** Recipients can appoint **správci** (the `moderator` role in code), who see full reservation
  state and help manage the list.

### Roles

| Role                 | Can do                                                                              | Sees reservations?                           |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| **Linked recipient** | Add/edit gifts within sharing rules, manage list settings, archive, appoint správci | ❌ Never                                     |
| **Správce**          | Manage the list and gifts, reserve gifts, and manage other správci                  | ✅ State, counts, and reserver identities    |
| **Visitor**          | View, reserve/unreserve, and like via shared link; account optional                 | ✅ Anonymous state/counts, not others' names |

Explicit self-promotion is a separate disclosed exception to the protected recipient view, with follower notification and a permanent warning. Ordinary management rights or app-admin status never bypass recipient privacy; see `.mpx/DECISIONS.md`.

### Key Concepts

- **Lifecycle:** Draft → Active (shared) → Archived (read-only). Archiving is manual.
- **Overview:** `/home` is the logged-in _Přehled_ landing page; the three list pages remain _Moje seznamy_,
  _Spravované_, and _Sledované_.
- **Themes** use curated palettes: a wishlist's palette applies to that wishlist, and the viewer's palette applies elsewhere. Light/dark/system mode is per-user.
- **Notifications:** critical events via email (Resend); everything else batched in-app.
- **Languages:** Czech (primary) + English, via URL-based i18n.

> Domain language, the full feature index, and constraints live in [`.mpx/CONTEXT.md`](.mpx/CONTEXT.md).
> Settled architectural and product decisions live in [`.mpx/DECISIONS.md`](.mpx/DECISIONS.md).

## Stack

| Layer         | Technology                                               |
| ------------- | -------------------------------------------------------- |
| Framework     | SvelteKit 2 + Svelte 5 (runes)                           |
| Build         | Vite 7                                                   |
| Language      | TypeScript (strict mode)                                 |
| Client–server | SvelteKit remote functions (query/form/command)          |
| Styling       | Tailwind CSS 4 + tailwind-variants                       |
| UI Components | shadcn-svelte / bits-ui (base → derived → blocks)        |
| Theme         | mode-watcher (light / dark / system)                     |
| Database      | PostgreSQL + Drizzle ORM (strict mode)                   |
| Auth          | BetterAuth (email/password, Google)                      |
| Validation    | Valibot                                                  |
| i18n          | Paraglide JS (cs primary, en secondary)                  |
| Storage       | Cloudflare R2 (presigned direct uploads; proxy fallback) |
| Email         | Resend                                                   |
| Testing       | Vitest + Playwright + Testing Library                    |
| Linting       | OxLint + ESLint + Stylelint                              |
| Dead code     | Fallow (regression-gated)                                |
| Component dev | Storybook 10                                             |
| Deployment    | Cloudflare Workers + Neon Postgres (Hyperdrive)          |

## Getting Started

```sh
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and AUTH_SECRET (openssl rand -base64 32).
# Turnstile uses Cloudflare test keys automatically during local development.

# 3. Start PostgreSQL (requires Docker)
pnpm run db:start

# 4. Run committed database migrations
pnpm run db:migrate

# 5. Seed only a disposable local database (idempotent – safe to re-run)
pnpm run db:seed

# 6. Start dev server
pnpm run dev
```

### Test Accounts

The disposable-local seed personas and shared sign-in value are defined in
`src/lib/server/db/seed.ts`; consult that file rather than relying on duplicated account counts or credentials here.

## Scripts

### Development

| Script               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `pnpm run dev`       | Ensure the database and seed images are ready, then start the dev server |
| `pnpm run build`     | Production build                                                         |
| `pnpm run preview`   | Preview the built Cloudflare Worker locally                              |
| `pnpm run storybook` | Start Storybook on its assigned port                                     |

### Code Quality

| Script                  | Description                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| `pnpm run check`        | Typecheck (paraglide compile + svelte-check)                                      |
| `pnpm run check:all`    | Full suite: format + oxlint + stylelint + fallow + vykání + svelte-check + eslint |
| `pnpm run check:vykani` | Fails if Czech copy slips into tykání (informal address)                          |
| `pnpm run lint`         | OxLint                                                                            |
| `pnpm run lint:eslint`  | ESLint (type-aware)                                                               |
| `pnpm run lint:css`     | Stylelint for CSS and Svelte                                                      |
| `pnpm run format`       | Format with Prettier                                                              |
| `pnpm run fallow:audit` | Fallow dead-code / boundary audit (JSON)                                          |

### Testing

| Script                      | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `pnpm run test`             | Unit tests with Vitest                                         |
| `pnpm run test:e2e`         | Full E2E suite with Playwright (Chromium)                      |
| `pnpm run test:e2e:changed` | E2E tests changed since or statically affected relative to dev |

### Database

| Script                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `pnpm run db:start`    | Ensure PostgreSQL is running and ready                    |
| `pnpm run db:generate` | Generate migration files                                  |
| `pnpm run db:migrate`  | Run migrations                                            |
| `pnpm run db:seed`     | Prepare seed images, then populate the database           |
| `pnpm seed:images`     | Repair the local seed image cache without database access |
| `pnpm run db:studio`   | Open Drizzle Studio                                       |

### Deployment & Codegen

| Script                     | Description                       |
| -------------------------- | --------------------------------- |
| `pnpm run cf:types`        | Generate Cloudflare Workers types |
| `pnpm run auth:schema`     | Regenerate BetterAuth DB schema   |
| `pnpm run build:storybook` | Build static Storybook            |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                                                                      | Required | Description                                                                                                     |
| ----------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                | Yes      | PostgreSQL connection string                                                                                    |
| `AUTH_SECRET`                                                                 | Yes      | 32-byte base64 secret (`openssl rand -base64 32`)                                                               |
| `ORIGIN`                                                                      | No       | App URL – OAuth redirects + email links (default 5173)                                                          |
| `GOOGLE_CLIENT_ID`                                                            | No       | Google OAuth client ID                                                                                          |
| `GOOGLE_CLIENT_SECRET`                                                        | No       | Google OAuth client secret                                                                                      |
| `PUBLIC_TURNSTILE_SITE_KEY`                                                   | Prod     | Public Cloudflare Turnstile widget site key                                                                     |
| `TURNSTILE_SECRET_KEY`                                                        | Prod     | Private Cloudflare Turnstile Siteverify secret                                                                  |
| `PUBLIC_SENTRY_DSN`                                                           | Prod     | Public Sentry DSN for browser and Worker error reporting                                                        |
| `SENTRY_ORG`, `SENTRY_PROJECT`                                                | CI       | Sentry source-map destination (`martin-poloch` / `prejemesi`)                                                   |
| `SENTRY_AUTH_TOKEN`                                                           | CI       | Private build-only token used for source-map uploads; never expose it at runtime                                |
| `PUBLIC_R2_URL`                                                               | No       | Public R2 bucket URL (client-visible) – serves images + `/cdn-cgi/image/` variants; in-memory fallback if unset |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | No       | Presigned direct-to-R2 uploads (#107); same-origin proxy fallback if unset                                      |

Google OAuth is enabled automatically when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
Registration, password sign-in, and password-reset requests use BetterAuth's Turnstile integration and remain
fail-closed. Anonymous reservation uses an advisory Turnstile check: missing or invalid tokens are rejected while
verification is configured and available, but missing configuration or a Siteverify outage is logged and allowed
(fail-open). Local development uses Cloudflare's published test keys when the Turnstile variables are blank.

Production errors are reported to Sentry without user identity, cookies, headers, query strings,
HTTP bodies, database values, or stack-frame variables. Session Replay samples 10% of sessions and
all sessions containing captured errors while masking all text and inputs and blocking media and
network bodies. Replays stop and are discarded on authentication, token-bearing, and query-string
URLs. Production source maps are uploaded only when the deployment workflow explicitly enables
uploads and all three build-only Sentry settings are available.

## Project Structure

```
src/
  app.css                    # Tailwind entry + canonical design tokens
  hooks.server.ts            # i18n middleware + BetterAuth session injection
  lib/
    components/
      base/                  # shadcn-svelte / bits-ui primitives (do not edit)
      derived/               # reusable wrappers combining base components
      blocks/                # feature-level composed UI (WishlistCard, GiftDetailModal, …)
    modules/                 # domain modules – each owns types, remote fns, context, public API
      wishlists/  gifts/  reservations/  likes/  moderators/
      sharing/    themes/ notifications/  uploads/  settings/  errors/
      import/                # import wizard – CSV/Google Sheets → draft grid → gifts
    reactivity/              # reactive primitives (StateRaw, Derived, Persisted)
    server/
      auth.ts                # BetterAuth server config
      db/
        schema.ts            # Drizzle schema (auth, wishlist, gift, moderator, follower, notification)
                             #   gift.image_meta – fit mode + crop metadata for current gift surfaces
                             #   gift.links – jsonb array of up to 10 URLs; links[0] is primary (replaces url)
                             #   wishlist.image_key + image_slots – single upload + independent per-slot crops
        seed.ts              # Idempotent test-data seeder
  routes/
    (auth)/                  # login, register, reset-password (split-screen layout)
    (app)/                   # /home overview, list pages, account settings, and w/[id] (app shell)
                             #   wishlist configuration opens in the staged settings dialog
    +page.svelte             # Landing page
messages/                    # Translation files (cs.json, en.json)
tests/e2e/                   # Playwright E2E tests
```

Each domain module exposes a small public API via `index.ts`. Client–server communication uses
SvelteKit **remote functions** (`*.remote.ts`) by default – `query` for reads, `form` for
progressive-enhancement mutations, `command` for JS-only actions – wrapped in guarded helpers that
enforce auth. The deliberate `/home` exception uses a `+page.server.ts` load for its latency-sensitive
authenticated overview: it awaits parent layout authentication and invokes a server-only database
service directly, avoiding an intra-server remote request. General REST-style `+server.ts` routes are
not used; the purpose-specific route exceptions are the BetterAuth catch-all, the upload proxy, and
the fixed-target internal gift-ingestion endpoint for authenticated machine ingestion.

## Code Conventions

- **Indentation:** tabs (4-width) · **Quotes:** single · **Semicolons:** required · **Line width:** 100 · **Line endings:** LF
- **Naming:** follow `eslint.config.mjs` and established local patterns (including configured camelCase/PascalCase rules)
- **Svelte:** Svelte 5 runes only (`$state`, `$derived`, `$props`); contexts use the `createContext` API
- **Components:** new derived/block components use `tailwind-variants` in separate `*-variants.ts` files

## Deployment

Built with `@sveltejs/adapter-cloudflare` for **Cloudflare Workers**, backed by **Neon Postgres** (via
Hyperdrive), **R2** for image storage, and **Resend** for email – all on free tiers. Configuration is in
`wrangler.jsonc`; add Cloudflare bindings (KV, D1, R2) in `src/app.d.ts` under `App.Platform`.

Development checks run on pull requests and `dev`; production releases use the gated exact-SHA workflow with
GitHub `production` environment approval. The canonical release procedure is
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md); this is a Workers deployment, not a Cloudflare Pages hookup.
