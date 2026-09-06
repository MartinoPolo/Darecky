# Gift Geometry Review — Design Brief

> **Status**: Approved and refined (Variant C). Design phase complete; historical A/B retired.
> **Refined mockup**: `designs/gift-geometry-review/refined.html`
> **Summary**: `designs/gift-geometry-review/SUMMARY.md`
> **Refinements**: Implementation review supersedes the specimen's manager reservation overlay and uniform large action sizing. Reserve/cancel belongs in the bottom action area beside Received and More when space permits, never on the image. Desktop actions share the compact existing Reserve size; mobile keeps larger touch targets. Narrow manager layouts may stack the complete square image above content/actions to preserve all controls without clipping. The enlarged-text accessibility alternative remains accepted.
> **Review guide**: `designs/gift-geometry-review/variants/variant-c-notes.md`
> **User feedback**: `designs/gift-geometry-review/REVIEW_FEEDBACK.md`

**Sources:** GitHub #350 (design gate), #354, #356, #357, #360, #362. Prefer shorter visible labels with complete accessible action names. The latest user review supersedes the full-page A/B exploration below.

## 1. Purpose

Make gift actions fit reliably within the card, with equal neighboring heights, clear insets, and coherent corners. Key value: every viewer can read and operate the appropriate actions without clipped text or spoiled surprises.

## 2. Surrounding Context

Use a standalone component review stage, not another full-app wishlist. Separate List, Grid and reorder views; only the relevant specimens are visible. Keep Anime Sky typography, semantic tokens, ink borders and hard shadows from the canonical stylesheet. Review tooling is explicitly separate from app controls. No header, toolbar mask or unrelated component redesign is implied. Inspect at 320/390/768/1440px; the narrow review stage has 8px side gutters, not a proposal to change production page gutters.

Variant C uses isolated, realistic specimens with concise labels describing exactly what differs. Start with mobile List browse action containment and density; review Grid overlays and reorder separately, rather than combining all roles and contexts in one view. Keep non-decision styling faithful and quiet. The complete role/state/viewport matrix is still required for verification, but need not be the human review interface. Changes are local simulation only.

## 3. Requirements

