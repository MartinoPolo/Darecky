# Design Brief – Přejeme si Dashboard

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant 3 cards + Variant 2 list ref)
> **Refined mockup**: `designs/dashboard/refined.html`
> **Summary**: `designs/dashboard/SUMMARY.md`
> **Refinements**: Three separate pages with shared nav, variant 3 card style (title in banner, hover ring), unified action buttons, status badges on all backgrounds, archive/unfollowed toggles, progress bars for moderated/followed, merged title+toolbar row, light-mode only

## Purpose

The Dashboard is the authenticated user's home base. It is split into three separate first-level pages: **Moje seznamy** (owned wishlists), **Spravované** (moderated wishlists), and **Sledované** (followed wishlists). Each page has a distinct context, data shape, and action set. Anonymous users have no dashboard – they are redirected to the wishlist link they arrived from.

---

## Surrounding Context

- User arrives via top nav links: "Moje seznamy", "Spravované", "Sledované"
- App shell: fixed top nav (56px) with logo left, nav links center/right, avatar right
- Below the nav: page-level heading + sort controls + wishlist cards
- From dashboard cards, users navigate to individual wishlist pages (`/w/<short-id>`)
- Dark/light/system mode is per-user (controlled from avatar/settings menu)
- Primary color: sage green `oklch(52.7% 0.154 150.069deg)` (light), `oklch(44.8% 0.119 151.328deg)` (dark)

---

## Requirements per View

### Moje seznamy (My Wishlists)

**Data per card:**

- Thumbnail image (square crop) – falls back to theme preset illustration
- Title (bold, prominent)
- Occasion badge (e.g., "Vánoce 2026", "Narozeniny")
- Event date (optional, e.g., "25. 12. 2026")
- Gift count (e.g., "8 přání")
- Status badge: **Koncept** (gray) | **Sdíleno** (green) | **Archivováno** (muted, italic)
- Theme color accent strip or thumbnail tint

**Actions:**

- Primary: Open (click anywhere on card)
- Secondary (hover/overflow menu): Upravit, Sdílet, Archivovat
- Global: "+ Nový seznam" button (top right of page)

**Sorting:** Poslední návštěva | Poslední úprava | Abecedně

**Owner invariant:** NO reservation count visible here – owner cannot see reservation state.

**Empty state:** Illustration + "Zatím žádné seznamy. Vytvořte svůj první!" + CTA button "Vytvořit seznam"

---

### Spravované (Moderated Wishlists)

**Data per card:**

- Thumbnail image
- Title
- Owner name (prominent – "Wishlist od: Jana Nováková")
- Gift count total
- Reservation progress bar + label (e.g., "7 / 12 rezervováno")
- Status badge: Aktivní | Archivováno

**Actions:**

- Primary: Open wishlist
- Secondary: Správa dárků (manage gifts)

**Sorting:** Poslední aktivita | Název | Rezervace (most needed first)

**Moderator note:** Moderators CAN see reservation state – progress bar is appropriate here.

**Empty state:** "Zatím nejste moderátorem žádného seznamu."

---

### Sledované (Followed Wishlists)

**Data per card:**

- Thumbnail image
- Title
- Owner name
- Available gift count (e.g., "5 dostupných přání")
- Own reservation count (e.g., "Moje rezervace: 2")
- Last activity timestamp

**Actions:**

- Primary: Open wishlist
- Secondary: Přestat sledovat (unfollow, destructive – requires confirmation)

**Sorting:** Poslední návštěva | Nejdříve nová přání | Název

**Empty state:** "Zatím nesledujete žádné seznamy. Otevřete sdílený odkaz a přidejte si seznam."

---

## States

| State         | Description                                                                              |
| ------------- | ---------------------------------------------------------------------------------------- |
| Default       | 1–many cards, sorted, with sort dropdown                                                 |
| Empty         | Centered illustration + Czech message + CTA                                              |
| Loading       | Skeleton shimmer cards (same grid/list layout)                                           |
| Archived card | Reduced opacity (0.65), grayscale thumbnail tint, "Archivováno" badge, no primary action |
| Error         | Toast notification + retry option                                                        |

