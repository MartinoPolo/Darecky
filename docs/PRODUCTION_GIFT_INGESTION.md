# Production gift ingestion

This is a purpose-specific, append-only machine integration for reviewed, versioned gift manifests.
It is scoped to one configured wishlist and uses the same transactional gift creation and
notification digest path as the UI.

## Setup and production rollout

Follow this order exactly:

1. **Establish the database safety checkpoint first.** In the Neon dashboard, verify that built-in
   history / Point-in-Time Restore is available and that its retention covers the rollout. There is
   no project-managed automatic backup. Before migration, create and retain a manual `pg_dump`
   snapshot using the direct Neon URL, and verify that the dump file is non-empty.
2. **Verify and migrate before dependent code is deployed.** Using the direct Neon URL from the
   ignored `.env.production`, run `pnpm db:verify:prod`. If it reports PENDING, review and
   explicitly authorize every listed migration, then run `pnpm db:migrate:prod -- --yes`. Run
   `pnpm db:verify:prod` again and require EXACT before approving deployment of code that reads the
   migrations. DRIFT blocks migration and deployment. Never use Hyperdrive, `db:push`, or seed.
3. **Deploy with ingestion disabled.** Keep at least one required ingestion setting absent so the
   endpoint cannot write. Deploy the dependent application code only after the migration completes.
4. **Verify the existing manual paths.** In production, add one gift through the normal UI and then
   add a small bulk/import batch. Using a non-actor follower account, verify that both paths
   create/coalesce the expected single and bulk new-gift digest behavior before enabling machine
   ingestion.
5. Create a dedicated actor account and choose the single fixed target wishlist. Then configure
   Worker secret/variables `GIFT_INGESTION_TOKEN`, `GIFT_INGESTION_TARGET_SHORT_ID`, and
   `GIFT_INGESTION_ACTOR_ID`. Confirm the deployed Worker also has the `GIFT_INGESTION_RATE_LIMIT`
   binding declared in `wrangler.jsonc` (60 requests per 60 seconds). Missing endpoint values
   disable the endpoint; a missing or failing rate-limit binding fails closed with HTTP 503. Do not
   enable ingestion before the preceding checks pass.
6. Put `GIFT_INGESTION_TOKEN` and `GIFT_INGESTION_BASE_URL` in the ignored local file
   `.env.gift-ingestion.local`. The base URL is the allowlisted exact production origin: non-local
   HTTPS with no credentials, query, fragment, or non-root path.
7. Prepare a schema-version-1 manifest whose short ID, title, and recipient exactly match the fixed
   target. Every item must have at least one gift link, and `gift.links[0].url` must exactly equal
   its `sourceUrl`. `gift.category` is optional; when present it must be user-provided or
   evidence-backed and already enabled on the fixed target wishlist. It may match an enabled custom
   label or either Czech/English label of an enabled preset. Unknown or disabled categories reject
   dry-run/apply before image preparation or insertion, and never create categories automatically.
8. Run a dry-run and inspect the resolved short ID, title, recipient, every proposed item, warnings,
   skips, and conflicts. Stop on any identity mismatch, ambiguity, or conflict.
9. Apply one controlled, reviewed gift. Verify the created gift, provenance/audit result, mirrored
   image when present, and follower digest before proceeding.
10. Only after the controlled gift passes verification, process normal batches. Continue to dry-run
    and inspect every manifest before apply.

## Threat boundaries

`POST /api/internal/v1/gift-ingestion` is the only machine operation. The bearer token grants gift
creation on only the configured wishlist. The endpoint cannot select another environment or
destination and has no GET, update, or delete operation. It accepts bounded JSON only, validates
HTTPS URLs, rejects archived targets, and does not use BetterAuth cookies. After token validation
and before reading the body, it calls Cloudflare Workers Rate Limiting with a fixed non-secret
endpoint key; denied requests return HTTP 429 without DB/R2 work. Invalid tokens never consume
quota. Canonical source duplicates are advisory skips; manual UI duplicate behavior is unchanged.

The CLI sends its bearer token only to the exact production origin allowlisted by
`GIFT_INGESTION_BASE_URL`; an explicit `--base-url` must normalize to that same origin. Database and
R2 credentials remain inside deployed infrastructure. For selected images, the CLI enforces
SSRF-safe HTTPS destinations (including DNS answers and every redirect), timeout and 5 MiB limits,
JPEG/PNG/WebP/GIF signatures, declared/actual MIME agreement, and positive dimensions. It then asks
the Worker for a manifest/item/hash-bound, short-lived presigned PUT and uploads directly to that
exact URL. The CLI receives no R2 credential.

## Durable image protocol

Image mirroring is all-or-nothing for requested images. Preparation binds the key below
`gifts/ingestion/` to wishlist, manifest, item, SHA-256 content hash, supported MIME, and byte
length. Apply accepts only the server-issued capability fields, fetches the exact staged object and
verifies key binding, byte length, content type, and SHA-256 before storing `imageKey` with default
automatic image metadata and atomically retaining each validated manifest item's bounded provenance
in `gift_ingestion_item.provenance`. Rendering does not depend on retailer hotlinks.

Dry-run never downloads or mutates R2. Identical replay returns committed gift IDs without
preparing, uploading, or deleting their images. Download, preparation, upload, or verification
failure creates no gifts and triggers best-effort cleanup of staged objects. A failed gift/audit
transaction is compensated after rollback; committed gift images are never cleaned. Cleanup failures
create bounded `gift_ingestion_orphan` rows for operations follow-up.

## Dry-run

Dry-run is the default:

```bash
pnpm ingest:gifts --manifest ./gifts.json --base-url https://prejemesi.example
```

It reports the resolved identity, category validation, `wouldCreate`, `alreadyApplied`, `skipped`,
warnings, and conflicts. It creates no gifts, audit rows, notifications, or uploads.

## Apply

Mutation requires both `--apply` and the allowlisted production origin as an explicit `--base-url`:

```bash
pnpm ingest:gifts --manifest ./gifts.json --apply --base-url https://prejemesi.example
```

Stop if dry-run reports a mismatch, ambiguity, or conflict. Apply is atomic: gift creation,
notification digest coalescing, and ingestion audit/idempotency rows commit in one transaction.
Identical item replay returns prior gift IDs; changed content under a reused item ID is rejected.

## Secret handling

Generate a unique high-entropy ingestion token. Store it as a Cloudflare Worker secret and in the
ignored local env file only. Never place it in a manifest, prompt, shell output, repository file,
browser cookie, screenshot, or log. Never reuse `AUTH_SECRET`, a BetterAuth cookie, Neon
credentials, or R2 credentials. Rotate by replacing both copies; removing any required server
configuration disables ingestion immediately.

## Rollback

Remove the ingestion token to stop machine writes. Do not delete successfully created gifts
automatically. Keep audit and idempotency rows for diagnosis. Database changes are additive and
should not be reversed by dropping production tables. If a gift itself must be removed, use the
normal authorized UI and its lifecycle rules. Never remove committed gift images during rollback.
Resolve only uncommitted keys listed in `gift_ingestion_orphan`; verify references before manual
deletion.

## Prohibited model behavior

An automation model must never generate or execute SQL, connect to Neon/R2, request database or
storage credentials, use BetterAuth cookies, choose an environment, redirect the destination
wishlist, invent product identity or price, bypass dry-run, add update/delete instructions, print
the token, or apply after a mismatch/conflict. It may create a reviewed manifest and invoke only the
fixed CLI.
