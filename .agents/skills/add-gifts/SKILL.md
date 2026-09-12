---
name: add-gifts
description:
    'Gather reviewed product metadata into a gift ingestion manifest and safely dry-run or
    explicitly apply it to the fixed production wishlist.'
argument-hint: '<product URLs...> [wishlist alias]'
allowed-tools: Read, Write, WebFetch, WebSearch, Bash(pnpm ingest:gifts *)
metadata:
    version: '1.0'
    category: operations
---

# Add gifts

Accept one or more product URLs and an optional wishlist alias. This workflow is evidence-only:
**Never guess** a product identity, brand, model, price, currency, image, or wishlist target.

## Extraction order

For every supplied URL, use this order:

1. Fetch the page and inspect product JSON-LD.
2. Inspect OpenGraph fields, the canonical URL, and ordinary page metadata.
3. Only when direct extraction is incomplete, perform an **exact brand/model** web search. Accept a
   search result only when its identity is unambiguous and matches the source evidence exactly.

Preserve the user-supplied source URL as the primary link even when a canonical URL is recorded as
metadata. Never replace it with a searched retailer URL. Leave uncertain fields empty and ask a
targeted question rather than inferring them.

## Provenance and manifest

For each field, record the extraction method in `provenance.fields`. Record selected image
provenance in `provenance.imageSource` with its HTTPS URL and method (`json-ld`, `opengraph`,
`page-metadata`, or `exact-search`). If several images or products plausibly match, do not choose
one silently. Write every unresolved decision explicitly into the manifest's top-level `ambiguities`
array with the affected item (when known), field, and evidence-backed reason.

Write a schema-version-1 JSON manifest with a stable manifest ID, unique stable item IDs, exact
expected wishlist short ID/title/recipient, explicit quantity and priority, original source URL,
gathered timestamp, gift fields, and provenance. `gift.category` is optional and must be
evidence-backed or explicitly provided by the user; it must already be enabled on the fixed wishlist
and match an enabled custom label or either Czech/English label of an enabled preset. Unknown or
disabled category values are HITL, never guessed, and never silently create custom categories. Every
gift must have at least one link, and `gift.links[0].url` must exactly equal `sourceUrl`. Do not add
update or delete instructions.

## Safety gate

Always run the fixed CLI in dry-run mode first:

```bash
pnpm ingest:gifts --manifest <manifest-path> --base-url <explicit-production-url>
```

The skill **never reads or prints** the ingestion token. Do not open the credential file, inspect
process credentials, echo environment values, or pass a token argument. Credential loading belongs
exclusively to `scripts/ingest-gifts.ts`.

Apply only when all of these are true:

- the user made an **explicit production** insertion request;
- the exact fixed target identity matches and any supplied wishlist alias resolves without
  ambiguity;
- every product and selected image is unambiguous;
- dry-run reports no conflict, target mismatch, or ambiguity.

A nonempty dry-run `ambiguities` list is a mandatory HITL stop: do not download, prepare, upload, or
apply images or gifts until the user resolves every entry. Then invoke the same CLI with `--apply`
and the explicit production base URL. Otherwise stop for targeted HITL: identify the exact
item/field/image/target decision needed and present only the evidence-backed choices.

## Report

Report created gift IDs, skipped duplicates, conflicts, omitted metadata, and image provenance.
Report preparation/download/upload/apply failures by item and stage. Never expose signed PUT URLs,
bearer tokens, R2 credentials, database credentials, or cookies.
