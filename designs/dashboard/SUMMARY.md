# Dashboard Design Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Mockup**: `designs/dashboard/refined.html`
> **Base**: Variant 3 card style + Variant 2 list reference
> **Date**: 2026-05-30

---

## Base

The refined mockup builds on **Variant 3** (large banner cards, title inside overlay) with the toolbar/layout patterns from **Variant 2** (merged title+toolbar row, sort dropdown, view toggle). Three separate page sections are stacked in one HTML file for review, each with its own nav showing the correct active item.

Design tokens are consumed entirely from `designs/tokens.css` and `src/app.css`. No raw color values are hardcoded.

---

## Refinements Applied

| Area              | Decision                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ |
| Nav active state  | Bold text + primary-colored `::after` bottom border (no background highlight)        |
| Card grid         | 3-column `repeat(auto-fill, minmax(280px, 1fr))`                                     |
| Card banner       | 180px gradient area; emoji decoration at 50% opacity; dark gradient overlay          |
| Banner title      | Absolute bottom-left, white text with `text-shadow` for legibility                   |
| Status badge      | Absolute bottom-right; `background: oklch(0 0 0 / 0.52); backdrop-filter: blur(6px)` |
| Card border       | No visible border between banner and body                                            |
| Action buttons    | All actions use identical `outline sm` variant                                       |
| Hover state       | `box-shadow` ring + deeper shadow + `translateY(-2px)`                               |
| Archived cards    | `opacity: 0.65; filter: saturate(0.28) brightness(0.96)`                             |
| Moje seznamy      | No reservation info                                                                  |
| Spravovane        | Full reservation progress bar (moderator role)                                       |
| Sledovane         | Moje rezervace chip only + Dostupnych count                                          |
| Sledovane toolbar | Extra Archivovane + Opustene filter toggles                                          |
| Title + toolbar   | Merged into single row                                                               |
| Logo              | Gift box SVG + Přejeme si (heading font, bold, primary) + dimmed .cz suffix             |

---

## Component Map

### Codebase As-Is

| Design element   | Component                      | Path                                     |
| ---------------- | ------------------------------ | ---------------------------------------- |
| Action buttons   | Button variant outline size sm | src/lib/components/base/button/          |
| Status badges    | Badge variant secondary        | src/lib/components/base/badge/           |
| Theme tag badge  | Badge variant outline          | src/lib/components/base/badge/           |
| Card container   | Card (base)                    | src/lib/components/base/card/            |
| Dark mode toggle | DarkModeToggle                 | src/lib/components/DarkModeToggle.svelte |

### Adopt from shadcn-svelte + Bits UI

| Design element       | Component to add                               |
| -------------------- | ---------------------------------------------- |
| Sort dropdown        | Select or DropdownMenu                         |
| View toggle          | ToggleGroup.Root + ToggleGroup.Item            |
| Archive filter       | Switch or Checkbox + label                     |
| Bell badge           | Button variant ghost size icon + Badge overlay |
| Tooltip on dark mode | Tooltip                                        |
| Avatar initials      | Avatar + Avatar.Fallback                       |

### Build Custom

| Component             | Tier              | Notes                                          |
| --------------------- | ----------------- | ---------------------------------------------- |
| WishlistCardOwner     | blocks/wishlists/ | Banner + overlay title + status badge + body   |
| WishlistCardModerator | blocks/wishlists/ | Adds progress bar + owner name                 |
| WishlistCardFollower  | blocks/wishlists/ | Adds Moje rezervace chip + Prestat sledovat    |
| ReservationProgress   | derived/          | reserved/total bar; reused on wishlist detail  |
| MyReservationChip     | derived/          | Green-tinted own reservation count chip        |
| PageTitleBar          | derived/          | Merged heading + controls row, all three pages |
| WishlistBanner        | derived/          | Theme gradient + emoji + overlay; shared base  |

---

## Implementation Notes

**Card banner gradient**: Each wishlist carries a theme value that maps to a gradient pair. Store gradient presets as a const map in a wishlist-theme.ts utility.

**Status badge legibility**: oklch(0 0 0 / 0.52) + backdrop-filter: blur(6px) on the badge element; the card banner div provides the blur source.

**Owner invariant**: WishlistCardOwner must never receive reservation data. Prop type: { title, theme, status, giftCount, createdAt, updatedAt } only.

**Progress bar**: ReservationProgress takes reserved: number and total: number. Reusable on wishlist detail pages.

**Archive dimming**: is-archived class on card root. CSS: opacity: 0.65; filter: saturate(0.28) brightness(0.96).

**Sledovane toggles**: Archivovane and Opustene are independent boolean states, both off by default.

**Toolbar merged row**: PageTitleBar receives title: string and a snippet for right-side controls.
