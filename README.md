# Přejeme si

**Přejeme si** is a shareable wishlist web app. Users create gift lists for themselves or someone else
and share a link with friends and family. Visitors reserve gifts to avoid duplicate purchases;
ordinary recipients are protected from reservation spoilers, with explicit exceptions documented in
[the decisions](.mpx/DECISIONS.md#roles-privacy--trust).

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
- **Stay surprised.** Ordinary recipients receive no reservation data. After sharing they can still edit
  presentation fields and append descriptions; names and deletion lock after initial grace. Reserved
  gifts cannot be deleted even during grace, an explicitly accepted narrow inference exception.
- **Delegate.** Linked recipients and **správci** (managers) can invite other správci. Explicit recipient
  self-promotion reveals state/counts with disclosure, but never gifter identities.

### Roles

| Role                  | Can do                                                             | Reservation visibility                                            |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Linked recipient**  | Manage their list, gifts, appearance, sharing, archive and správci | None by default; state/counts only after disclosed self-promotion |
| **Správce / manager** | Full management, reserve gifts, release guest reservations         | State and gifter identities                                       |
| **Visitor**           | View, reserve/unreserve own gifts and like via shared link         | State and own controls, not others' identities                    |

### Key Concepts

- **Lifecycle:** Draft → Active (shared) → Archived (read-only). Archiving is manual.
- **Navigation:** _Přehled_ (`/home`) is the signed-in home; _Moje seznamy_, _Spravované_, and _Sledované_ remain the section pages.
- **Palettes:** curated user and wishlist palettes, independent image-frame fill, and per-user light/dark/system mode.
- **Notifications:** critical email via Resend; routine in-app activity, including one rolling 24-hour new-gift digest per notified user across followed lists.
- **Languages:** Czech (primary) + English, via URL-based i18n.

> Domain language, the full feature index, and constraints live in [`.mpx/CONTEXT.md`](.mpx/CONTEXT.md).
> Settled architectural and product decisions live in [`.mpx/DECISIONS.md`](.mpx/DECISIONS.md).

## Stack

| Layer         | Technology                                                     |
| ------------- | -------------------------------------------------------------- |
| Framework     | SvelteKit 2 + Svelte 5 (runes)                                 |
| Build         | Vite 7                                                         |
| Language      | TypeScript (strict mode)                                       |
| Client–server | SvelteKit remote functions (query/form/command)                |
| Styling       | Tailwind CSS 4 + tailwind-variants                             |
| UI Components | shadcn-svelte / bits-ui (base → derived → blocks)              |
| Theme         | mode-watcher (light / dark / system)                           |
| Database      | PostgreSQL + Drizzle ORM (strict mode)                         |
| Auth          | BetterAuth (email/password, Google)                            |
| Validation    | Valibot                                                        |
| i18n          | Paraglide JS (cs primary, en secondary)                        |
| Storage       | Cloudflare R2 (presigned direct uploads; local proxy fallback) |
| Email         | Resend                                                         |
| Testing       | Vitest + Playwright + Testing Library                          |
| Linting       | OxLint + ESLint + Stylelint                                    |
| Dead code     | Fallow (regression-gated)                                      |
| Component dev | Storybook 10                                                   |
| Deployment    | Cloudflare Workers + Neon Postgres (Hyperdrive)                |

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

# 4. Apply local database migrations
pnpm run db:migrate

# 5. Seed test data (idempotent – safe to re-run)
pnpm run db:seed

# 6. Start dev server
pnpm run dev
```

### Test Accounts

Seeded accounts share the password defined by `SEED_PASSWORD` in `src/lib/server/db/seed.ts`
(currently `"password123"`).

| Email          | Name           | Role                                                |
| -------------- | -------------- | --------------------------------------------------- |
| martin@test.cz | Martin Novák   | Primary owner – 4 wishlists (active/draft/archived) |
| jana@test.cz   | Jana Dvořáková | Owner + moderator on Martin's lists                 |
| petr@test.cz   | Petr Svoboda   | Active gifter – many reservations                   |
| eva@test.cz    | Eva Králová    | Casual visitor – mostly likes                       |
| tomas@test.cz  | Tomáš Černý    | Mostly inactive – 1 archived + 1 active list        |

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

| Script                 | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `pnpm run db:start`    | Ensure PostgreSQL is running and ready                     |
| `pnpm run db:push`     | Disposable local schema experiments only; never production |
| `pnpm run db:generate` | Generate migration files                                   |
| `pnpm run db:migrate`  | Run migrations                                             |
| `pnpm run db:seed`     | Prepare seed images, then populate the database            |
| `pnpm seed:images`     | Repair the local seed image cache without database access  |
| `pnpm run db:studio`   | Open Drizzle Studio                                        |

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
Registration, password sign-in, password-reset, and anonymous reservation requests are
protected by Cloudflare Turnstile. Local development uses Cloudflare's published test keys when the two Turnstile
variables are blank. Authentication remains fail-closed. Anonymous reservation rejects invalid/replayed
or configured-but-missing tokens, but allows and logs unverified requests when configuration or
Siteverify is unavailable; see [production operations](docs/PRODUCTION_OPERATIONS.md#turnstile).

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
      base/                  # managed primitives; only narrowly approved patches
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
                             #   gift.image_meta – fit mode + focal-point crop (one crop for all surfaces)
                             #   gift.links – jsonb array of up to 10 URLs; links[0] is primary (replaces url)
                             #   wishlist.image_key + image_slots – single upload + per-slot crop JSON
                             #     (replaced banner_image_key / thumbnail_image_key)
                             #   user.app_background_theme – default | golden-hour | twilight
        seed.ts              # Idempotent test-data seeder
  routes/
    (auth)/                  # login, register, reset-password (split-screen layout)
    (app)/                   # my-lists, moderated, followed, settings, w/[id] (app shell)
                             #   w/[id]/settings – owner-only wishlist appearance (image, theme, per-slot crop)
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
- **Variables:** `snake_case` or `PascalCase` (no camelCase) · **Types:** `PascalCase` · **Constants:** `UPPER_CASE`
- **Svelte:** Svelte 5 runes only (`$state`, `$derived`, `$props`); contexts use the `createContext` API
- **Components:** new derived/block components use `tailwind-variants` in separate `*-variants.ts` files

## Deployment

Built with `@sveltejs/adapter-cloudflare` for **Cloudflare Workers**, backed by **Neon Postgres** (via
Hyperdrive), **R2** for image storage, and **Resend** for email – all on free tiers. Configuration is in
`wrangler.jsonc`; add Cloudflare bindings (KV, D1, R2) in `src/app.d.ts` under `App.Platform`.

`.github/workflows/ci.yml` runs the full check suite, unit tests with coverage, and Playwright E2E on every
PR and push to `dev`/`main`. Connect the repo to Cloudflare Pages/Workers for automatic deploys and PR
preview environments.