- Historical A used a full-width footer below image/content; B put actions in the text column. That difference existed only below 640px in List browse mode; desktop, Grid and reorder were identical. These are no longer valid candidates for approval without correcting the image/density errors.
- List image fills the complete row height, from inner top edge to inner bottom edge, including the action region. Preserve the square thumbnail/crop contract. No detached white gap below the image and no action footer extending beneath only a shorter image.
- Use real-looking product content and local product photos where available. Variant C starts with the same perfume in each List role so action differences are isolated; the stress controls add guitar, chess and a no-image cooking course. Include a long title, no-image item, multiple links, high/low priority, unavailable, own reservation, received and unlimited/multiple quantity examples.
- User-selected density rule: clamp description first, then title when square full-height List geometry is constrained. Keep price, quantity, a visible store-link entry and every eligible action; full title/description and additional links remain accessible through gift details/link controls. Do not clip essential controls or silently shrink their targets. The focused Variant C density is approved; verify its implementation against real content.
- Approved short received action: visible „Přijato“ / „Received“; accessible name „Označit jako přijatý“ / „Mark as received“. Reversible state uses an unambiguous label such as „Vrátit zpět“ with the full accessible name. Reserve remains „Rezervovat“. Cancel remains „Zrušit rezervaci“ / „Cancel reservation“, not ambiguous „Zrušit“. A compact label is not permission to hide required actions. If text still overflows under enlargement, wrapping with matched neighboring heights is the safety fallback.
- Keep More immediately beside the primary action, same measured height and shared size step. Right/bottom clearance must include the complete hard shadow; no ancestor clipping used to conceal overflow.
- Grid heart overlays the image at top-right; it must not create a separate white header band, reserve a strip above the image or reduce image height. No circular sticker/border/background; red filled when liked and contrasting count BESIDE icon. Variant C places List Like over the thumbnail too, so neither layout reserves a white strip or sacrifices image height; this placement is approved in the focused specimen. Visible icon compact, target accessible. Show zero and larger count states. Received/reserved stickers centered independently on the image; full readable text.
- At narrow 200% text, Variant C uses the approved accessibility exception: stack the complete square image above content/actions, not a shortened thumbnail beside a footer. A side-by-side square with full-row height, doubled text and all essential controls cannot fit simultaneously at narrow phone width. This alternative is labelled, preserves all actions with matched heights, and was included in the user's approval. It does not silently override the normal List contract.
- Manager-specific stress cases keep eligible Reserve/cancel, Received and More together in the bottom action area, beside each other when space permits. Image-overlay reservation actions are rejected by implementation review. Use matching compact desktop controls and larger mobile touch targets; reflow narrow manager layouts instead of covering the image or clipping actions.
- Recipient mode must not render reservation/Like data, names, badges, counts, or trace spaces. Visitor sees anonymous reservation state only. Gifter can cancel own reservations. Manager has received and reservation actions where eligible and is the only ordinary role with reserver names. Archived mode blocks new reservations/received mutations; preserve allowed own-cancel behavior.
- High/low textual badges use danger/success tokens when grouping is not priority. Selected-state perimeter follows the card continuously; keyboard focus remains distinct.
- Reorder: handle-only interaction at the **top-left** on all widths in both layouts. User selected a small outlined visual inside a larger actionable area, not an oversized outlined button or a bottom-row cluster. Baseline source is desktop 20×20px and mobile 40×40px; actionable targets must grow by at least 50% per dimension, independently of the visual. The command specimen demonstrates desktop 32px target/24px visual and mobile 60px target/40px visual. Keep target, focus and nested radius geometry clear of badges/other controls. Preserve keyboard alternatives and touch scrolling outside the target; real drag usability/persistence remains implementation verification.

## 4. States

| State         | Treatment                                                             | Trigger                               |
| ------------- | --------------------------------------------------------------------- | ------------------------------------- |
| Default       | Bordered surface, complete content, equal action row                  | Browse                                |
| Hover/focus   | Stable hit region, visible outline, motion reduced when requested     | Pointer/keyboard                      |
| Like active   | Red heart, adjacent count, aria-pressed                               | Non-recipient Like                    |
| Reserved/own  | Centered full sticker; own cancel stays usable                        | Role fixture                          |
| Received      | Distinct received sticker and reversible eligible action              | Role fixture                          |
| Recipient     | No reservation or Like UI in DOM                                      | Role selector                         |
| Selected      | Continuous inset/parallel outline without detached arcs               | Selection preview                     |
| Reorder       | Large separate grip, focus/keyboard instructions, no action collision | Reorder preview                       |
| Pending       | Disable mutation targets and announce progress                        | Simulated action                      |
| Error         | Localized safe error, retain previous state                           | Demo error control                    |
| Empty/loading | Contextual empty message / same-geometry skeleton                     | Fixture selector or explicit specimen |
| Archived      | Read-only treatment; retain allowed own cancellation                  | Fixture selector                      |

## 5. Component Reuse Map

- `src/lib/components/base/button/Button.svelte`: `intent=primary|outline|ghost`, `size=md|lg|xl|icon`; exact variants in `button_variants.ts`. Reuse matching size step for adjacent controls; propose one composed auto-height safety wrapper rather than editing managed base primitives.
- `blocks/gift/GiftCard.svelte`, `GiftListItem.svelte`: role/archive/privacy/contextual props and action callbacks.
- `blocks/gift/LikeButton.svelte`: `appearance=ghost`, `showCount=true`, `countOverlay=false`; reuse existing behavior.
- `blocks/gift/GiftReceivedToggle.svelte`, `blocks/reservation/ReserveButton.svelte`: action semantics and capability conditions.
- `blocks/gift/GiftStateOverlay.svelte`, `GiftPieceCount.svelte`, `GiftLinkList.svelte`, `GiftCategoryBadge.svelte`: content/role semantics.
- `blocks/wishlist/WishlistGiftDraggableWrapper.svelte`: handle-only pointer plus keyboard alternatives; proposed target geometry only.
- No new third-party primitive. New composition: shared inset action-row treatment and role-aware mockup fixture renderer.

