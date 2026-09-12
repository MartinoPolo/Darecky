# Gift ingestion and rolling notification digest plan

Status: approved for implementation after conversation compaction.

Implementation must happen in a separate worktree based on `dev`.

## Settled direction

- Build a purpose-specific, append-only production gift-ingestion workflow.
- A project skill accepts product URLs, gathers metadata and images, writes a versioned JSON manifest, runs a dry-run, and invokes a fixed CLI.
- The CLI calls a narrowly scoped application endpoint. It never receives Neon or R2 credentials and never generates SQL.
- CSV and manual batch entry remain supported and gain image URL and quantity fields as a reviewed fallback.
- Manual, CSV/batch, and automated gift creation all use one transactional domain service.
- New-gift notifications become one global, in-app-only digest per recipient per rolling 24-hour window.
- The skill must not use the `sk-` prefix. Use `.agents/skills/add-gifts/SKILL.md` unless a better non-`sk` name is chosen during implementation.

## Notification semantics

Use a global rolling 24-hour digest per recipient, covering gifts added manually, through CSV/batch import, or through automated ingestion.

- The first eligible gift opens a hidden digest window.
- Additional gifts during the next 24 hours join that digest, across all followed wishlists.
- When the window closes, one summarized in-app notification becomes visible.
- A new visible digest cannot occur within the same rolling 24-hour period.
- A one-wishlist digest links directly to that wishlist.
- A multi-wishlist digest links to `/followed` and displays a per-wishlist breakdown.
- Keep this notification in-app only. The existing `NEW_GIFT_ADDED` event is already in-app only.
- A `visibleAt` timestamp makes delayed visibility possible without a scheduled Worker. If email or push digests are added later, introduce a durable scheduler then.
- Preserve the existing audience rule: active followers at gift-add time, excluding the actor and linked recipient, and respecting the existing new-gift notification preference.
- Existing singular notification rows remain readable and visible.

Example copy:

> **7 nových přání na 2 seznamech**  
> Vánoce pro Martina: 5 · Narozeniny pro Rosie: 2

## Phase 1 — Shared transactional gift creation

Add `src/lib/modules/gifts/gift_creation_service.ts`.

Extract insertion behavior from:

- `createGift` in `src/lib/modules/gifts/gifts.remote.ts`
- `importGifts` and `createWishlistFromImport` in `src/lib/modules/import/import.remote.ts`

The transport-independent service must:

- Validate that the wishlist is mutable; draft and active are allowed, archived is rejected.
- Lock the wishlist while allocating append order so concurrent `MAX(sortOrder) + 1` operations cannot collide.
- Insert one or many gifts atomically.
- Accept normalized concrete fields: name, description, multiple links, price range, currency, external image URL, R2 image key, image metadata, quantity, concrete priority, and ingestion provenance where applicable.
- Append only; it must expose no update or delete behavior.
- Coalesce notification changes in the same database transaction.
- Preserve recipient/správce authorization in the remote wrappers.
- Preserve post-share behavior: adding gifts remains allowed.

Route single creation, CSV import, manual batch entry, and automated ingestion through this service.

## Phase 2 — Rolling notification digests

Create an additive Drizzle migration.

### Extend `notification`

Add nullable columns in `src/lib/server/db/notification.schema.ts`:

- `payload jsonb`
- `visible_at timestamptz`
- `dedupe_key text`, with a partial unique index for non-null values

Legacy rows keep `visibleAt = null`, meaning immediately visible.

Continue using the existing `new_gift_added` preference/type:

- Legacy rows without payload render the existing singular message.
- New rows with digest payload render a dynamic summary.
- Users who disabled new-gift notifications remain opted out.

### Add digest state

Add a `new_gift_digest_state` table:

- `user_id` primary key
- `active_notification_id`
- `window_started_at`
- `window_ends_at`

During gift insertion, lock this state row per recipient:

1. If an open window exists, update that notification's bounded payload.
2. Otherwise, create a hidden notification with `visibleAt = now + 24 hours`.
3. Point the state row at the new active window.

Keep payloads bounded:

- Total gift count.
- Per-wishlist count, title, and short ID.
- A small preview of gift names.
- No retailer HTML or unbounded metadata.

### Update notification reads

Update `src/lib/modules/notifications/notifications.remote.ts`:

- Return only rows where `visibleAt IS NULL OR visibleAt <= now()`.
- Apply the same filter to unread counts.
- Parse digest payload defensively.
- Preserve unknown/legacy notification fallback behavior.

