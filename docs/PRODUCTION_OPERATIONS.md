# Production operations

Operational runbook for `prejemesi` on Cloudflare Workers, Hyperdrive/Neon, R2, and Resend.
Dashboard configuration is account-side work: verify each control in production; this document does
not claim it is already enabled.

## Telemetry and privacy

### Dashboard paths

| Need                      | Dashboard path                                                         | Use                                                                           |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Worker traffic and limits | **Workers & Pages > prejemesi > Metrics**                              | Requests, CPU, duration, errors, invocation outcome, and deployment version   |
| Retained safe events      | **Workers & Pages > prejemesi > Observability > Events / Invocations** | Filter custom events by UTC window, route ID, outcome, and deployment version |
| Live debugging            | `pnpm exec wrangler tail prejemesi`                                    | Short-lived confirmation only; do not treat as retained evidence              |
| Hyperdrive                | **Hyperdrive > prejemesi-db > Metrics**                                | Query count, errors, latency, cache status, and connection-pool pressure      |
| WAF and rate limiting     | **Security > Security rules**; results under **Security > Events**     | Confirm rule matches and mitigations before Worker execution                  |
| Turnstile                 | **Turnstile > prejemesi > Analytics**                                  | Siteverify success/failure and challenge traffic                              |
| Application errors        | **Sentry > Issues / Replays**                                          | Grouped browser and Worker errors, stack traces, and privacy-masked replays   |

Workers Logs Free retains 200,000 log events/day for three days. Configure production for 10% head
sampling (`head_sampling_rate: 0.1`) and custom events. Keep automatic invocation logs disabled
because they include the raw request URL and could retain reset, invitation, or authentication
tokens from query strings.

Retain only these custom records:

- `phase: start`: SvelteKit route ID, method, deployment version.
- `phase: complete`: SvelteKit route ID, method, status, outcome, duration in milliseconds,
  deployment version.

Use route templates such as `/w/[id]`, never the concrete path. Never log raw URLs or query strings,
request/response bodies, headers, cookies, credentials, tokens, email addresses, names, uploaded
content, database statements, or form values. `deploymentVersion` identifies the deployed Worker
version, not a Git secret or user. The privacy tradeoff is deliberate: a killed invocation may have
only a sampled start record. Classify its platform outcome in Workers Metrics, then correlate by UTC
time, deployment version, and route start.

For every incident, record: UTC start/end, client-visible code, Metrics outcome, affected route ID,
deployment version, request/error counts, mitigation, and recovery time. Use this telemetry for
application exceptions, platform limits, and edge mitigation. Use Sentry for retained application
stack traces and proactive notifications; keep Cloudflare telemetry for platform outcomes and
resource-limit diagnosis.

### Sentry

The production deployment requires the following GitHub `production` environment settings:

- Variable `PUBLIC_SENTRY_DSN`: public runtime DSN used by the browser and Worker.
- Variable `SENTRY_ORG`: source-map organization slug, `martin-poloch`.
- Variable `SENTRY_PROJECT`: source-map project slug, `prejemesi` (display name `Prejemesi`).
- Secret `SENTRY_AUTH_TOKEN`: build-only token with release/source-map upload permission.

The deployment fails before building if any setting is absent and is the only workflow that enables
source-map uploads. `SENTRY_AUTH_TOKEN` must never be placed in Worker variables, client code, logs,
or committed files. The build release and Worker runtime release are both the deployed Git commit
SHA, allowing Sentry to resolve minified production frames with the matching uploaded source maps.

Error events disable user identity, cookies, headers, query parameters, HTTP bodies, database
values, and stack-frame variables. Additional event filtering removes user objects, request details
beyond method and path, sensitive custom keys, and email addresses. Session Replay is enabled during
the Sentry trial for 10% of sessions and all sessions containing a captured error; all text and
inputs are masked, user-facing and link/source/value attributes are masked, hidden inputs and media
are blocked, and network bodies and headers are not recorded. Replays stop and are discarded on
authentication routes, token-bearing routes, and URLs with query strings. Error-triggered buffering
resumes after navigation back to a safe route; regular session sampling resumes on the next page
load. Review the sampling rates and retained data before the trial ends.