## 6. Layout Constraints

Canonical panel radius 16px; button radius 7px; panel/control stroke 2.5px. Use a deliberate geometry pair: with outer card radius 16px and inset measured from its OUTER border edge of 9px, facing button radius is 7px. This means 6.5px padding inside a 2.5px card border. If optical shadow clearance needs more space, increase inset or choose a compatible larger card radius rather than mechanically claiming nonconcentric corners are concentric. Reserve extra bottom/right shadow clearance explicitly. At ordinary narrow widths, clamp description first and title second while retaining the side-by-side square thumbnail. Only the clearly labelled enlarged-text alternative stacks the image above content; never shrink usable controls below their target sizes. Grid image aspect 4:3; List image 1:1. Keep desktop horizontal layout with image, flexible content, and actions. Mobile controls at least 40px usable targets; drag targets 60px. Clamping title/description is allowed by the latest density decision; clipping actions, their labels or hard shadows is not. Body 14px, content headings 17px, page 26–34px. Test geometry at 320/390/768/1440px.

## 7. Design Tokens

Canonical `src/app.css`: DynaPuff Variable headings, Geist Variable body; `--background`, `--card`, `--foreground`, `--ink`, `--primary`, `--primary-foreground`, `--muted-foreground`, `--status-danger`, `--status-success`, `--radius-panel`, `--radius-btn`, `--size-control-*`, `--elevation-*`. Ink borders and hard sticker shadows. In `refined.html`, link `../tokens.css` for skill compatibility, then `../open-issue-review/assets/app.css` (compiled canonical source supplied by orchestrator) to override legacy tokens. Component-specific CSS only; no separate invented palette. Tailwind utility classes may use that compiled stylesheet.

## 8. Non-Negotiable Constraints

Production privacy/capabilities unchanged. No mutation calls, tracking, external image requests, or production credentials. No native select for app controls; native controls are acceptable only in explicitly separated prototype tooling. Do not redesign the accepted sticky mask. Keep focus, labels, formal Czech, and reduced-motion support. Proposed layout must not conceal overflow with clipping.

## 9. Design Freedom

Choose precise action inset/radius combinations, square thumbnail size and description/title density inside the fixed image contract. Top-left grip placement and overlay-without-image-shrink are settled. Do not invent another full-page layout variation to compare action insets; replacement specimens must identify the one question being reviewed.

## 10. Visual References

Current sources above; `designs/mobile-wishlist-density/refined.html`, `designs/wishlist-gift-actions/refined.html`, `designs/redesign-2026/sky-final/anime-sky-final.html`. Reporter screenshots: Obsidian Files/Pasted image 20260905141720.png, 20260905144139.png, 20260905144213.png. Source for nested geometry: https://www.w3.org/TR/css-backgrounds-3/#corner-shaping (padding-edge radius subtracts border thickness); https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/ (Paul Hebert, equation `outerRadius - gap = innerRadius`). For equal physical insets, child outer radius = max(0, parent outer radius − border thickness − padding); unequal insets require per-axis treatment, not one arbitrary radius. This is a proposal for #362's later concise auto-loaded styling guidance, not a completed implementation of that issue.

## 11. Not Included

Production CSS fixes, data/mutation correctness, real drag persistence, hover-flicker repair, global styling-instruction edits and deployment. These remain implementation work. The gift-design approval gate is complete; no further human design choice is required for the reviewed issues.
