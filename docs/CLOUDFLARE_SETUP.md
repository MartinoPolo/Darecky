# Cloudflare Setup & Maintenance Guide

For quota incidents, privacy-safe telemetry, WAF/rate-limit verification, Turnstile, and Smart
Placement, use [Production operations](./PRODUCTION_OPERATIONS.md).

How to deploy Přejeme si to Cloudflare, develop against it, and maintain it. The project is
**already architected for Cloudflare** – the decision is settled in `.mpx/DECISIONS.md` (2026-05-30)
and most wiring exists in code. This guide covers provisioning the external services and filling in
deploy-time config.

---

## 1. Where everything runs

| Concern      | Service                                 | Status in code                                                                                                  |
| ------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **The app**  | **Cloudflare Workers** (not Pages)      | ✅ `adapter-cloudflare`, `wrangler.jsonc`, `_worker.js` output                                                  |
| **Database** | **Neon Postgres** via **Hyperdrive**    | ✅ `getDb()` reads `platform.env.HYPERDRIVE` → falls back to `DATABASE_URL`; `postgres({ prepare: false })` set |
| **Images**   | **R2** (`prejemesi-images`)             | ✅ binding + upload proxy + public-URL logic                                                                    |
| **Email**    | **Resend**                              | ✅ wrapper with console fallback                                                                                |
| **Auth**     | better-auth (edge-compatible `minimal`) | ✅ email/password + optional Google                                                                             |

> The SvelteKit Cloudflare adapter outputs a **Worker with Static Assets**
> (`.svelte-kit/cloudflare/_worker.js` + `ASSETS` binding), **not** a Pages project. Deploy to
> **Workers**; in the dashboard the project appears under **Workers & Pages → your worker**. Do not
> create a Pages project.

**Cost:** $0/month on free tiers – Workers (100k req/day), Hyperdrive (free on all plans), R2 (10
GB), Neon (free, ~300–800ms cold start after idle), Resend (3k emails/mo, 100/day).

---

## 2. What's done vs. what you must do

**Already wired (no action):** adapter, wrangler config, Hyperdrive/R2 code paths, `app.d.ts`
platform types, `cf:types` + `preview` scripts, `.env` gitignored (only `.env.example` tracked),
`prepare:false` for the pooler.

**Provisioning status:**

1. Neon DB + Hyperdrive: done
2. R2 bucket + `images.prejemesi.cz`: done
3. Production secrets/vars in Cloudflare: done
4. Deploy script: done
5. Production migration against Neon: done
6. Custom domain + `ORIGIN`: done
7. Resend domain verification + `RESEND_API_KEY`: done
8. Production auth hardening: done
9. Production site hygiene: done
10. Google OAuth redirect URIs: pending only if Google login is used

---

## 3. One-time setup (in order)

### A. Account + CLI

```powershell
pnpm add -g wrangler   # or use pnpm dlx wrangler
wrangler login
```

### B. Neon Postgres

Create a project at neon.tech → copy the **direct (non-pooled)** connection string (Hyperdrive does
its own pooling, so point it at the unpooled endpoint).

### C. Hyperdrive

```powershell
wrangler hyperdrive create prejemesi-db --connection-string="postgresql://USER:PASS@HOST/dbname?sslmode=require" --caching-disabled
```

`sslmode=verify-full` requires uploading a CA certificate to Cloudflare first. For Neon +
Hyperdrive, `sslmode=require` is the working encrypted setup.

Copy the returned **id**, then fill the binding in `wrangler.jsonc`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<your-hyperdrive-id>" }],
```

### D. R2 bucket + public URL

```powershell
wrangler r2 bucket create prejemesi-images
wrangler r2 bucket domain add prejemesi-images --domain images.prejemesi.cz --zone-id <zone-id> --min-tls 1.2 --force
```

R2 requires activating the $0/month metered subscription. The Standard storage free tier is 10
GB-month storage, 1M Class A operations, 10M Class B operations, and free egress.

Use the custom subdomain `images.prejemesi.cz` and set that value as `PUBLIC_R2_URL` (below).
Without it, images still work but get proxied through the Worker.

#### R2 CORS (presigned direct uploads – issue #107)

Browsers upload straight to R2 via presigned PUT URLs, which requires CORS on the bucket. Generate
`scripts/r2-cors.json` from the MPX-assigned app and preview ports, then apply it:

```powershell
pnpm r2:cors:generate
wrangler r2 bucket cors set prejemesi-images --file scripts/r2-cors.json
```

Direct commands safely fall back to ports 8300/8301. Re-run generation before applying when a
checkout's assignments change.

#### R2 API token (presigned direct uploads – issue #107)

Presigning needs S3-API credentials. Dashboard → **R2 → Manage API Tokens** → create a token with
**Object Read & Write** scoped to `prejemesi-images`, then:

```powershell
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

