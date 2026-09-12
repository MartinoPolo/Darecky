# Design Brief – Gift Card v2

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant C)
> **Refined mockup**: `designs/gift-card-v2/refined.html`
> **Summary**: `designs/gift-card-v2/SUMMARY.md`
> **Refinements**: priority badge reads "Priorita · {level}" – a leading uppercase "Priorita" eyebrow precedes the colour-coded level word so it can't be read as price/size/importance (colour is secondary reinforcement only); links restyled to Variant A's subtle ghost rows on hairline dividers (no chip background); the whole gift image is the drag trigger (six-dot handle stays a hover-revealed hint, grab/grabbing cursor); cards in a grid row share the tallest card's height (link list bottom-aligned so rows line up).

> **Status**: Design phase – supersedes the current `GiftCard` / `GiftListItem` / `GiftCompactRow` trio
> **Replaces**: corner `×3` quantity badge, single-link row (`gift.url`), `gift_card_variants.ts` slots
> **Related**: `designs/wishlist-page/DESIGN_BRIEF_WISHLIST_PAGE.md` (§4 Gift Card Anatomy), `designs/gift-detail-modal/DESIGN_BRIEF_GIFT_DETAIL_MODAL.md`

**Component:** `GiftCard` v2 (`src/lib/components/blocks/gift/`)
**Date:** 2026-06-03
**Status:** Design phase

---

## 1. Purpose

The Gift Card is the atomic unit of the wishlist page (`/w/<short-id>`). It is the surface where the gift-surprise mechanic is read at a glance and where a visitor decides to reserve. v2 reworks the current card to match the new gift data model and to make piece-count + reservation read as one continuous, scannable line. Its job is to:

1. Present a single gift's essentials – image, name, piece count, price, priority, links – densely but calmly.
2. Communicate availability to visitors/moderators **inline with the piece count** ("3 kusy · 1 rezervováno") without a separate corner badge.
3. Surface and open **multiple buy-links** (the new `links[]` model), primary first, with overflow handling.
4. Offer the like and reserve affordances, and the owner reorder handle.
5. Open the Gift Detail Modal on click (the card is a trigger, not the full detail surface).

The card must uphold the **surprise-protection invariant**: the owner must never see any reservation state – only the bare piece count.

This brief covers all three view modes (Card / List / Compact) but **focuses on Card mode**; List and Compact get the same three behavioural changes (piece count, role-conditional reserved suffix, multi-link) in condensed form (§6).

---

## 2. Surrounding Context

The card lives inside the wishlist page gift collection (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, 20px gap). The page chooses one of three view modes via the toolbar view switcher (`GIFT_VIEW_MODES = card | list | compact`); the card here is the `card` mode renderer.

- **Upstream data**: `GiftByRole` – `GiftForVisitor` (has `reservedCount`, `isFullyReserved`, `myReservationId`, `likeCount`) or `GiftForOwner` (no reservation fields). Role gating is driven by `role === 'visitor' || role === 'moderator'`, exactly as today.
- **Click target**: the whole card opens `GiftDetailModal` (full description, full URLs, reserve flow). No URL change.
- **Owner draft state**: owner sees a drag handle (reorder) and edit/delete affordances live elsewhere; the card surfaces the drag handle only.
- **Locale**: Czech primary (Paraglide). Default SSR locale is `en`. All count/reservation strings are Paraglide messages with plural variants – **not** hard-coded.
- **Light mode is the source of truth**; dark mode follows via semantic tokens.

---

## 3. Content Requirements

### 3.1 Always shown (all roles)

| Element             | Source                                    | Notes                                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Banner image        | `gift.imageUrl` + `gift.imageMeta` (crop) | 160px tall, `derived/image-frame` honoring focal/zoom crop; themed placeholder fallback                                                                                                                                                                                                    |
| Name                | `gift.name`                               | Semibold, `font-heading`, 2-line clamp                                                                                                                                                                                                                                                     |
| **Piece count**     | `gift.quantity` (default 1)               | **Inline after the name**, larger + muted. Czech plural: 1 kus / 2 kusy / 5 kusů                                                                                                                                                                                                           |
| Price               | `gift.price` + `gift.currency`            | Bold, primary (sage green). "Cena neuvedena" muted when null                                                                                                                                                                                                                               |
| Priority badge      | `gift.priorityLabel`                      | Renders as **"Priorita · {level}"** – a leading uppercase "Priorita" eyebrow precedes the colour-coded level word (Vysoká red / Střední amber / Nízká muted) so the level can't be read as price/size/importance. Colour is secondary reinforcement; convey level via text too (WCAG). Eyebrow is a new Paraglide key (do not hard-code). Omitted when null. |
| **Links (stacked)** | `gift.links[]` (jsonb, max 10)            | Each: external-link icon + domain label, `links[0]` primary. "Bez odkazu" muted when empty. Overflow capped (§9)                                                                                                                                                                           |

