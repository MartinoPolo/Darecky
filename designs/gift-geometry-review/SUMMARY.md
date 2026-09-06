# Gift Geometry Review — Design Summary

**Base:** Variant C · **Status:** Approved and refined.

## Refinements Applied

The user approved the focused specimen as presented and requested finalization. `refined.html` retains its layout and interactions; only approval copy and asset paths changed. The approval includes the labelled enlarged-text alternative and manager secondary-action placement. Historical A/B are retired. Requirements and geometry remain authoritative in the design brief, not this summary.

## Component Map

### Codebase — Use As-Is

| Component         | Path                                                         | Usage / contract                                                                                 |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Button            | `src/lib/components/base/button/`                            | Existing intents and equal size steps; adapt composition, not managed primitives                 |
| ImageFrame        | `src/lib/components/derived/image-frame/ImageFrame.svelte`   | Persisted fit/crop renderer; retain actual crop targets rather than copying prototype object-fit |
| ReserveButton     | `src/lib/components/blocks/reservation/ReserveButton.svelte` | Existing reservation callbacks, authorization and pending lifecycle                              |
| GiftStateOverlay  | `src/lib/components/blocks/gift/GiftStateOverlay.svelte`     | Role-aware received/reserved presentation                                                        |
| GiftPieceCount    | `src/lib/components/blocks/gift/GiftPieceCount.svelte`       | Quantity semantics and recipient-safe count presentation                                         |
| GiftLinkList      | `src/lib/components/blocks/gift/GiftLinkList.svelte`         | Existing link data and detail access                                                             |
| GiftCategoryBadge | `src/lib/components/blocks/gift/GiftCategoryBadge.svelte`    | Existing localized badge semantics and palette integration                                       |

### Adopt from shadcn-svelte / Bits UI

None. No dependency or primitive was added.

### Existing Compositions to Adapt

| Component                    | Path                                                                     | Adaptation                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| GiftCard                     | `src/lib/components/blocks/gift/GiftCard.svelte`                         | Image-overlay controls and shared contained action lane                                                              |
| GiftListItem                 | `src/lib/components/blocks/gift/GiftListItem.svelte`                     | Bordered horizontal surface, image/content density, accessible enlarged-text reflow                                  |
| LikeButton                   | `src/lib/components/blocks/gift/LikeButton.svelte`                       | Existing `appearance="ghost"`, `showCount`, `countOverlay=false`; include visible zero count and overlay composition |
| GiftReceivedToggle           | `src/lib/components/blocks/gift/GiftReceivedToggle.svelte`               | Existing role/archive callbacks; matching adjacent size and localized short/full labels                              |
| WishlistGiftDraggableWrapper | `src/lib/components/blocks/wishlist/WishlistGiftDraggableWrapper.svelte` | Separate visible grip and hit region without changing drag ownership                                                 |

## Implementation Notes

Keep native Svelte component behavior, server-derived capabilities and real persistence; do not ship the HTML fixture renderer, review tools, fake mutation timer or sample store domains. The local reorder arrows demonstrate position/focus only, not pointer drag or save correctness. Preserve all required priority/category badges in real compositions, including manager action cases; fixture omissions do not supersede issue requirements.

The 200% switch demonstrates an approved accessibility outcome, not a production-only manual switch. Production must respond to real enlarged text/available space and verify that reflow with browser zoom, font settings and the actual app gutters. The standalone review gutters are not a proposed page-shell change.

Use the existing image renderer's crop metadata, not a parallel CSS crop model. Keep recipient-sensitive data absent at the API and DOM boundaries. Verify runtime content, all eligible actions, localization, focus, shadows and real drag/scroll behavior in production components. The sourced concise auto-loaded geometry guidance in #362 remains implementation work.

## Handoff

Primary design: #350. Related visual requirements: #354, #356, #357, #360 and #362. #361 also uses the approved command design. All are design-ready, not implemented or closed. Issue descriptions identify their exact repository-relative refined mockup and brief paths. The handoff is published on `design/open-issue-review` for integration through a draft PR to `dev`.