Update `src/lib/components/blocks/notification/NotificationItem.svelte` and Czech/English messages:

- Render total and per-wishlist counts.
- Link directly to the wishlist when only one is represented.
- Link to `/followed` when several wishlists are represented.
- A digest becomes unread only once, after its window closes.
- Do not re-toggle an already delivered digest to unread.

## Phase 3 — Notification parity across creation paths

Route all applicable creation paths through digest coalescing:

- Single manual gift creation.
- Existing-wishlist CSV import.
- Manual batch entry.
- Automated production ingestion.

A new-wishlist import can skip notifications because it has no established followers.

For bulk additions, update each follower's digest once per transaction, not once per gift.

## Phase 4 — Expand CSV and batch drafts

Extend `GiftDraftInputSchema` in `src/lib/modules/gifts/types.ts` with:

- `imageUrl`
- `quantity`

Importer changes:

- Detect aliases such as `image`, `image url`, `obrázek`, and `foto`.
- Detect quantity aliases.
- Validate imported image URLs as HTTPS.
- Show an image thumbnail during review.
- Persist automatic image framing; do not import crop/focal JSON.
- Preserve current row and payload limits.
- Add server-side canonical-link duplicate warnings while retaining explicit user override in the UI.
- Continue supporting multiple link columns.

## Phase 5 — Versioned ingestion manifest

Add `src/lib/modules/ingestion/manifest.ts` with a shared Valibot schema.

The manifest must contain:

- Schema version.
- Stable `manifestId`.
- Expected wishlist short ID and identity, such as title and recipient.
- Unique stable item IDs.
- Original product source URL.
- Gathered gift fields and metadata provenance.
- Optional image source information.
- Explicit quantity and priority defaults.

Validation rules:

- HTTPS product and image URLs.
- Supported currencies.
- Positive integer quantities.
- Existing link-count, item-count, and payload limits.
- Unique item IDs.
- A non-blank name before commit.
- No update/delete instructions.

## Phase 6 — Add-only production endpoint

Add a machine integration boundary such as:

`POST /api/internal/v1/gift-ingestion`

Document this as a deliberate exception to the remote-functions-only convention.

Security controls:

- Dedicated bearer token; never use a BetterAuth browser cookie or database credential.
- Initially bind the token/configuration to one production wishlist.
- Constant-time token comparison.
- Strict POST/JSON, rate, item, and byte limits.
- Default to dry-run unless `apply: true` is explicit.
- Require exact wishlist short ID and expected identity match.
- Reject archived wishlists.
- Expose no update or delete operation.
- Accept no arbitrary SQL and no arbitrary destination wishlist.
- Disable the endpoint when its secret/configuration is absent.

A later generalization may replace the fixed target with hashed, revocable capability tokens scoped to individual wishlists and `gift:create` only.

## Phase 7 — Idempotency and audit

Add additive tables.

### `gift_ingestion_run`

Store:

- Manifest ID.
- Wishlist ID.
- Manifest content hash.
- Status and timestamps.
- Bounded result summary.

### `gift_ingestion_item`

Store:

- Run ID.
- Stable item ID.
- Source URL.
- Item content hash.
- Created gift ID.

Rules:

- Replaying an identical manifest returns the previously created gift IDs.
- Reusing an item ID with changed content fails safely.
- Existing canonical source URLs are skipped by default.
- Automated ingestion never silently updates an existing gift.
- An explicit duplicate override may be designed later; it is not part of the initial endpoint.

Dry-run returns:

- Resolved wishlist identity.
- Gifts that would be created.
- Existing or skipped items.
- Metadata/image warnings.
- Idempotency conflicts.

Dry-run performs no writes, uploads, notification changes, or audit mutations.

## Phase 8 — Fixed local CLI

Add `scripts/ingest-gifts.ts` and package commands equivalent to:

```bash
pnpm ingest:gifts --manifest ./gifts.json
pnpm ingest:gifts --manifest ./gifts.json --apply
```

CLI requirements:

- Dry-run by default.
- Call only the protected application endpoint.
- Read the bearer token from an ignored local environment file.
- Never print credentials.
- Produce structured output suitable for the skill.
- Exit nonzero on ambiguity, target mismatch, validation failure, or conflict.
- Never generate or execute SQL.
- Require an explicit production base URL and `--apply` before mutation.

Document the operational contract in `docs/PRODUCTION_GIFT_INGESTION.md`.

## Phase 9 — Durable R2 image mirroring