Configure an issue alert in Sentry for new and regressed `error` or `fatal` issues in the
`production` environment, then verify the notification recipient. After deployment, create one
controlled browser error and one authenticated Worker error, confirm both issues use the deployed
release and readable source maps, inspect the associated replay for masking, and remove the test
trigger. Do not expose a permanent public error-generation route.

## Resource-limit incident procedure

1. Preserve evidence: note UTC window, deployment version, affected route, and the Cloudflare Ray ID
   shown to the client, if available. Do not paste tokens, emails, form data, or request bodies into
   the incident record.
2. Open Worker **Metrics**, select the window and version, then inspect Errors, invocation outcomes,
   CPU, memory, and request count. Correlate sampled safe logs and Hyperdrive Metrics for the same
   window.
3. Classify with the table below. If uncertain, reduce abusive/expensive traffic first, preserve the
   current production data, and then investigate.
4. After mitigation, repeat the affected flow and watch the same dashboards for at least 15 minutes.
   Record recovery and follow-up work.

| Incident                    | Evidence                                                                                                                                                                                       | Immediate mitigation                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU                         | Client `1102`; Metrics/Logs outcome `exceededCpu`; CPU spike on one route/version. Free limit: 10 ms CPU per invocation.                                                                       | Roll back the regressing version. Temporarily challenge/block the expensive route. Remove synchronous parsing/rendering or repeated work; move work behind I/O or split it. Upgrade only if the workload genuinely cannot fit after optimization.                 |
| Memory                      | Client `1102`; outcome `exceededMemory`; memory spike. Limit: 128 MB per isolate.                                                                                                              | Roll back. Stop the triggering upload/import route at the edge. Remove full-body/full-result buffering, stream or bound payloads, and reduce concurrent in-memory work before redeploying.                                                                        |
| Startup                     | Deploy fails with `10021`, including startup CPU or memory validation; limit: 1 second and 128 MB at top level.                                                                                | Existing good version remains the recovery target. Move expensive top-level initialization into lazy request scope, reduce imports/generated data, rebuild, and redeploy. Do not route traffic to the rejected version.                                           |
| Daily Worker requests       | Client `1027`; daily request graph reaches 100,000. Resets at `00:00 UTC`.                                                                                                                     | Stop crawlers/load tests, enable or tighten the WAF/rate rule, and remove request amplification. Keep fail-closed behavior for auth/data paths. If service must recover before reset, move to Workers Paid after confirming the traffic is legitimate.            |
| Daily Hyperdrive statements | Hyperdrive Metrics reaches 100,000 statements; DB-backed routes fail while non-DB responses may work. Every `SELECT`, mutation, DDL statement, and cached query counts. Resets at `00:00 UTC`. | Challenge/block the responsible route, stop load tests, reduce repeated reads/refresh cascades, and inspect cache/query count. Do not bypass Hyperdrive with an unreviewed production connection. Upgrade Workers if legitimate traffic must resume before reset. |

