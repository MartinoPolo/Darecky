# Production Deployment Runbook

How a commit reaches the production Worker, and how schema changes ship safely (issue #110).
Provisioning and service setup live in `CLOUDFLARE_SETUP.md`.

## The gated pipeline

Merging `dev` → `production` (or a manual **Deploy (production)** dispatch) triggers
`.github/workflows/deploy.yml`:

1. **verify** — runs the full reusable check suite (`.github/workflows/checks.yml`, called with
   `run_e2e: true`) for the exact commit being deployed: formatting, oxlint, stylelint, fallow,
   svelte-check, eslint, migration safety, unit + browser-mode vitest, and the Playwright e2e suite
   against a Postgres service. A commit with any failing check never reaches the deploy job. (PRs
   and `dev` pushes run the same suite via `ci.yml`, also called with `run_e2e: true`, so e2e runs
   there too; this `verify` step re-runs it to pin the exact deployed commit.)
2. **migration-review** — validates the complete committed migration journal and SQL files, then
   writes a step summary. It has no production database credentials and therefore cannot prove that
   Neon is current. Its success is only a repository integrity check; production reconciliation
   remains mandatory for every release.
3. **deploy** — waits for the GitHub **`production` environment approval** (required reviewer: repo
   owner; restricted to the `production` branch). After approval it builds and runs
   `wrangler deploy`.

The deployed commit is recorded three ways: in the environment's deployment history (GitHub →
Environments → production), in the workflow step summary, and as a `GIT_COMMIT_SHA` plain-text var
on the Worker.

### PR and `dev` merge gate

Pull requests targeting `dev` (and `dev` pushes) run the reusable checks through `ci.yml`, now
called with `run_e2e: true` — so the full suite **including the Playwright e2e job** runs on every
PR and `dev` push. Branch protection requires the stable `checks / required` aggregator, which fails
if the static/unit checks fail or (when `run_e2e: true`) if e2e fails. Feedback is slower than the
old e2e-skipped setup, but regressions are caught before the merge rather than only at the
production deploy gate.

If the reusable workflow's caller or aggregator job name changes, update the branch protection
status check on both `dev` and `production` at the same time.

Production protection also requires `checks / required`: release PRs (`dev` → `production`) run
`ci.yml` the same way, so the same aggregator gates the merge. The production **push** then re-runs
the suite through `deploy.yml`'s `verify` job before the environment-approval deploy step.
(Historically this required `verify / required`, a status that only appears on the production push,
never on the release PR — so it could never be satisfied pre-merge; it was repointed to
`checks / required`.)

Production protection is **strict** (branch must be up to date) and applies to admins, so every
release PR opens as `BEHIND`: merging `dev` → `production` leaves the merge commit only on
`production`, so `dev` always lacks it by the next release. Sync before merging — GitHub's **Update
branch**, or:

```powershell
gh api -X PUT repos/MartinoPolo/prejemesi/pulls/<pr>/update-branch
```

This merges `production` back into `dev` and re-triggers the PR checks; do it **before** waiting on
CI so the suite runs once, on the final merged tree. `BEHIND` here carries no unique content —
verify with `git diff origin/dev...origin/production` (expected: empty). Merge the release with a
**merge commit**, never squash: squashing rewrites the shared commits and breaks the ancestry (see
`b31fe5b`).

Environment approval is configured under **Settings → Environments → production** (required
reviewer + branch policy). A missing reviewer or production-only branch policy is a release blocker:
restore both controls, verify them through the API, and start a new run that demonstrably waits for
approval. The controls can be recreated with:

```bash
gh api -X PUT repos/MartinoPolo/prejemesi/environments/production \
  --input .github/production-environment.json
gh api -X POST repos/MartinoPolo/prejemesi/environments/production/deployment-branch-policies \
  -f name=production -f type=branch
gh api repos/MartinoPolo/prejemesi/environments/production \
  --jq '{protection_rules, deployment_branch_policy}'
gh api repos/MartinoPolo/prejemesi/environments/production/deployment-branch-policies \
  --jq '.branch_policies[] | {name, type}'
```

The final command must list only the `production` branch policy. The tracked environment payload
intentionally keeps `prevent_self_review` disabled because the repository has a single required
reviewer; the separate exact-run authorization rule below prevents agents from treating shared owner
credentials as implicit approval.

The normal approval is a human action in GitHub. An agent authenticated as the required reviewer can
also approve through `gh`; GitHub cannot distinguish that agent from the account owner. The agent
may do so only after the user explicitly authorizes the exact run and SHA after seeing the final
migration evidence:

```bash
environment_id=$(gh api \
  repos/MartinoPolo/prejemesi/actions/runs/<run-id>/pending_deployments \
  --jq '.[0].environment.id')
gh api --method POST \
  repos/MartinoPolo/prejemesi/actions/runs/<run-id>/pending_deployments \
  -F "environment_ids[]=$environment_id" \
  -f state=approved \
  -f comment='Migration history EXACT for <production-sha>'
```