### 3.2 Role-gated content

The piece-count line is the focal point of the invariant. The **reserved suffix is appended to the same line** for visitor/moderator only.

| Element                                  | Owner              | Visitor                           | Moderator                         |
| ---------------------------------------- | ------------------ | --------------------------------- | --------------------------------- |
| Piece count ("3 kusy")                   | Shown              | Shown                             | Shown                             |
| Reserved suffix ("· 1 rezervováno")      | **Hidden**         | Shown (when `reservedCount > 0`)  | Shown (when `reservedCount > 0`)  |
| "Rezervováno" full state (image overlay) | **Hidden**         | Shown when `isFullyReserved`      | Shown when `isFullyReserved`      |
| Like control (heart + count)             | Hidden¹            | Shown                             | Shown                             |
| Reserve / Zrušit rezervaci button        | **Hidden**         | Shown (per `ReserveButton` rules) | Hidden                            |
| Who reserved + when                      | **Hidden**         | **Hidden**                        | Shown (in detail modal, not card) |
| "Obdrženo" badge (`gift.received`)       | Shown              | Shown                             | Shown                             |
| Drag handle (reorder)                    | Shown (draft only) | Hidden                            | Hidden                            |

¹ Like footer currently renders only for visitor/moderator (`isVisitorOrModerator && visitorGift`); v2 keeps that – the owner card has no footer row.

### 3.3 Piece count + reservation string composition

The composite line is built from Paraglide plural messages (NEW keys required):

| Quantity | reservedCount | Visitor / Moderator string                   | Owner string |
| -------- | ------------- | -------------------------------------------- | ------------ |
| 1        | 0             | "1 kus" (or hidden – see §8.4)               | "1 kus"      |
| 3        | 0             | "3 kusy"                                     | "3 kusy"     |
| 3        | 1             | "3 kusy · 1 rezervováno"                     | "3 kusy"     |
| 5        | 5 (full)      | "5 kusů · plně rezervováno"                  | "5 kusů"     |
| 1        | 1 (full)      | "rezervováno" / "1 kus · rezervováno" (§8.4) | "1 kus"      |

Czech plural buckets: `_one` (1), `_few` (2–4), `_other` (0, 5+). The reserved part ("rezervováno") is invariant; the count drives the noun. The middot `·` separator is part of the formatting, not the message text.

---

## 4. States Table

| State                            | Trigger                                 | Visual change                                                                                                                        |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Owner – default**              | Owner views gift                        | Piece count only ("3 kusy"); no footer/reserve/like; drag handle (draft); no reserved info                                           |
| **Visitor – available**          | `reservedCount === 0`, not full         | "3 kusy"; reserve button primary; like enabled                                                                                       |
| **Visitor – partially reserved** | `0 < reservedCount < quantity`          | "3 kusy · 1 rezervováno"; reserve button still primary (units remain)                                                                |
| **Visitor – fully reserved**     | `isFullyReserved`                       | Card dimmed (~0.78 opacity); "Rezervováno" overlay on image; count line "5 kusů · plně rezervováno"; reserve button disabled/outline |
| **Moderator**                    | `role === 'moderator'`                  | Same reserved display as visitor; **no reserve button**; like enabled                                                                |
| **Received (Obdrženo)**          | `gift.received === true`                | "Obdrženo" badge top-right of image; card reads as completed (subtle desaturation)                                                   |
| **Archived**                     | parent wishlist archived (`isArchived`) | Whole card dimmed; reserve hidden (cancel still allowed if `myReservationId`); no edit/drag                                          |
| **No image**                     | `imageUrl` null / load error            | `image-frame` themed fallback (🎁 emoji + fill color), never a blank gray box                                                        |
| **No links**                     | `links.length === 0`                    | "Bez odkazu" muted, single line, no icon, no hover                                                                                   |
| **Many links (overflow)**        | `links.length > visible cap`            | First N shown, then "+{rest} další" affordance (opens modal / expands – §9)                                                          |
| **Loading / Skeleton**           | gifts query in flight                   | `GiftCardSkeleton`: shimmer image block + name bar + count bar + price + 2 link bars + footer                                        |

---

## 5. Component Reuse Map

What is **reused as-is**, **modified**, and **new**:

| Component / module                                                       | Tier    | v2 disposition                                                                                             |
| ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| `blocks/gift/GiftCard.svelte`                                            | blocks  | **Rewritten** – count-with-name line, stacked links, image-frame, footer gating                            |
| `blocks/gift/GiftListItem.svelte`                                        | blocks  | **Modified** – same count line + reserved suffix + multi-link adaptation (§6)                              |
| `blocks/gift/GiftCompactRow.svelte`                                      | blocks  | **Modified** – count appended to name; primary link in Link cell; reserved suffix                          |
| `gift_card_variants.ts`                                                  | blocks  | **Modified** – drop `quantityBadge` corner slot; add count/reserved/linkList slots                         |
| `blocks/gift/GiftCardSkeleton.svelte`                                    | blocks  | **NEW** – extracted loading skeleton (was inline `image-frame loading`)                                    |
| `derived/image-frame/ImageFrame.svelte`                                  | derived | **Reused** – replaces `GiftImage` wrapper as the crop-aware banner (focal/zoom/fill/fallback)              |
| `blocks/gift/GiftImage.svelte`                                           | blocks  | Reused or folded into image-frame call; keep one wrapper, not two                                          |
| `blocks/reservation/ReservationBadge.svelte`                             | blocks  | **Reused** for the fully/partial overlay badge on the image                                                |
| `blocks/reservation/ReserveButton.svelte`                                | blocks  | **Reused** unchanged (reserve / Zrušit rezervaci / disabled logic)                                         |
| `blocks/gift/LikeButton.svelte`                                          | blocks  | **Reused** unchanged                                                                                       |
| `derived/status-badge/StatusBadge.svelte`                                | derived | Reused for Obdrženo / Archivováno tone chips where a status chip is wanted                                 |
| `base/badge/`                                                            | base    | Reused (priority, reserved, received) – `tone`/`badgeStyle` props                                          |
| `base/button/`, `base/skeleton/`                                         | base    | Reused (reserve, skeleton shimmer)                                                                         |
| `modules/gifts/gift_display.ts`                                          | module  | **Modified** – `getPriorityDisplay`, `formatPrice` reused; **add** piece-count + reserved-suffix formatter |
| `modules/gifts/gift_url.ts` (`extractGiftUrlDomain`, `normalizeGiftUrl`) | module  | **Reused per link** – mapped over `links[]` instead of single `url`                                        |

### Proposed sub-structure (card mode)

```
blocks/gift/
  GiftCard.svelte            – orchestrator: image, body, footer, role gating
  GiftCardSkeleton.svelte    – NEW loading skeleton (matches card layout)
  gift_card_variants.ts      – tv() slots (image/body/name/count/links/footer)
  GiftPieceCount.svelte      – NEW (optional): name-adjacent count + role-conditional reserved suffix
  GiftLinkList.svelte        – NEW (optional): stacked links + overflow "+N další"
derived/image-frame/ImageFrame.svelte   – banner image with crop + fallback
blocks/reservation/ {ReservationBadge, ReserveButton}.svelte
blocks/gift/LikeButton.svelte
```

`GiftPieceCount` and `GiftLinkList` are extracted because both behaviours repeat across Card / List / Compact (≥2 uses → Derived/block extraction per layering rules). They may also be shared with the Gift Detail Modal.

---

## 6. Layout Constraints

### Card mode (focus)

- **Card**: `rounded-xl`, `shadow-sm` + `ring-1 ring-border`, hover `shadow-md`. Overflow hidden. Min width 280px (grid `minmax`).
- **Image area**: fixed 160px height, full width, `image-frame` cover-crop honoring `imageMeta` focal/zoom; reserved/received badges absolutely positioned over it (top-right).
- **Body**: 16px padding, vertical stack with ~8px gaps in order: **name + piece-count line → price → priority badge → links (stacked)**.
- **Name + count**: count sits inline after the name, same baseline where it fits; on a 2-line name the count wraps to its own line and stays left-aligned under the name (never overlaps the image badge). Count is larger than the old corner badge and muted (`text-muted-foreground`).
- **Links**: stacked vertically at the **bottom of the body**, each a full clickable row (icon + domain). Cap visible rows (§9); overflow row last.
- **Footer** (visitor/moderator only): top border, `space-between` – like control left, reserve button right. Owner card has **no footer**.
- **Drag handle** (owner draft): top-left over the image, appears on hover, ≥24px hit area.

### List mode (condensed)