---

## Component Reuse Map

| Component                | Tier       | Used In                                     |
| ------------------------ | ---------- | ------------------------------------------- |
| `WishlistCard`           | `blocks/`  | All three dashboard views                   |
| `WishlistCardSkeleton`   | `blocks/`  | Loading state                               |
| `StatusBadge`            | `derived/` | Card status chip                            |
| `ReservationProgressBar` | `derived/` | Spravované only                             |
| `EmptyState`             | `derived/` | All three views (different copy)            |
| `SortDropdown`           | `derived/` | All three views                             |
| `AvatarChip`             | `derived/` | Owner attribution in Spravované + Sledované |
| `CardThumbPlaceholder`   | `derived/` | Thumbnail fallback per theme                |
| Button (base)            | `base/`    | Actions                                     |
| Badge (base)             | `base/`    | Status, occasion                            |

---

## Layout Constraints

- Max content width: 1200px, centered, 24px horizontal padding
- Nav height: 56px fixed
- Card grid: `repeat(auto-fill, minmax(280px, 1fr))` – 2 cols on tablet, 3 on desktop
- Card aspect ratio for thumbnail: 3:2 (landscape) or square – consistent across all cards
- Sort bar: full width, aligned right, same height as page heading row
- Archived cards stay in the grid but are visually subordinate

---

## Design Tokens

From `tokens.css` and `app.css`:

```
Primary (light): oklch(52.7% 0.154 150.069deg)   – sage green
Primary (dark):  oklch(44.8% 0.119 151.328deg)
Background (light): oklch(100% 0 0)
Background (dark):  oklch(15.3% 0.006 107.1deg)
Card surface (dark): oklch(22.8% 0.013 107.4deg)
Border (light): oklch(93% 0.007 106.5deg)
Foreground (light): oklch(15.3% 0.006 107.1deg)
Status reserved: oklch(0.62 0.13 145)
Status archived: oklch(0.55 0.02 250)
Font sans: Figtree Variable
Font heading: Noto Sans Variable
Nav height: 56px
Content max-width: 1200px
Radius lg: 12px (cards)
Shadow md: standard card elevation
```

---

## Design Constraints

- Owner NEVER sees reservation state in "Moje seznamy" – do not show any reservation counter there
- Archived wishlists must be visually distinct but still present in the list
- Status badge labels: "Koncept", "Sdíleno", "Archivováno" (not English)
- Czech language throughout
- No GDPR banners
- No per-wishlist dark mode – the user's system preference controls everything
- Thumbnail always present (theme preset as fallback) – no blank gray boxes
- Card actions on hover via overlay or overflow menu – not always visible to reduce noise

---

## Design Freedom

- Card thumbnail aspect ratio: designer's choice (square vs 3:2)
- Card elevation style: border-only vs shadow-only vs both
- Sort bar placement: above cards inline vs separate bar
- Theme color accent: color strip top of card vs tinted thumbnail background vs badge
- Archived visual treatment: grayscale filter vs opacity reduction vs both
- Empty state illustration: inline SVG pattern vs large emoji vs decorative shape
- How to show "Moje rezervace: 2" in Sledované – chip, inline text, or icon count
- Whether to show a confirmation dialog for Unfollow or inline destructive button

---

## Visual References

- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-a-honey.html` is historical provenance only.
- `designs/tokens.css` – all spacing, typography, motion tokens
- `src/app.css` – final color values (sage green primary, dark/light variables)

---

## Not Included in Dashboard

- Wishlist page itself (gift list, reservation flow, sharing modal) – separate design
- Gift detail modal
- Moderator invite link flow
- Profile / Settings page
- Notification center
- Authentication screens