Without that exact authorization, the agent stops at the pending deployment and provides its URL for
the required reviewer to approve manually.

## Database gate: reconcile → migrate → verify → deploy

Migrations are intentionally **manual** and run against the **direct Neon URL** (never through
Hyperdrive, never `db:push`, never seeding). Reconcile production before **every** deployment,
including code-only hotfixes and manual dispatches. A diff containing no new SQL does not prove that
an earlier migration was applied.

Use a clean checkout at the exact production SHA. `.env.production` is gitignored, so confirm that
the checkout can read the existing file without printing or copying its value into logs. The URL
must be PostgreSQL, belong to Neon, use the direct (non-`-pooler`) hostname, and match the
production host/database fingerprint pinned in the verifier. Credentials may rotate without changing
that target identity.

```bash
pnpm db:verify:prod
```

The verifier validates the complete journal and SQL hashes, then compares them with
`drizzle.__drizzle_migrations`:

- **EXACT** — the database ledger exactly matches the target SHA; approval may proceed.
- **PENDING** — the database ledger is an exact prefix. Review every listed SQL file for
  compatibility with the currently running app, obtain migration authorization, then apply and
  verify:

    ```bash
    pnpm db:migrate:prod -- --yes
    pnpm db:verify:prod
    ```

- **DRIFT** — an applied hash/timestamp differs, history is reordered, or the ledger has unexpected
  rows. Stop; do not migrate or deploy until the discrepancy has an explicit recovery plan.

`db:migrate:prod` performs the same preflight, refuses PENDING work without `--yes`, blocks DRIFT,
runs Drizzle on the advisory-lock-owning PostgreSQL connection without a child process, redacts
database details from errors, and requires an EXACT postcondition. It is safe as a no-op when
already EXACT. A successful `migration-review` workflow job or local test database migration is
never a substitute for this production check.

Because migration runs while the previous app version is serving traffic, use the expand → migrate →
deploy → contract sequence:

1. **Expand** — additive migration only (new tables/columns, nullable or with defaults; backfills).
   Old app code must run unchanged against the new schema.
2. **Migrate and verify** — reach EXACT before approving the deployment.
3. **Deploy** — approve the environment gate; the new app version starts using the new schema
   shapes.
4. **Contract** — only in a later release, after the deployed app no longer reads the old objects:
   drop/rename in a separate migration.

Enforcement: `pnpm check:migrations` (part of `check:all` and CI) fails on destructive statements
(`DROP TABLE/COLUMN/TYPE`, `RENAME`, `TRUNCATE`, `DELETE FROM`, `SET DATA TYPE`, `SET NOT NULL`)
unless the migration tag has a nonempty rationale in `drizzle/meta/contract-migrations.json`.

The acknowledgment stays outside the SQL because Drizzle records the exact SQL hash in production.
Never add a marker comment to an applied migration. The recipient-role expand and contract
migrations demonstrate the sequence and sidecar acknowledgment.

## Rollback

- **App only:** `wrangler rollback` (or re-run the deploy workflow from the previous production
  commit). Safe whenever the contract step has not run — which the sequence above guarantees for the
  current release.
- **Schema:** contract migrations are the only irreversible step; because they ship one release
  later, the previous app version always remains deployable.

## Production release checklist

- [ ] Target SHA and rollback Worker version recorded.
- [ ] Complete migration manifest passes `pnpm check:migrations`.
- [ ] Any new migration was generated via `pnpm db:generate`, reviewed, committed, and is
      expand-compatible (or a later contract is explicitly acknowledged).
- [ ] All declared Worker bindings are present in the built/deployed config. In particular,
      `GIFT_INGESTION_RATE_LIMIT` must show the 60 requests / 60 seconds policy; ingestion fails
      closed with HTTP 503 if the binding is absent or errors.
- [ ] Any **new env var/secret** the release reads is set on the Worker (`wrangler secret list` +
      `wrangler versions view <id>`). A missing one does not fail the deploy — the feature just
      silently stays off, which is how `ADMIN_EMAILS` sat unset from #150 until the #213 release.
- [ ] Sync the release PR (`update-branch`) — it opens `BEHIND` every time.
- [ ] Merge to `production` (merge commit, not squash); wait for **verify**.
- [ ] From the exact production SHA, run `pnpm db:verify:prod` for every release.
- [ ] If PENDING, review and authorize every listed migration, run `pnpm db:migrate:prod -- --yes`,
      and verify again.
- [ ] Record an **EXACT** result before approval.
- [ ] Obtain explicit approval for the exact run/SHA; an agent does not approve through shared owner
      credentials unless specifically authorized to do so.
- [ ] Verify: https://prejemesi.cz responds; `wrangler tail` shows no errors.