- Row grid `64px 1fr auto`: 64px thumbnail (`image-frame`), info column, actions column.
- Info column: name line with **count inline after name** (muted, smaller). Reserved suffix appended to the same name line for visitor/moderator → "Ponožky 3 kusy · 1 rezervováno".
- Meta line: price · **primary link only** (`links[0]`) · priority · partial-reserved badge. Secondary links are not stacked in list mode – surface "+N" inline next to the primary link or defer all links to the modal (design freedom, §9).
- Actions: like + reserve right-aligned. Fully-reserved row dimmed (~0.78).

### Compact mode (condensed)

- `<table>`: columns **Name | Odkaz | Cena | ♡ | Akce**. Row height ~40px, no images.
- Count appended to name cell, muted: "Ponožky z merino vlny 3 kusy". Reserved suffix may append here too for visitor/moderator, space permitting, else rely on the Akce cell ("plně rezervováno").
- Odkaz cell shows **primary link only**; "+N" indicator if more, full set in modal.
- Fully-reserved rows: opacity 0.65, "Rezervováno" text instead of button.

### Responsive (card mode)

| Breakpoint | Columns | Notes                                       |
| ---------- | ------- | ------------------------------------------- |
| < 480px    | 1       | Count may wrap below name; links full-width |
| 480–768px  | 2       | Full layout                                 |
| 768–1024px | 3       | Full layout                                 |
| > 1024px   | 4       | Full layout                                 |

---

## 7. Design Tokens Used

Canonical in `src/app.css`; structural tokens mirrored in `designs/tokens.css`.

- **Primary (sage green)**: `--primary: oklch(52.7% 0.154 150.069deg)` (light) / `oklch(44.8% 0.119 151.328deg)` (dark) – price, primary link, reserve CTA.
- **Surface**: `--card`, `--background`, `--border`, `--muted`, `--muted-foreground` (count, "Bez odkazu", secondary text), `--foreground` (name).
- **Status**: `--color-reserved` / `bg-reserved` `oklch(0.62 0.13 145)` (reserved badge + "rezervováno" suffix), `--color-liked` `oklch(0.64 0.18 15)` (filled heart), archived `oklch(0.55 0.02 250)`.
- **Priority** (from `gift_display.ts` `PRIORITY_DISPLAY`): Vysoká `oklch(0.92 0.06 25)` bg / `oklch(0.45 0.15 25)` fg; Střední `oklch(0.93 0.05 75)` / `oklch(0.50 0.12 75)`; Nízká → `bg-muted text-muted-foreground`.
- **Typography**: `--font-heading` Noto Sans (name); `--font-sans` Figtree (body, count, links). Scale: name `text-base` (15px) semibold; price `text-lg` (17px) bold; count ~`text-sm`/`text-base` muted; links `text-xs` (12px).
- **Radius**: `--radius-xl` (card 16px), `--radius-lg` (thumbnail), `--radius-full` (badges).
- **Shadow**: `shadow-sm` rest, `shadow-md` hover.
- **Motion**: `--duration-normal` (150ms) hover/dim transitions; respect `prefers-reduced-motion`.

---

## 8. Design Constraints

1. **Owner never sees reservation state** (core invariant). The reserved suffix, partial/full reserved badges, the image "Rezervováno" overlay, and the reserve button render **only** when `role === 'visitor' || role === 'moderator'`. The owner card shows the bare piece count and nothing reservation-derived. Encode this as a single role check feeding the whole composite line – never compute `reservedCount` into owner markup. See role table in §3.2 / §3.3.
2. **Piece count replaces the corner badge.** The `×3` corner badge (current `quantityBadge` slot) is removed; the count lives next to the name in a larger muted style. Do not reintroduce a corner count.
3. **Czech pluralization is mandatory.** "kus / kusy / kusů" via Paraglide plural variants (`_one` / `_few` / `_other`), not string concatenation or a naïve `n + " kus"`. Same for "přání" elsewhere. New message keys required (none exist yet).
4. **Reserved suffix is a suffix, never a second widget.** "· 1 rezervováno" is part of the count line's flow; it must wrap with the count, share its muted baseline (reserved word may take `text-reserved`), and never become a separate corner/overlay chip (the overlay chip is reserved for the _fully_ state on the image).
5. **`links[0]` is always primary** and shown first in every mode. Ordering is data-defined; the card never re-sorts links.
6. **Links open safely**: `target="_blank"`, `rel="external noopener noreferrer"`, href normalized via `normalizeGiftUrl`; domain label via `extractGiftUrlDomain`.
7. **No reservation leakage in skeleton/empty/error** – skeleton and "Bez odkazu" are role-neutral.
8. **WCAG AA** – count text and "Bez odkazu" muted gray must pass 4.5:1; reserved/priority badges convey state via text + icon, not color alone; reserve button has `aria-label="Rezervovat {name}"`, heart `aria-label="Oblíbit {name}"`.
9. **Click-through safety** – link clicks, like, reserve, and the drag handle must `stopPropagation` so they don't trigger the card's open-modal handler (as `ReserveButton` already does).

