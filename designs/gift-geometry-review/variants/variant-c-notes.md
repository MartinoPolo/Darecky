# Variant C — Focused gift specimens

**Status: approved and finalized.** The user accepted this specimen including its explicit alternatives. Authoritative handoff: `../refined.html`, `../SUMMARY.md` and the updated brief. This file explains the original review; historical A/B remain retired.

## Open and inspect

Open `variant-c.html`. Start with the ordinary List specimens; no tool changes are needed.

- **List:** the same product shows Reserve, Cancel reservation and Received + More across the appropriate roles. Compare full-height square imagery, remaining title space, equal neighboring button heights and bottom/right hard-shadow clearance. On narrower specimens the description disappears before the title is clamped further. Full text is available from its title button.
- **Grid:** inspect image-overlay Like with adjacent zero/large counts, received sticker, and lower actions. There is no separate white header strip. This section is not a grid-layout redesign.
- **Grip:** switch List/Grid within the section. The small outlined visual remains top-left inside a larger hit region. Tab exposes focus; Up/Down moves the local specimens. This is not evidence of pointer dragging, touch scroll behavior or persistence.

## Optional stress controls

The collapsed review tools expose roles, long/multiple-link/no-image content, empty/loading, archived, failed mutation, English, dark mode, continuous selection outline and enlarged text. These controls are not shipping UI. Interactions are in-memory simulations; links go only to labelled example store domains when explicitly clicked.

The approval includes these explicitly presented alternatives:

- **Enlarged text:** the explicit 200% alternative stacks the whole square image above the content. Keeping a full-height square beside doubled essential text and all controls is not feasible on a narrow phone. The prototype labels this exception instead of clipping controls or silently shrinking text.
- **Manager with another eligible action:** Received + More stays in the content lane; Reserve/Cancel appears over the lower image. This case is available through the role stress control and is now approved by the separate gift decision.

## Geometry and reuse

The normal List photo is a square spanning the entire inner row height. Grid photos retain 4:3. The content lane reserves real clearance for canonical hard shadows. Title/description clamps apply to text, never to the action row. More uses an icon plus full accessible name, and its height stretches with the neighboring primary action.

Existing reuse candidates remain the brief's `GiftCard`, `GiftListItem`, `ImageFrame`, `LikeButton`, `GiftReceivedToggle`, `ReserveButton`, `GiftPieceCount`, `GiftLinkList`, `GiftStateOverlay`, and `WishlistGiftDraggableWrapper`. No new primitive or dependency. The standalone HTML fixture renderer is not production code.

## Verification

Run `node designs/open-issue-review/verify-focused-gifts.mjs` from the design worktree. It checks responsive List/Grid/reorder geometry; role privacy in the DOM; Czech/English and varied content; enlarged-text control containment; full-height square/List and 4:3/Grid images; Like/grip placement; canonical shadow clearance; matched action heights; local mutation success/failure; archive capability guards; full detail access; and keyboard reorder focus. Results and screenshots live in `designs/open-issue-review/`.

Passing checks alone was not visual approval. The user subsequently approved the specimen and requested clearing the design/HITL gate. Production implementation and regression verification remain open.
