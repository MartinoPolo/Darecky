# Gift Card v2 – Design Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Base**: Variant C (Soft & Friendly) | **Refined**: 2026-06-03

## Refinements Applied

Variant C was chosen and refined with: priority badge as a "Priorita · {level}" pill (context
eyebrow + colour-coded level word); links restyled to Variant A's subtle ghost rows (no chip
background); the whole gift image as the drag trigger; equal-height cards within a grid row. See the
design brief for full requirements.

Key changes from the base variant:

- **Priority badge** – Variant C showed a bare level word ("Vysoká"), which can be misread as price
  or generic importance. The refined badge prepends a small uppercase **"Priorita"** eyebrow + `·`
  before the level word, so the chip self-identifies as priority. Red/amber/muted colour stays as
  _secondary_ reinforcement only, not the sole signal. (The verbose "Moc si přeji" wish-phrasing
  alternative was considered and set aside.)
- **Links** – replaced Variant C's filled pill chips (`surface-2` background) with Variant A's
  understated **ghost rows on hairline dividers**: external-link icon + domain, primary row slightly
  stronger, hover = sage colour shift + underline. No background fill.
- **Drag trigger** – the entire image (`.gcard-img.is-draggable`) carries `cursor: grab` /
  `:active grabbing` and initiates reorder. The six-dot handle is now only a hover-revealed _hint_
  (the visible affordance), not the sole hit target; it remains a focusable button for keyboard
  reorder.
- **Equal-height rows** – grid switched from `align-items: start` to `align-items: stretch`; card +
  body are flex columns that fill the cell, and the link list is `margin-top: auto` (bottom-aligned).
  A taller multi-link card now pulls its row-mates to the same height with their link lists lined up.

## Component Map

### Codebase – Use As-Is

| Component        | Path                                            | Usage                                  | Key Props/Variants                         |
| ---------------- | ----------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Badge            | `src/lib/components/base/badge/`                | Priority chip, received chip           | `tone` / `badgeStyle`                       |
| Button           | `src/lib/components/base/button/`               | Reserve CTA base                       | `variant`, `size`                           |
| Skeleton         | `src/lib/components/base/skeleton/`             | Loading shimmer primitive              | –                                          |
| ReserveButton    | `src/lib/components/blocks/reservation/`        | Footer reserve / Zrušit / disabled     | unchanged (reserve-state logic)             |
| ReservationBadge | `src/lib/components/blocks/reservation/`        | Image overlay (fully/partial reserved) | unchanged                                   |
| LikeButton       | `src/lib/components/blocks/gift/LikeButton.svelte` | Footer like control                 | unchanged                                   |
| ImageFrame       | `src/lib/components/derived/image-frame/`       | 160px banner + crop + 🎁 fallback      | focal/zoom/fill, `fallbackEmoji`            |
| StatusBadge      | `src/lib/components/derived/status-badge/`      | Obdrženo / Archivováno tone chip       | `tone`                                      |
| `gift_display.ts`| `src/lib/modules/gifts/`                        | `getPriorityDisplay`, `formatPrice`    | `PRIORITY_DISPLAY` (Vysoka/Stredni/Nizka)   |
| `gift_url.ts`    | `src/lib/modules/gifts/`                        | per-link domain + normalize            | `extractGiftUrlDomain`, `normalizeGiftUrl`  |

### Adopt from shadcn-svelte / Bits UI

None – every needed primitive already exists in the codebase.

### Build Custom

| Proposed Name             | Description                                                                 | Why existing components don't cover it                                                                 |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GiftCardSkeleton.svelte` | Loading skeleton matching the refined card layout (img + name + count + price + 2 link bars + footer) | Was inline `image-frame loading`; brief calls for an extracted skeleton block            |
| `GiftPieceCount.svelte`   | Name-adjacent count + role-conditional reserved suffix                      | Behaviour repeats across Card / List / Compact (≥2 uses → extraction); enforces the owner-invariant once |
| `GiftLinkList.svelte`     | Stacked ghost link rows + "+N další" overflow (Variant A style)             | Repeats across Card + modal; centralises the new `links[]` mapping and the ghost-row styling           |

## Implementation Notes

- **Priority "Priorita" eyebrow** – the level word stays a Paraglide message
  (`m.gift_priority_high/medium/low()` via `PRIORITY_DISPLAY`). The eyebrow needs a **new Paraglide key**
  (e.g. `gift_priority_label` → "Priorita"); do not hard-code the string. The eyebrow inherits the
  badge `fg` colour at reduced opacity (`opacity: 0.62`); the `·` separator at `opacity: 0.4`.
  `PRIORITY_DISPLAY.colorClass` already carries light+dark tints – reuse it; the eyebrow + level layout
  is the only markup change. Convey level via text, never colour alone (WCAG, §8.8).
- **Equal-height layout** – pure CSS, no JS. Grid `align-items: stretch`; `.gcard { display:flex;
  flex-direction:column; flex:1 1 auto }`; `.gcard-body { flex:1 1 auto; display:flex;
  flex-direction:column }`; `.gcard-links { margin-top:auto }` (and `.link-none { margin-top:auto }`).
  Heights equalise **per grid row** (auto-fill), exactly as requested – not across the whole grid.
  In Svelte, every card in a wishlist row uses the same component, so this falls out of the grid for
  free; no per-row JS measurement.
- **Image drag trigger** – the pointer drag binds to the image element, not the handle. In the mockup
  the handle is `pointer-events: none` so pointer events fall through to the image, flipping to
  `pointer-events: auto` on `:focus-visible` for keyboard reach. In Svelte: attach the drag/sortable
  `onpointerdown` to the image wrapper (owner-draft only), keep the handle button for keyboard reorder
  + as the hover hint. Drag must `stopPropagation` so it never opens the detail modal (§8.9). Show the
  handle on `:hover` (and `:focus-visible`) only.
- **Click-through safety** – link rows, like, reserve, and the drag interaction all `stopPropagation`;
  the card root is the open-modal trigger.
- **Long domains** – link rows truncate the domain (`text-overflow: ellipsis`); icon stays fixed; full
  URL in `title`. List/Compact show `links[0]` only + "+N" hint, full set in the modal.
- **Owner invariant** – the count line, reserved suffix, overlay, reserve button, and footer render
  only for `role === 'visitor' || 'moderator'`. The owner card has no footer and no reservation-derived
  markup. The priority badge + drag handle are owner-visible (handle: draft only).
- **Reduced motion** – hover lift, link colour transitions, and shimmer must respect
  `prefers-reduced-motion`.
