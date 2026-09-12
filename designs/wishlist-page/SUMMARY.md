# Wishlist Page -- Refinement Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Mockup:** `designs/wishlist-page/refined.html`
**Base variant:** Variant 2 (E-commerce grid)
**Date:** 2026-05-30

---

## Refinements Applied

- Copied exact approved app-shell nav: logo, nav-links with hover dropdowns, nav-right (Vytvorit button, bell, dark-mode toggle, avatar). "Moje seznamy" marked `.is-active`; dropdown closed (default state).
- Wishlist header: full-bleed gradient banner (dark crimson Christmas theme), owner name in primary sage green above title, description, and stats row (gift count + share date).
- Toolbar: 3-way view toggle (Card | List | Kompakt) as segmented control + labeled sort/filter dropdown (Razeni) showing 6 sort options and 2 filter checkboxes + Sdilet ghost button + Pridat prani primary button.
- Two role sections separated by a thick gradient divider:
    - **Visitor view** (primary, top): reserve buttons, all reservation states (available / fully reserved / partially reserved), like heart, external link, priority badge, quantity badge.
    - **Owner view** (secondary, below): drag-grip handles for reorder, edit and delete icon buttons -- NO reserve buttons, NO reservation badges, NO reservation state anywhere.
- Gift cards: 160px image area, 2-line name clamp, bold price in primary color, always-visible external link (greyed when absent), priority badge, quantity badge (xN), heart like with count.
- Reservation states demonstrated: 5 fully available, 1 partially reserved (Maly princ x2 -- 1/2 taken), 1 partially reserved (Zahradni nuzky x3 -- 1/3 taken), 1 fully reserved (card dimmed, overlay, button disabled).
- Light mode only; sage green primary `oklch(52.7% 0.154 150.069deg)`.

---

## Component Map

### As-Is (copy from app-shell/tokens without changes)

| Element                    | Source                           |
| -------------------------- | -------------------------------- |
| Top navigation (`.dk-nav`) | `designs/app-shell/refined.html` |
| CSS custom properties      | `designs/tokens.css`             |
| `.dk-btn` base styles      | `designs/tokens.css`             |
| `.dk-badge` base styles    | `designs/tokens.css`             |
| `.dk-card` base styles     | `designs/tokens.css`             |
| `.dk-heart` like button    | `designs/tokens.css`             |

### Adopt (map to shadcn-svelte base components)

| Mockup element                  | shadcn-svelte component                 | Notes                                             |
| ------------------------------- | --------------------------------------- | ------------------------------------------------- |
| Reserve button                  | `Button` variant="default"              | Primary filled, disabled state for fully reserved |
| Edit / Delete icon buttons      | `Button` variant="ghost" size="icon-sm" | Owner toolbar per card                            |
| Sdilet ghost button             | `Button` variant="outline"              | With ShareIcon                                    |
| Pridat prani button             | `Button` variant="default"              | With PlusIcon                                     |
| View toggle (Card/List/Kompakt) | `ToggleGroup.Root` + `ToggleGroup.Item` | 3-way, single selection                           |
| Priority badge                  | `Badge` variant="secondary"             | Custom color via data-priority attr               |
| Quantity badge                  | `Badge` variant="secondary"             | xN label                                          |
| Rezervovano badge               | `Badge` variant="secondary"             | color-reserved token, visitor only                |
| Sort/filter dropdown            | `DropdownMenu`                          | Labeled trigger                                   |
| Card container                  | `Card.Root`                             | rounded-xl, shadow-xs, ring-1                     |
| Reservation overlay badge       | Custom positioned `Badge`               | Absolute over card image                          |

### Build Custom

| Element                                   | Rationale                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gift card (`.gift-card`)                  | Combines image area + body + footer; reservation state drives visual treatment. No shadcn equivalent. |
| Drag-grip handle                          | Owner-only 6-dot SVG wrapping Lucide GripVertical. Conditionally rendered.                            |
| Wishlist header (`WishlistHeader.svelte`) | Owner name + banner + stats row; domain-specific.                                                     |
| Role section wrapper                      | Conditional rendering of visitor vs owner card variants from a single gift array.                     |

---

## Implementation Notes

### View Switching (Card / List / Compact)

- `ToggleGroup` drives a `$state` value (`'card' | 'list' | 'compact'`).
- Pass current view to a `GiftGrid` block component; it renders the correct layout variant per gift.
- Card view: 4-col CSS grid (`repeat(4, 1fr)`), uniform image height 160px.
- List view: single-column rows, 72x72px thumbnail left, all metadata inline.
- Compact view: 2-col dense grid, no image, name + price + reserve button only.

### Drag-and-Drop Reorder (Owner Only)

- Owner gift grid uses a drag-and-drop library (e.g. `svelte-dnd-action`) only when `role === 'owner'`.
- Drag handle is the GripVertical icon -- the card itself is NOT the drag target to avoid conflict with link clicks.
- On drop: emit reorder event, persist via `PATCH /api/wishlists/:id/gifts/reorder`.
- Visitor grid is non-interactive (no drag).

### Role-Based Rendering

- Server `load()` resolves `role: 'owner' | 'visitor' | 'moderator'` from session + wishlist ownership.
- `GiftCard.svelte` accepts a `role` prop and conditionally renders:
    - `visitor`: reserve button, reservation badge, reservation count.
    - `owner`: drag grip, edit button, delete button -- NEVER reservation data.
    - `moderator`: same as visitor + "flag" action.
- Reservation DOM nodes are never present in the owner render -- not CSS-hidden, not rendered at all.

### Gift Card States

| State                        | Visible to         | Visual treatment                                         | Actions available                                 |
| ---------------------------- | ------------------ | -------------------------------------------------------- | ------------------------------------------------- |
| Available                    | Visitor, Moderator | Full opacity, normal                                     | Reserve button active                             |
| Partially reserved (qty > 1) | Visitor, Moderator | Full opacity, "Rezervováno (1/3)" badge                  | Reserve button active for remaining units         |
| Fully reserved               | Visitor, Moderator | Slight desaturation, overlay badge "✓ Rezervováno"       | Reserve button disabled                           |
| Owner editable (draft)       | Owner, Moderator   | Normal, drag handle visible                              | Drag, Edit, Delete                                |
| Owner locked (post-share)    | Owner, Moderator   | Lock visual, drag handle dimmed                          | Edit+Delete disabled (tooltip explains why)       |
| Newly added post-share       | Owner, Moderator   | "Nové" badge in image area                               | Drag, Edit, Delete fully enabled                  |
| Moderator sees reserver name | Moderator only     | "Rezervováno: Jméno" badge below reservation state badge | Edit enabled; Delete disabled when fully reserved |

---

### Reservation State Filtering

- For owner requests the server STRIPS reservation fields before serializing.
- Type split: `GiftForVisitor` includes `reservedCount: number` and `isFullyReserved: boolean`. `GiftForOwner` does not.
- `load()` returns the correct typed array per role: type-level enforcement + server-side stripping.
- Partial reservation (qty > 1, some taken): "Rezervovano (taken/total)" badge + active reserve button for remaining quantity.
- Full reservation: card opacity 0.78, image overlay badge, reserve button disabled.