### Edge-case rulings

- **Quantity exactly 1**: **show "1 kus"** in Card and List modes (explicit, consistent with the detail modal which renders "1 kus" rather than hiding). In **Compact** mode, hide the count when `quantity === 1` to save horizontal space. (Rationale: card has room and benefits from the consistent "N kusů" rhythm; compact is space-constrained. This intentionally diverges from the old `showQuantity = quantity > 1` rule, which hid "1" everywhere.)
- **Long name + count**: name clamps to 2 lines; the count wraps to a new line beneath the name, left-aligned, never truncated and never colliding with the image-overlay badges.
- **Very long domains** (e.g. `darkove-predmety-eshop.example.cz`): each link row truncates the domain with `truncate`; the external-link icon stays fixed, the label ellipsizes. Tooltip/`title` carries the full URL.
- **Many links**: see §9 overflow rule.

---

## 9. Design Freedom

- **Visible-link cap rule** (propose; recommended default): show **3** link rows in Card mode, then a "+{n} další" affordance for the remainder. List/Compact show only `links[0]` plus a "+{n}" hint. The "+N další" may either (a) open the Gift Detail Modal (which lists all links), or (b) expand the card's link list in place – designer's choice; opening the modal is preferred for layout stability.
- **Count typography weight/size** – exact size of the muted count relative to the name (e.g. `text-sm` vs `text-base`), and whether the reserved word takes `text-reserved` or stays fully muted.
- **Separator glyph** between count and reserved part (`·` middot vs `•` bullet vs en-dash) and whether the full state reads "plně rezervováno" vs just the overlay badge with no suffix.
- **Reserved overlay treatment** on the image – centered badge (current) vs top-right corner vs ribbon; and the exact dim level for fully-reserved (current 0.78).
- **Link row affordance** – plain text link vs subtle chip/pill vs bordered row; hover underline vs background tint.
- **Drag-handle styling** and reveal (always-faint vs hover-only).
- **Received treatment** – badge only vs badge + desaturation vs corner ribbon.
- **Skeleton fidelity** – how many link bars to shimmer; whether to shimmer the footer.
- **Empty/placeholder emoji** – keep 🎁 or theme-derived per wishlist (image-frame already supports `fallbackEmoji` + themed fill).
- Card elevation: ring+shadow (current) vs border-only vs shadow-only.

---

## 10. Visual References

- `designs/wishlist-page/refined.html` – current gift card in context (the surface this card sits in)
- `designs/gift-detail-modal/refined.html` – sibling surface; reserve/like/link patterns to stay consistent with
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-b-sage.html` is historical provenance only.
- `designs/tokens.css` – structural spacing / radius / motion tokens
- `src/app.css` – canonical color values (sage green primary, reserved/liked/archived, light/dark)
- Current implementation (the thing being superseded):
    - `src/lib/components/blocks/gift/GiftCard.svelte`
    - `src/lib/components/blocks/gift/GiftListItem.svelte`
    - `src/lib/components/blocks/gift/GiftCompactRow.svelte`
    - `src/lib/components/blocks/gift/gift_card_variants.ts`

---

## 11. Not Included in This Card

- **Gift Detail Modal** – full description, full URLs, who-reserved table, reserve quantity selector, edit (separate brief: `designs/gift-detail-modal/`).
- **Reservation flow internals** – the reserve dialog, anonymous identity capture, quantity selection, toasts. Only the **role-conditional display** of reserved state belongs here; the button itself is `ReserveButton` and its flow lives in the modal/reservation module.
- **Import wizard / bulk paste grid** and the **enrichment** (auto image/price/title scraping) pipeline.
- **Gift add/edit form** (`GiftDetailForm`) and image cropper (`GiftImageCropCanvas`).
- **Owner edit/delete affordances** beyond the drag handle (handled at the wishlist-page / toolbar / modal level).
- **Moderator "who reserved + when"** detail – name/time of reservers is shown in the detail modal, not on the card.
- **Sort/filter, view switcher, wishlist header** – separate components (`GiftSortFilter`, `GiftViewSwitcher`, `WishlistHeader`).
- **Dark-mode-specific design** – handled automatically by semantic tokens; light mode is the source of truth.
