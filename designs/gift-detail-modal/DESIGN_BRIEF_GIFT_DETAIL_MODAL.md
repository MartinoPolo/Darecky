# Design Brief – Gift Detail Modal

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant 1 – Center modal 2-column)
> **Refined mockup**: `designs/gift-detail-modal/refined.html`
> **Summary**: `designs/gift-detail-modal/SUMMARY.md`
> **Refinements**: Approved app shell nav as backdrop context, visitor states (default/reserved/fully reserved), full detail layout, reserve button, like toggle, light-mode only

**Component:** `GiftDetailModal` (`src/lib/components/blocks/gift-detail-modal/`)
**Date:** 2026-05-30
**Status:** Design phase – 5 variants under exploration

---

## 1. Purpose

The Gift Detail Modal is the primary information surface for a single gift on a wishlist. It is opened by clicking any gift card/row in the wishlist view. Its job is to:

1. Show the full gift details that cannot fit on a card (full description, full URL, high-res image).
2. Allow visitors to reserve (or unreserve) the gift without leaving the wishlist page.
3. Allow moderators to edit gift details inline.
4. Allow the owner to mark a gift as received.
5. Surface like counts and let any viewer like the gift.

The modal must uphold the **surprise protection invariant**: the owner must never see reservation state.

---

## 2. Surrounding Context

The modal overlays the wishlist page (`/w/<short-id>`). The wishlist page shows gifts in one of three views (Card grid, List rows, Compact table). The modal appears above a dimmed/blurred backdrop of that page. Closing the modal (Escape, backdrop click, X button) returns the user to the unchanged wishlist.

There is no URL change on open – Gift detail is not a routable page (per DECISIONS.md: "Gift detail as modal/drawer").

---

## 3. Content Requirements

### Always shown

| Field          | Source                         | Notes                                                          |
| -------------- | ------------------------------ | -------------------------------------------------------------- |
| Gift image     | `gift.imageUrl` or placeholder | Full-width or proportional                                     |
| Gift name      | `gift.name`                    | Large heading, `dk-h2`                                         |
| Description    | `gift.description`             | Full text, not truncated, `dk-body`                            |
| Price          | `gift.price`                   | Formatted "8 490 Kč", shown only if set                        |
| External link  | `gift.url`                     | Full URL, opens in new tab, domain label "Koupit na alza.cz ↗" |
| Priority badge | `gift.priority`                | Nízká / Střední / Vysoká; hidden if not set                    |
| Like button    | `gift.likeCount`               | Heart icon + count; any viewer can like                        |
| Added date     | `gift.createdAt`               | "Přidáno 15. 5. 2026"                                          |

### Role-gated content

| Field                                               | Owner                    | Visitor                           | Moderator      |
| --------------------------------------------------- | ------------------------ | --------------------------------- | -------------- |
| Reservation state (Celkem / Dostupné / Rezervované) | Hidden                   | Shown                             | Shown          |
| "Rezervovat" button                                 | Hidden                   | Shown (if available)              | Hidden         |
| "Zrušit rezervaci" button                           | Hidden                   | Shown (if already reserved by me) | Hidden         |
| "Plně rezervováno" label                            | Hidden                   | Shown (if fully reserved)         | Shown          |
| Who reserved + when                                 | Hidden                   | Hidden                            | Shown          |
| "Označit jako obdržené" button                      | Shown                    | Hidden                            | Hidden         |
| Edit button                                         | Shown (draft only)       | Hidden                            | Shown (always) |
| Added by                                            | Shown if moderator added | Shown if moderator added          | Always shown   |

---

## 4. States Table

| State                  | Trigger                                  | Visual change                                          |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------ |
| **Loading / Skeleton** | Modal open before data loads             | Shimmer blocks for image, name, description            |
| **Default – Visitor**  | Normal view, gift not reserved           | Reserve button enabled                                 |
| **Reserving**          | Visitor clicks "Rezervovat"              | Quantity selector + confirm/cancel row inline          |
| **Anonymous reserve**  | Unauthenticated visitor confirms reserve | Name + email form appears below quantity               |
| **Reserved by me**     | Visitor has an active reservation        | Button becomes "Zrušit rezervaci" (outlined danger)    |
| **Fully reserved**     | All units claimed                        | No reserve button; "Plně rezervováno" badge            |
| **Default – Owner**    | Owner views gift                         | No reservation info; edit button if draft              |
| **Editing**            | Owner (draft) or Moderator clicks Edit   | Fields become editable; Save/Cancel footer             |
| **Received**           | Owner marks gift received                | Green "Obdrženo" banner across image; button grays out |
| **Archived list**      | Parent wishlist is archived              | All action buttons disabled; "Archivováno" label       |