Cloudflare `Exceeded Resources` can aggregate CPU, memory, startup, and daily limits. Do not
classify from that label alone; use the specific outcome/code, deployment status, quota graph, and
correlated route record. Check [Cloudflare Status](https://www.cloudflarestatus.com/) before
attributing an `internalError` spike to application code.

## Edge protection

### WAF bot-probe rule

Free supports five custom WAF rules and no regular expressions. Use one custom rule named
`Block common bot probes`, action **Block**, with this case-insensitive expression. It mirrors the
fallback guard in `src/hooks.server.ts` exactly:

```text
(lower(http.request.uri.path) eq "/xmlrpc.php") or
(lower(http.request.uri.path) eq "/.env") or
(lower(http.request.uri.path) eq "/phpinfo.php") or
starts_with(lower(http.request.uri.path), "/wp-") or
starts_with(lower(http.request.uri.path), "/wp/") or
starts_with(lower(http.request.uri.path), "/wordpress/") or
starts_with(lower(http.request.uri.path), "/phpmyadmin") or
starts_with(lower(http.request.uri.path), "/pma/") or
starts_with(lower(http.request.uri.path), "/.git/")
```

Verification:

1. Request `/xmlrpc.php?probe=<UTC timestamp>` and one prefixed path such as
   `/wp-admin?probe=<UTC timestamp>`. Expect the Cloudflare block response.
2. Confirm both matches in **Security > Events** at that UTC time.
3. Search Worker Observability for the same time and route. There must be no custom record with
   `phase: start` or `phase: complete`: WAF ran before Worker invocation. Also confirm Worker
   request count did not increase for the probes.
4. Request `/` and one public `/w/<test-id>` path to confirm ordinary traffic is unaffected. Retain
   the in-app guard as defense in depth.

### One Free rate-limit rule

The Free plan permits one rate-limiting rule. Configure exactly one rule named
`Protect dynamic Worker traffic`:

| Setting                 | Value                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Match                   | Path starts with `/api/` **OR** `/_app/remote/`; **AND Verified Bot is false**                                               |
| Expression              | `(starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/_app/remote/")) and not cf.client.bot` |
| Counting characteristic | IP                                                                                                                           |
| Threshold               | 20 requests per 10 seconds                                                                                                   |
| Action                  | Managed Challenge                                                                                                            |
| Mitigation timeout      | `0` (challenge/throttle mode required on Free)                                                                               |

Twenty requests/10 seconds/IP is a starting hypothesis, not measured capacity. It covers BetterAuth,
upload/API, and SvelteKit remote-function traffic without counting ordinary page/static-asset
requests. Shared NAT users still share the IP counter, so validate before lowering it.

Verification:

1. From one browser/IP, complete normal interactive flows: sign in, open a wishlist,
   reserve/unreserve a test gift, and upload a permitted test image. No challenge should interrupt
   ordinary use.
2. From a test client/IP, send one controlled burst above 20 matching requests within 10 seconds.
   Excess requests should receive a Managed Challenge; stop after confirming it once. Do not use
   production data mutations for the burst.
3. Confirm the match in **Security > Events**, then confirm fewer excess requests reached Worker
   Metrics/Logs. Complete the challenge, then confirm ordinary interactive requests succeed again.
4. Review false positives and peak legitimate per-IP rate after 24 hours and one week. Raise the
   threshold if ordinary use is challenged; lower only with measured headroom and repeat this
   verification.

## Turnstile

Protect registration, password sign-in, password-reset request, and anonymous reservation. The
widget is only the client signal; every protected server operation must enforce Siteverify before
email, database, or reservation work.

1. In **Turnstile > Add widget**, create a Managed widget for `prejemesi.cz` (and `www.prejemesi.cz`
   while it remains a routed hostname). Copy sitekey and secret separately.
2. Set `PUBLIC_TURNSTILE_SITE_KEY` as a non-secret deploy variable. Store `TURNSTILE_SECRET_KEY`
   only as a Cloudflare secret:

    ```powershell
    pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
    ```

    `wrangler.jsonc` sets `keep_vars: true`, so deployments preserve the dashboard-managed site key
    and secrets.

3. Render the widget on all five protected surfaces and submit its token with the
   form/remote-function payload.
4. On the server, call `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with the
   secret and token. Require `success: true`. The Turnstile widget hostname allowlist constrains
   token issuance to the production domains. Reject missing, invalid, expired, or replayed tokens
   before side effects.
5. Tokens expire after five minutes and are single-use; reset the widget after an error. Never
   expose or log the secret or token. Use Cloudflare's documented test keys outside production.
6. Verify each surface accepts one valid token and rejects missing, malformed, expired, and replayed
   tokens. Confirm failed validation creates no user, email, reset request, or reservation. Check
   Turnstile Analytics without copying personal form fields into logs.

## Smart Placement experiment

Smart Placement is an experiment, not a permanent default until measured.

1. Before enabling, record UTC window, deployment version, placement status, representative
   DB-backed routes, request volume, custom-log duration p50/p95/p99, error rate, and Hyperdrive
   query/connection latency. Use a normal traffic window that can be repeated.
2. Enable **Workers & Pages > prejemesi > Settings > General > Placement > Smart** (or deploy
   `placement.mode: "smart"`). Record the new deployment version.
3. Send consistent, representative traffic for at least 15 minutes. Include the same login,
   dashboard, public wishlist, and reservation reads used for the baseline; avoid quota-consuming
   stress traffic.
4. Check placement status. `SUCCESS` means analyzed; `INSUFFICIENT_INVOCATIONS` needs more
   consistent traffic; `UNSUPPORTED_APPLICATION` means Cloudflare detected regression and reverted.
5. In Worker Metrics, compare request-duration analytics for placed traffic with the 1% unplaced
   control, plus the same-route before/after p50/p95/p99, errors, and Hyperdrive latency. Keep Smart
   only if error rate does not rise and request duration is no worse, with a repeatable improvement.
   Disable it and redeploy on any sustained request-duration or error regression.
6. Record the decision below. Never replace `Pending` with a result until the production deployment
   and measurement actually occurred.

### Result record

| Field                               | Baseline                       | Smart Placement                            |
| ----------------------------------- | ------------------------------ | ------------------------------------------ |
| Status                              | Pending production baseline    | Pending deployment and measurement         |
| UTC window                          | Pending                        | Pending                                    |
| Deployment version                  | Pending                        | Pending                                    |
| Placement status                    | Disabled / confirm before test | Pending                                    |
| Consistent traffic duration         | Pending                        | Pending (minimum 15 minutes)               |
| Routes and request count            | Pending                        | Pending                                    |
| Request duration p50/p95/p99        | Pending                        | Pending                                    |
| Error rate                          | Pending                        | Pending                                    |
| Hyperdrive query/connection latency | Pending                        | Pending                                    |
| Decision                            | -                              | **Pending - do not retain until measured** |

## Free-tier limits

Verified against primary provider documentation on **2026-07-12**. Recheck before capacity planning;
provider limits can change.

| Service            | Current Free allowance                                                                                                                     | Reset / consequence                                                                                                                           | Primary source                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers | 100,000 dynamic requests/day; 10 ms CPU/invocation; 128 MB/isolate; 1 s startup; 50 subrequests/invocation                                 | Requests reset 00:00 UTC; excess daily requests return `1027`; CPU/memory exhaustion can return `1102`; startup validation can return `10021` | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)                                                                                  |
| Hyperdrive         | 100,000 database statements/day; every statement counts, including cached queries and mutations                                            | Resets 00:00 UTC; further operations fail after quota                                                                                         | [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/), [limits](https://developers.cloudflare.com/hyperdrive/platform/limits/) |
| Neon Free          | Up to 100 projects; 100 CU-hours/month and 0.5 GB storage per project; autoscale up to 2 CU / 8 GB RAM; 5 GB public network transfer/month | Monthly allowances; compute suspends when idle                                                                                                | [Neon pricing](https://neon.com/pricing), [network transfer](https://neon.com/docs/introduction/network-transfer)                                             |
| R2 Standard        | 10 GB-month storage; 1 million Class A and 10 million Class B operations/month; free Internet egress                                       | Monthly allowances; charges apply above them after billing is enabled                                                                         | [R2 pricing](https://developers.cloudflare.com/r2/pricing/)                                                                                                   |
| Resend Free        | 3,000 emails/month; 100/day; each recipient counts; 5 API requests/second                                                                  | Daily and monthly quotas; sends/API calls are rejected or rate-limited above quota                                                            | [Account quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [pricing](https://resend.com/pricing)                                     |

Related Cloudflare references:
[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/),
[Workers errors](https://developers.cloudflare.com/workers/observability/errors/),
[WAF custom rules](https://developers.cloudflare.com/waf/custom-rules/),
[rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
and [Smart Placement](https://developers.cloudflare.com/workers/configuration/placement/).
