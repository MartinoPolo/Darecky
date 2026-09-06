# Design phase status

## All reviewed design decisions are complete

The user approved settings Variant A, command Variant A with duplicate-text cleanup, and focused gift Variant C including its explicit enlarged-text and manager cases. No further human design decision remains in the reviewed open backlog. All implementation issues remain open; design approval is not a production fix.

## Authoritative design mapping

Paths below are relative to the repository root. The affected issue **descriptions**, not only comments, contain the exact refined mockup, summary and brief paths. `issue-design-links.json` records the body read-back verification and label changes.

| Issues     | Approved mockup                                                     | Scope                                                                  |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| #348, #349 | `designs/settings-control-review/refined.html`                      | Picker confirmation/draft boundary and compact palettes                |
| #353       | `designs/wishlist-command-review/refined.html`                      | Categorized bulk actions on desktop/mobile                             |
| #355       | `designs/wishlist-command-review/refined.html`                      | Filter checkbox spacing/reachability                                   |
| #358       | `designs/wishlist-command-review/refined.html`                      | Bulk-sheet title/count/close alignment and deduplicated summaries      |
| #359       | `designs/wishlist-command-review/refined.html`                      | Combined Display, desktop cascades/mobile sections, hero Settings/More |
| #361       | `designs/wishlist-command-review/refined.html` plus gift refinement | Grid/List switching while reorder remains active                       |
| #350       | `designs/gift-geometry-review/refined.html`                         | Shared gift action/image/content geometry and role cases               |
| #354       | `designs/gift-geometry-review/refined.html`                         | Selection perimeter and distinct focus                                 |
| #356       | `designs/gift-geometry-review/refined.html`                         | High/low textual priority badge direction                              |
| #357       | `designs/gift-geometry-review/refined.html`                         | Image-overlay Like/count and independent state stickers                |
| #360       | `designs/gift-geometry-review/refined.html`                         | Bordered horizontal desktop List surfaces                              |
| #362       | `designs/gift-geometry-review/refined.html` plus command refinement | Top-left compact grip, enlarged target and corner geometry             |

The earlier #355/#358 coverage summaries were mis-scoped. Their issue descriptions, previous approval comments and local records now use the actual requirements above. Hero Settings belongs to #359. #357 REQ-1 now explicitly reflects the approved image/thumbnail overlay instead of conflicting older card-corner wording. Original reporter notes are preserved as history.

## Related implementation-only issues

#347, #352, #363 and #364 now reference the command mockup in their descriptions as **context**, not proof of state/mutation/grouping/positioning correctness. #364 also references settings popovers. #346 (hover stability), #351 (Czech copy audit) and #365 (straighten existing notices while retaining the accepted mask) require no new standalone mockup or human design choice; their existing behavior and acceptance requirements remain authoritative.

The #362 sourced auto-loaded styling rule, actual drag/scroll behavior and all production acceptance criteria are implementation work. Preserve required badges and data across real compositions even when a simplified prototype fixture does not show every combination. Do not copy the manual 200% review switch into production: implement the approved responsive accessibility outcome using real available space/text settings.

## Gate result

Removed **`design needed` and `HITL` from #350**, the sole remaining design approval gate. Related issues had no such labels to remove. After the changes, querying all open issues found no `design needed` or `HITL` tickets. No issues were closed and no unrelated labels changed.

[Final gift approval record](https://github.com/MartinoPolo/prejemesi/issues/350#issuecomment-5557625602).

## Verification and publication

- `verify-focused-gifts.mjs` now exercises the authoritative gift `refined.html`, including responsive role/content geometry, privacy, action/shadow containment, enlarged text, local mutation failure/success and keyboard reorder.
- `verify-refinements.mjs` covers the approved settings/command interactions and duplicate-label regressions.
- `verify-export.mjs` checks the portable refined pages, local links and image/font resources.
- `issue-design-links.json` records exact paths found again in live GitHub issue bodies, with removed labels and remaining gates.
- `issue-bodies-before-finalization.json` preserves the pre-edit issue descriptions.

The approved handoff is published on `design/open-issue-review` for a draft PR into `dev`. GitHub issue descriptions retain exact repository-relative paths and identify that branch; they become default-branch files when the PR merges. Bundled CSS/fonts/photos make the mockups usable from a clean checkout without local seed data. Reproducible screenshots/results and export pointers are ignored. No production source, dependency, database or deployment changes were made. The pre-commit launcher uses `pnpm exec lint-staged`; `pnpm run typecheck` supplies the required Svelte diagnostics before commits.