External `imageUrl` support may ship first, but durable R2 mirroring should follow because retailer images can disappear, block hotlinking, or track visitors.

Recommended protocol:

1. The skill/CLI downloads the selected image locally.
2. Validate every redirect destination, byte signature, MIME type, dimensions, and size.
3. The endpoint issues a manifest/item-bound presigned R2 upload.
4. The CLI uploads directly to R2 without receiving an R2 account credential.
5. Commit verifies the issued key exists and stores `imageKey`.
6. A failed database commit triggers best-effort object cleanup.
7. Failed cleanup is recorded for an orphan report/cleaner.

Use automatic image framing by default; imported crop metadata is unnecessary.

Default image policy is all-or-nothing. A later explicit `--allow-missing-images` mode may create gifts without a mirrored image, but the result must report every omission.

## Phase 10 — Metadata-gathering skill

Create the project skill at:

`.agents/skills/add-gifts/SKILL.md`

Do not use the `sk-` prefix; that prefix is reserved for SvelteKit-template skills.

Skill workflow:

1. Accept product URLs and an optional wishlist alias.
2. Fetch product JSON-LD, OpenGraph metadata, canonical URL, and ordinary page metadata.
3. Fall back to an exact brand/model search when direct extraction fails.
4. Select a searched image only when product identity is sufficiently confident.
5. Never invent a price, model, or product identity; leave uncertain fields empty.
6. Preserve the supplied URL as the primary link.
7. Write the versioned JSON manifest.
8. Invoke the CLI dry-run.
9. Apply automatically only when the user explicitly requested production insertion, wishlist identity matches, no ambiguous product/image remains, and no idempotency conflict exists.
10. Otherwise stop with a targeted HITL decision.
11. Report created gift IDs, skipped duplicates, image provenance, and omitted metadata.

The skill must never read or print the ingestion token directly; credential loading belongs to the fixed CLI.

## Phase 11 — Tests and verification

Add targeted coverage for:

- Shared creation service behavior.
- Concurrent append ordering.
- Atomic single/bulk insertion.
- Digest grouping across multiple wishlists.
- Rolling 24-hour boundaries.
- Concurrent additions targeting one recipient.
- Notification preference disablement.
- Actor and recipient exclusion.
- Hidden notification filtering and unread counts.
- Legacy singular notification rendering.
- CSV image and quantity parsing/persistence.
- Endpoint authentication and fixed-wishlist scoping.
- Dry-run purity.
- Manifest replay and changed-content conflicts.
- R2 upload success and database-failure compensation.
- Czech and English digest rendering.

Verification order:

```bash
pnpm.cmd run check
pnpm.cmd run test -- <targeted tests>
pnpm.cmd run check:all
pnpm.cmd run test
```

Use raw Playwright for targeted browser verification according to project instructions.

## Rollout

1. Create a production safety checkpoint using the established Neon history/manual backup procedure.
2. Apply the additive migration before code that depends on it.
3. Deploy digest/shared-service code with ingestion disabled.
4. Verify manual single-add and bulk-add digest behavior.
5. Configure the fixed-target ingestion secret.
6. Run a production dry-run and verify the resolved wishlist identity.
7. Apply one controlled gift.
8. Enable normal manifest batches.
9. Enable R2 mirroring after external-image ingestion is stable.

Do not backfill historical gifts or rewrite existing notifications.

## Rollback

- All database changes are additive.
- Remove or disable the ingestion secret to stop machine writes immediately.
- Feature-disable new digest creation while retaining existing digest rows.
- Legacy notification rendering remains supported.
- Never delete inserted gifts automatically during rollback.
- Retain ingestion audit and idempotency rows for diagnosis.
- Clean unreferenced staged R2 objects separately; do not couple cleanup to gift deletion rollback.

## Worktree and branch

After conversation compaction, create the isolated branch/worktree with:

```bash
node "$MPX_PROJECTS/mpx-claude-code/plugins/mp/scripts/setup-worktree.mts" \
  feat/gift-ingestion-digests \
  --base dev \
  --no-open
```

Expected worktree path:

`C:\_MP_projects\prejemesi.worktrees\feat\gift-ingestion-digests`

Before starting any server, read that worktree's `.worktree-ports.json` and use its assigned ports.

## Implementation-start instruction

After compacting the conversation, instruct the coding agent:

> Read `.mpx/GIFT_INGESTION_PLAN.md` completely, create the specified worktree and branch from `dev`, and implement the approved plan there. Preserve production data and follow the phased rollout and verification requirements.