---

## 5. Component Reuse Map

```
blocks/gift-detail-modal/
  GiftDetailModal.svelte         – orchestrator, manages open state + role
  GiftDetailImage.svelte         – image with placeholder fallback
  GiftDetailMeta.svelte          – name, description, price, link, priority, dates
  GiftDetailActions.svelte       – role-aware buttons (reserve/edit/receive)
  GiftDetailReserveForm.svelte   – quantity selector + anonymous identity form
  GiftDetailReservations.svelte  – moderator table: who reserved + when
  GiftDetailSkeleton.svelte      – loading skeleton

derived/
  PriorityBadge.svelte           – reusable priority badge (used also on gift cards)
  LikeButton.svelte              – heart icon + count, optimistic update

base/
  badge/, button/, card/, input/ – shadcn primitives (do not edit)
```

---

## 6. Layout Constraints

- **Max width:** 720px (center modal, variant 1) / full viewport height minus 48px (drawer variants).
- **Min height:** none – content-driven; scrollable if content overflows.
- **Image:** max-height 320px, `object-fit: cover`, `object-position: center`. On narrow viewport (<480px) image collapses to 200px.
- **Close button:** always positioned top-right, minimum 44×44px touch target.
- **Backdrop:** `backdrop-filter: blur(4px)` + `oklch(0 0 0 / 0.5)` overlay; respects `prefers-reduced-motion` (skip blur animation).
- **Z-index:** `--z-modal: 50` from tokens.
- **Mobile:** All variants should degrade gracefully to full-screen at <600px.

---

## 7. Design Tokens Used

From `designs/tokens.css`:

- Typography: `--font-sans`, `--font-heading`, scale `--text-xs` through `--text-3xl`
- Spacing: `--space-*` (4px base grid)
- Radii: `--radius-lg` (modal corners), `--radius-full` (badges, pill buttons)
- Shadows: `--shadow-xl` (modal lift)
- Motion: `--duration-slow` (250ms) + `--ease-out` for open; `--duration-normal` (150ms) for close
- Z-index: `--z-modal: 50`, `--z-overlay: 40`
- Status: `--color-reserved`, `--color-liked`, `--status-success`, `--status-danger`

From `src/app.css` (Shadcn theme tokens):

- `--primary: oklch(52.7% 0.154 150.069deg)` – sage green, CTA buttons
- `--primary-foreground`, `--background`, `--foreground`, `--muted`, `--muted-foreground`
- `--border`, `--card`, `--destructive`

---

## 8. Design Constraints

1. **Owner never sees reservation data** – any variant showing reservation count/names must conditionally render only for visitor or moderator roles.
2. **Edit lock after sharing** – Edit button for owner only appears when wishlist is in Draft state. Shared wishlists: owner sees read-only modal only.
3. **Reserved gifts cannot be force-removed** – Moderator edit modal must not show a delete button on reserved gifts; show disabled state + tooltip "Dar je rezervován".
4. **Quantity = 1 hidden** – The quantity indicator ("Celkem: 1") is hidden when quantity is exactly 1 (shows as "1 kus").
5. **No scrollbar on backdrop** – body scroll must be locked while modal is open.
6. **Focus trap** – Tab key must cycle only within the modal (accessibility requirement).
7. **WCAG AA contrast** – All text must pass 4.5:1 on its background.

---

## 9. Design Freedom

- Choice of image placement: left-column (2-col), top-hero, or sidebar thumbnail.
- Animation style: slide, fade, scale, or combination.
- Whether to use a sticky header (name always visible while scrolling long descriptions).
- Visual treatment of the "Rezervovat" CTA – full-width vs. right-aligned, outlined vs. filled.
- Priority badge style: pill vs. dot indicator vs. colored stripe.
- Footer vs. floating action buttons.
- Dark/light surface contrast within the modal itself (e.g., image on darker surface, text on lighter card).

---

## 10. Visual References

- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-a-honey.html` is historical provenance only.
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-b-sage.html` is historical provenance only.
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-c-berry.html` is historical provenance only.
- `designs/tokens.css` – all structural tokens
- Sage green primary: `oklch(52.7% 0.154 150.069deg)`

---

## 11. Not Included in This Modal

- Comments thread (planned v2 – separate `GiftComments` component)
- Price tracking / price drop history (v2)
- Social sharing of individual gifts (v1 wishlist sharing only)
- Admin/owner seeing who liked the gift (notifications only, not shown in modal)
- Drag-to-reorder handle (belongs to the wishlist list view, not the detail modal)
