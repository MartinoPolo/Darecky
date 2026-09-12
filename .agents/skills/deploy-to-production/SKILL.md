---
name: deploy-to-production
description: Release Přejeme si from dev to production through its gated GitHub workflow.
disable-model-invocation: true
argument-hint: '[optional release description or PR number]'
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion
metadata:
    author: MartinoPolo
    version: '0.2'
    category: deployment
---

# Deploy to Production

Run a gated release from remote `dev` to `production`. Treat `docs/DEPLOYMENT.md`,
`.github/workflows/deploy.yml`, and `scripts/migrate-prod.ts` as the sources of truth. Use remote
refs and an exact-SHA clean checkout so unrelated local changes never enter the release. Never print
credentials, connection URLs, tokens, or production data.

## 1. Qualify the Release

1. Read the three sources of truth above.
2. Fetch the remote and resolve the repository with `gh repo view --json nameWithOwner`.
3. Compare `origin/production..origin/dev` and inspect every changed path and commit.
    - If changes exist, continue with a `dev` → `production` release PR.
    - If no changes exist and the user explicitly requested a redeploy, pin the current
      `origin/production` SHA and use the manual-dispatch path below.
    - Otherwise stop: there is nothing to release.
4. Record the current production SHA and Worker version as the rollback target.
5. Run `pnpm check:migrations` at the candidate tree. Classify added `drizzle/*.sql` files, but
   never infer production database state from this diff. A modified or deleted existing migration is
   a blocker requiring a forward migration or explicit recovery plan.
6. Identify runtime variable and secret changes without reading or printing secret values. Verify
   every required name in the correct GitHub or Cloudflare scope. For identity-bearing settings such
   as `ADMIN_EMAILS`, confirm the intended production user exists and is eligible.
7. Confirm CI passed for the exact final candidate SHA.
8. Query the GitHub `production` environment and its branch policies:

    ```bash
    gh api repos/{owner}/{repo}/environments/production \
      --jq '{protection_rules, deployment_branch_policy}'
    gh api repos/{owner}/{repo}/environments/production/deployment-branch-policies \
      --jq '.branch_policies[] | {name, type}'
    ```

    Require a reviewer and exactly the `production` branch policy. Missing controls are a hard stop:
    restore them from `.github/production-environment.json`, verify both API responses, and require
    a new run to wait for approval.

Qualification is complete only when the report names the candidate SHA, rollback target, commit/file
delta, migration-file delta, manifest integrity result, required configuration changes, green CI
run, and verified environment gate. Production migration status is deliberately still unknown until
checked against Neon.

## 2. Stabilize the Release PR

1. Reuse the open `dev` → `production` PR or create one.
2. Confirm production contains no unique content; `git diff origin/dev...origin/production` must be
   empty before syncing.
3. If the PR is behind, update it:

```bash
gh api -X PUT repos/{owner}/{repo}/pulls/{pr}/update-branch
```

4. Wait for checks on the final head SHA, then repeat release classification if syncing changed the
   tree.
5. Require the PR to be mergeable and every required check green.
6. Present the PR, final head SHA, user-visible scope, migration-file delta, configuration changes,
   rollback target, and expected production hold point. Obtain explicit confirmation before merging
   unless the user already authorized this exact release scope.
7. Provision authorized missing settings, then recheck their names and confirm the live
   `GIT_COMMIT_SHA` still identifies the recorded rollback version.

## 3. Fix the Production SHA and Hold Deployment

For a normal release:

1. Merge the release PR with a merge commit; never squash.
2. Fetch `origin/production` and record the resulting merge SHA.

For an explicitly requested redeploy with no source delta:

```bash
gh workflow run deploy.yml --ref production
```

Then:

1. Locate the `Deploy (production)` run for the exact production SHA.
2. Require `verify` and `migration-review` to succeed for that SHA.
3. Confirm `deploy` is waiting for production environment approval. If deployment started without a
   hold, treat the gate as broken, restore protection, and assess rollback before continuing.
4. Read the migration step summary. Its success validates committed files only; it does **not**
   prove that Neon is current.

## 4. Reconcile and Migrate Neon for Every Release

This gate applies to schema releases, code-only hotfixes, and manual redeployments.

1. Use a clean checkout at the exact production SHA. The current checkout is acceptable only if it
   is clean and already at that SHA; otherwise use a temporary isolated checkout. Make the
   gitignored `.env.production` available without echoing its contents, and remove any temporary
   credential copy during cleanup.
2. Confirm the file targets the direct Neon host. Never use a pooled `-pooler` URL, Hyperdrive,
   `db:push`, or seeding.
3. Run:

```bash
pnpm db:verify:prod
```

4. Act on the result:
    - **EXACT:** record the output and continue.
    - **PENDING:** record every listed tag. Review every corresponding SQL file against the
      currently running app, including pending migrations from earlier releases. Require expand
      compatibility and explicit authorization for the listed production mutation, then run:

        ```bash
        pnpm db:migrate:prod -- --yes
        pnpm db:verify:prod
        ```

        The second command must report **EXACT**.

    - **DRIFT:** stop. Do not migrate or approve. Investigate the hash/timestamp/order mismatch and
      obtain an explicit forward recovery plan.

A successful migrator exit without the final EXACT result is a failure. Never skip this step because
the current diff contains no new migration file.

## 5. Approve the Exact Deployment

Present the exact run URL/SHA, final **EXACT** migration result, configuration evidence, and
rollback target. The normal action is for the required reviewer to approve in GitHub.

An agent authenticated through the owner's `gh` credentials must not approve by default. GitHub
cannot distinguish that agent from the owner. The agent may approve only after the user explicitly
authorizes the exact pending run and SHA after seeing the final evidence. Then query the environment
ID and approve:

```bash
environment_id=$(gh api \
  repos/{owner}/{repo}/actions/runs/{run-id}/pending_deployments \
  --jq '.[0].environment.id')
gh api --method POST \
  repos/{owner}/{repo}/actions/runs/{run-id}/pending_deployments \
  -F "environment_ids[]=$environment_id" \
  -f state=approved \
  -f comment='Migration history EXACT for {production-sha}'
```

If exact authorization is absent or the account cannot approve, provide the pending run URL to the
required reviewer and resume only after approval.

## 6. Verify the Release

1. Wait for workflow completion and inspect the deploy log for the Worker version and
   `GIT_COMMIT_SHA` assignment.
2. Require the GitHub environment deployment, live Worker version, Worker `GIT_COMMIT_SHA`, and
   workflow head to identify the same production SHA.
3. Confirm `https://prejemesi.cz` responds and exercise the smallest production smoke path covering
   the release. Do not create production users or mutate user data unless explicitly authorized.
4. Inspect a bounded `wrangler tail` window, Sentry, and relevant Cloudflare metrics for new errors
   without retaining tokens, query strings, identities, or request data.
5. Report the release PR or manual dispatch, production SHA, workflow URL, Worker version, migration
   result, smoke result, and rollback target.
6. Remove temporary credential copies/checkouts and confirm the original checkout was not changed.

## Rollback

If deployment or smoke verification fails, preserve the failing run URL and UTC window. Select the
recorded pre-release Worker version and obtain explicit rollback approval unless rollback was
already authorized. Roll back the app while leaving additive migrations in place, then repeat
identity, endpoint, smoke, and error checks. Contract migrations are irreversible and belong only in
a later release after the old app no longer uses the contracted objects.