`R2_ACCOUNT_ID` + `R2_BUCKET_NAME` are plain vars in `wrangler.jsonc`. Until the two secrets exist,
uploads transparently fall back to the same-origin Worker proxy route (the pre-#107 behavior).

#### Image Transformations (issue #107)

Card/list/thumbnail surfaces load width-bounded `/cdn-cgi/image/…` variants from
`images.prejemesi.cz`. Enable once per zone: Dashboard → **Images → Transformations** → enable for
the `prejemesi.cz` zone (allow same-zone sources). No wrangler/API equivalent exists for this
toggle.

Free tier: 5,000 unique transformations/month. If the quota is exceeded (or the toggle is off), the
client falls back to the original image URLs automatically – images never break, they are just
unoptimized.

### E. Secrets & vars

**Secrets** (sensitive – `wrangler secret put NAME`, prompts for value):

```powershell
wrangler secret put AUTH_SECRET          # openssl rand -base64 32
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET  # only if using Google
wrangler secret put R2_ACCESS_KEY_ID      # presigned uploads (issue #107)
wrangler secret put R2_SECRET_ACCESS_KEY  # presigned uploads (issue #107)
wrangler secret put ADMIN_EMAILS          # app admin(s), issues #150 + #213
```

`ADMIN_EMAILS` is a comma-separated email list, matched case-insensitively against the session
user's email (`src/lib/server/admin.ts`). It is a secret rather than a `wrangler.jsonc` var to keep
a personal address out of git — the repo is slated to go public (§7). Consequence: a fresh Worker
created from the config alone will NOT have it, and `isAppAdmin()` then silently returns `false`
everywhere, disabling the reserved-list revert-to-draft and the admin reservation release with no
error. Re-run the line above after any re-provision. Unset it to remove all admins; changing admins
does not need a redeploy.

**Plain vars** (non-sensitive – add a `"vars"` block to `wrangler.jsonc`):

```jsonc
"vars": {
  "ORIGIN": "https://prejemesi.cz",
  "PUBLIC_R2_URL": "https://images.prejemesi.cz", // PUBLIC_: client reads it too
  "R2_ACCOUNT_ID": "<account-id>",
  "R2_BUCKET_NAME": "prejemesi-images",
  "EMAIL_FROM": "Přejeme si <noreply@prejemesi.cz>",
  "GOOGLE_CLIENT_ID": "..."   // optional; not secret
}
```

`ORIGIN` **must** be your production URL – auth redirects and email links derive from it (else links
point to localhost).

### F. Confirm the build tooling

`package.json` retains a direct deploy command for controlled recovery work, but normal production
releases must use the gated GitHub workflow in `docs/DEPLOYMENT.md`. Do not run the direct command
as a shortcut around exact-SHA checks, database reconciliation, or environment approval.

### G. Production migrations

Use generated migrations for production. The committed history lives in `drizzle/`. Create the
gitignored `.env.production` with the direct Neon URL, then reconcile before every deployment:

```bash
pnpm db:verify:prod
```

If the result is PENDING, review and authorize every listed SQL file before applying it:

```bash
pnpm db:migrate:prod -- --yes
pnpm db:verify:prod
```

The final result must be EXACT. DRIFT blocks migration and deployment. Never migrate through
Hyperdrive, `db:push`, or seeding.

### H. First deploy

Follow the gated `dev` → `production` release procedure in `docs/DEPLOYMENT.md`, including the
production database gate and explicit GitHub environment approval.

Current production Cloudflare resources:

- Worker: `prejemesi`
- Custom domains: `prejemesi.cz`, `www.prejemesi.cz`
- Hyperdrive: `prejemesi-db` / `d7f44cea901644ab84ea75b59b9f3118`
- R2 bucket: `prejemesi-images`
- R2 custom domain: `images.prejemesi.cz`

### I. Custom domain

Custom domains are configured in `wrangler.jsonc` under `routes` with `custom_domain: true`.
Cloudflare creates the DNS records and certificates on deploy.

### J. Resend

Add + verify your sending domain in Resend (DNS records), create an API key → that's
`RESEND_API_KEY`. Until verified you can use the sandbox `onboarding@resend.dev` (the default
fallback), but it only sends to your own address.

Current production sender: `Přejeme si <noreply@prejemesi.cz>`.

DMARC is not managed by the app. Add this Cloudflare DNS TXT record:

```txt
_dmarc.prejemesi.cz "v=DMARC1; p=none; adkim=s; aspf=s"
```

Start with `p=none` for monitoring, then tighten to `quarantine`/`reject` after confirming
legitimate mail passes SPF/DKIM alignment.

### K. Google OAuth (if used)

In Google Cloud console add the authorized redirect URI:
`https://prejemesi.cz/api/auth/callback/google`.

### L. Production auth hardening

`src/lib/server/auth.ts` is production-hardened:

- `requireEmailVerification: true`
- `sendOnSignUp: true`

### M. Production site hygiene

`src/hooks.server.ts` handles global production hygiene:

- `www.prejemesi.cz` redirects to canonical `https://prejemesi.cz` with HTTP 308.
- Auth, BetterAuth API, app-private routes, `/learn`, and every bearer-link wishlist URL (exact
  `/w/:id`, localized variants, and child routes) emit the response header
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- Wishlist pages retain their Open Graph and Twitter metadata so shared links still unfurl. They are
  omitted from sitemaps until an explicit, revocable publication mode exists.
- Security headers are applied to all routes, including `/api/auth/*`.
- `/learn` is development-only and returns 404 in production.

---

## 4. Development workflow (day-to-day)

| Command          | Runtime                             | DB                    | R2                    | Use for                       |
| ---------------- | ----------------------------------- | --------------------- | --------------------- | ----------------------------- |
| `pnpm dev`       | Vite (Node)                         | local Docker Postgres | in-memory fallback    | **Default** – fast HMR        |
| `pnpm preview`   | **real Workers runtime** (wrangler) | local or `--remote`   | real R2 if `--remote` | Verify prod-matching behavior |
| `pnpm db:studio` | –                                   | Drizzle Studio GUI    | –                     | Inspect/edit data             |

**Local DB loop:**

```powershell
pnpm db:start   # docker compose: postgres:17 on :5432
pnpm db:push    # create schema
pnpm db:seed    # test accounts (martin@test.cz etc., pwd: password123)
pnpm dev
```

Keep `.env`'s `DATABASE_URL` pointed at the local Docker DB
(`postgres://root:mysecretpassword@localhost:5432/local`). The app auto-detects: no Hyperdrive/R2
bindings locally → falls back to `DATABASE_URL` + in-memory image store. So **local dev needs zero
Cloudflare access**. The internal ingestion endpoint is the exception: it fails closed when the
Workers rate-limit binding is unavailable; use `pnpm preview` when locally exercising that endpoint.

To test against **real Cloudflare bindings** locally: `wrangler dev --remote` (after `vite build`) –
uses the actual Hyperdrive + R2. Local Wrangler simulates the `GIFT_INGESTION_RATE_LIMIT` binding
declared in `wrangler.jsonc`; production counters span isolates at a Cloudflare location and
synchronize approximately across locations. Run `pnpm cf:types` after changing bindings to
regenerate types.

---

## 5. Deploy / CI-CD

Production deploys are **gated GitHub Actions** (issue #110): pushing to the `production` branch
runs the full check suite for the exact commit, then waits for the `production` environment approval
before `wrangler deploy`. The full pipeline, the expand → migrate → deploy → contract migration
sequence, and rollback are documented in **`docs/DEPLOYMENT.md`**.

Do not use `pnpm run deploy` as a production shortcut. Recovery deployments still use the gated
workflow or the documented rollback procedure so the exact SHA, database state, approval, and
deployed Worker identity remain auditable.

---

## 6. Maintaining it going forward

- **Schema changes:** edit `schema.ts` → `pnpm db:generate` → review SQL → follow the reconciliation
  and gated release procedure in `docs/DEPLOYMENT.md`. Use `pnpm db:push` only for local development
  iteration, never production.
- **Secrets rotation:** `wrangler secret put NAME` creates a new version + deploys immediately. List
  with `wrangler secret list`.
- **Logs / debugging prod:** `wrangler tail` for live logs; enable **Observability** on the Worker
  in the dashboard for retained logs + metrics.
- **Hyperdrive caching gotcha:** Hyperdrive caches `SELECT`s (~60s default). With auth/session data
  this can serve briefly stale reads. better-auth already has a 5-min session cookie cache, so
  usually fine – but if you see stale data, disable Hyperdrive query caching
  (`wrangler hyperdrive update <id> --caching-disabled` or `caching: { disabled: true }`). Writes
  are never cached.
- **Free-tier ceilings:** Workers 100k req/day, Resend 100 emails/day, Neon compute hours, R2 10 GB.
  All have dashboards.
- **Neon cold starts:** after ~5 min idle the first request pays 300–800ms. Acceptable for a family
  app; Neon has a paid always-on option if needed.

---

## 7. Before flipping the GitHub repo to public 🔒

- ✅ `.env` is gitignored; only `.env.example` is tracked (no real secrets).
- ⚠️ **Scan git history** for any secret ever committed: `pnpm dlx @secretlint/secretlint "**/*"` or
  run `gitleaks detect`. If anything turns up, rotate it (it's permanently in history).
- Dev secrets in `compose.yaml`/`.env.example` (`mysecretpassword`, local-only) are harmless to
  expose.
- After making public, confirm no Cloudflare/Neon/Resend/Google keys appear in any committed file.

---

## Quick reference – code-side changes (no account access needed)

These can be applied in a commit without any Cloudflare login:

1. Confirm the `deploy` script in `package.json`
2. Uncomment/template the `hyperdrive` + `vars` blocks in `wrangler.jsonc`
3. Flip the two production auth flags in `src/lib/server/auth.ts`
4. Review the generated `drizzle/` baseline before running it against Neon

Account-side steps (Neon, Hyperdrive create, secrets, domains) require your login.
