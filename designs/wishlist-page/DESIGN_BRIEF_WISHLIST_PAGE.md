# Design Brief – Wishlist Page

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant 2 – E-commerce grid)
> **Refined mockup**: `designs/wishlist-page/refined.html`
> **Summary**: `designs/wishlist-page/SUMMARY.md`
> **Refinements**: Approved app shell nav, visitor + owner role views, 3-way view toggle, sort/filter dropdown, gift cards with link/priority/quantity/like/reserve, drag-and-drop hints for owner, light-mode only, 4 role views (visitor, owner-draft, owner-shared, moderator), gift card component reference with all states

**Page:** `/w/<short-id>` – the core shareable wishlist view
**Status:** Design exploration (5 variants)
**Date:** 2026-05-30
**Primary audience:** Visitors arriving via WhatsApp/email share links (first-time, often mobile)
**Secondary:** Owners managing their wishlist, Moderators administering it

---

## 1. Purpose & Success Criteria

The Wishlist Page is the single most important page in Přejeme si. It is where the gift-surprise mechanic plays out. Success means:

- A visitor arriving cold (no account, no context) immediately understands: whose wishlist, what occasion, what gifts cost, and how to reserve one – within 5 seconds
- The owner can add gifts and share the list without accidentally seeing reservation state
- A moderator can manage gifts and see full reservation state in the same UI
- All three roles have visually distinct, unambiguous affordances with no role confusion
- The page works beautifully in dark and light mode across all viewport sizes

---

## 2. Information Architecture

### Hierarchy (top to bottom)

1. **App nav bar** – Logo, navigation links, user avatar
2. **Wishlist header** – Owner name (primary color, large), title, description, occasion badge, stats, lifecycle banner
3. **Toolbar** – View switcher (card/list/compact), sort+filter dropdown trigger, action buttons (share, add gift)
4. **Gift grid/list/table** – The gift collection in the chosen view mode
5. **Empty state** – When no gifts exist or filters return nothing

### URL pattern

`prejemesi.cz/w/abc123` – permanent visitor link, shared openly.

---

## 3. Three Role Variants

### 3a. Visitor Role (most common)

The default for anyone arriving via a shared link.

- Header shows owner name + title (read-only)
- Toolbar: view switcher + sort/filter only (no share, no add)
- Each gift: name, price, link, priority badge, quantity badge, like heart with count, **Reserve button**
- Reserved gifts: show "Rezervováno" badge, disable reserve button (grayed, no click)
- Partial quantity: "Rezervováno (1/3)" – reserve button still active for remaining units
- No edit/delete affordances anywhere
- Share button absent

### 3b. Owner Role

The wishlist creator, who must NEVER see reservation state.

**Draft state (not yet shared):**

- Full edit powers: edit, delete, reorder (drag handle) for each gift
- "Sdílet" (Share) button in toolbar – prominent, triggers share dialog
- "Přidat přání" (Add gift) button always visible
- No reserve button, no reservation badges, no "X reserved" stats

**Active/Shared state:**

- Edit + delete buttons hidden/locked for existing gifts (lock icon tooltip: "Přání nelze po sdílení upravovat")
- Add gift button still visible
- Share button still present (copy link, social sharing)
- Stats: "8 přání" – no mention of reservations
- Visual lock indicator on existing gifts (subtle, not alarming)

**Archived state:**

- Banner: "Archivováno – seznam je uzavřen"
- All add/edit/delete buttons hidden
- Read-only display

### 3c. Moderator Role

A trusted third party with full management + visibility.

- Sees everything a visitor sees, plus:
- Each gift card/row: "Upravit" (edit) + "Smazat" (delete) icon buttons
- Reserved gifts: shows "Rezervováno: Tomáš K." (who reserved)
- Partial: "Rezervováno: 1× Tomáš K." for quantity gifts
- **Cannot delete reserved gifts** – delete button disabled with tooltip "Nejdříve zrušte rezervaci"
- "Přidat přání" button visible
- Share button visible
- Stats: "8 přání · 3 rezervováno · 2 oblíbeno"

---

## 4. Gift Card Anatomy

Each gift carries up to 9 data points. Layout order (by importance):

| Priority | Element        | Notes                                                                   |
| -------- | -------------- | ----------------------------------------------------------------------- |
| 1        | Image          | 160px tall in card view, 64px thumb in list, absent in compact          |
| 2        | Name           | Semibold, 15px, 2-line clamp                                            |
| 3        | Price          | Bold, primary color; "Cena neuvedena" (muted) if absent                 |
| 4        | External link  | ↗ domain.cz (12px, primary color); "Bez odkazu" (muted) if absent       |
| 5        | Priority badge | "Vysoká" (red), "Střední" (amber), "Nízká" (muted) – omitted if not set |
| 6        | Quantity badge | "×3" (muted) – only shown when qty > 1                                  |
| 7        | Like heart     | Heart icon + count; filled/red when liked by current user               |
| 8        | Reserve button | Visitor only: "Rezervovat" (primary); disabled "Rezervováno" if taken   |
| 9        | Reserved badge | Visitor: "Rezervováno" badge; Moderator: "Rezervováno: Jméno"           |

**Owner never sees elements 8 or 9.**

### Gift States (visual)

| State                        | Card appearance                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Available                    | Normal, full opacity, reserve button active                                         |
| Reserved (fully)             | Slight desaturation, "Rezervováno" badge overlay top-right, reserve button disabled |
| Partially reserved (qty > 1) | Normal appearance, "Rezervováno (1/3)" badge, reserve button active                 |
| No image                     | Placeholder: gradient + large emoji or gift-box SVG icon                            |
| No link                      | "Bez odkazu" in muted gray, no hover, no underline                                  |
| No price                     | "Cena neuvedena" in muted, smaller text                                             |

---

## 5. Wishlist Header Specification

```
[Owner name – text-2xl, bold, primary color]
[Wishlist title – text-3xl, bold, tight tracking]
[Description – text-base, muted]

[Occasion badge]  [N přání]  [Date if set]
                                         [Share btn] [Add gift btn]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[View switcher: ⊞ ≡ ═]  [Filter icon ⊟]
```

- Owner name uses `--primary` color (sage green `oklch(52.7% 0.154 150.069deg)` in light)
- Wishlist title uses `--foreground`, font-heading (Noto Sans)
- Description wraps; max 2 lines with expand affordance if longer
- Stats line: "8 přání · Vánoce 25. 12. 2026" – muted, small
- No theme hero banner in v1 (tokens exist for future use)

### Lifecycle Banners

**Draft:**

```
[ℹ] Tento seznam ještě nebyl sdílen.   [Sdílet seznam →]
```

Muted info tone, collapsible.

**Active (shared):**
No banner needed – normal state. Lock icon on gift edit buttons is sufficient.

**Archived:**

```
[🗄] Archivováno – seznam je uzavřen. Nová rezervace není možná.
```

Full-width amber/muted banner. Page background slightly desaturated.

---

## 6. Toolbar Specification

```
[⊞ ≡ ═  view switcher]              [⊟ filter]  [↑ Share]  [+ Přidat přání]
```

- **View switcher**: segmented control, 3 buttons (32×28px each), active state: white bg + shadow
- **Filter/Sort button**: 32×32px icon-only button, border+bg, funnel icon. Opens dropdown with:
    - Section "Řadit podle": Pořadí vlastníka (default, checkmark), Priorita, Cena ↑, Cena ↓, Název, Datum přidání
    - Section "Filtrovat": toggle rows for "Jen dostupné" and "Jen s odkazem"
    - Active filter: dot indicator on the filter button
- **Share button**: Only for owner/moderator. "Sdílet" with share icon, dk-btn-secondary, sm
- **Add gift button**: Only for owner/moderator. "Přidat přání" with plus icon, dk-btn-primary, sm

On mobile: view switcher + filter button in one row; share + add in header top-right.

---

## 7. Three View Modes

### Card View (default)

- `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`
- Gap: 20px
- Card: rounded-xl (16px), shadow-md, no border (warm direction) or subtle border (clean direction)
- Image area: 160px fixed height, object-fit cover, gradient placeholder
- Body: 16-20px padding, name → price → link → badges → footer (heart + reserve)

### List View

- Flex column, each row: `grid-template-columns: 64px 1fr auto`
- Thumbnail: 64×64px, rounded-lg
- Row info: name + [price | link | status badges] as a flex meta line
- Row actions: heart + reserve button (right-aligned)
- Hover: subtle bg highlight
- Dividers: 1px border-bottom (last row: none)

### Compact View

- HTML `<table>`, full width, border-collapse
- Columns: Name | Link | Cena | ♡ | Action
- No images
- Row height: ~40px
- Header: 11px uppercase, letter-spaced, border-bottom 2px
- Reserved rows: opacity 0.65 + badge instead of button
- Quantity shown inline with name: "Zahradní nůžky Fiskars ×3"

---

## 8. Colors & Typography

**Primary color:** sage green `oklch(52.7% 0.154 150.069deg)` (light), `oklch(44.8% 0.119 151.328deg)` (dark)

**Semantic colors (from tokens.css):**

- Reserved: `oklch(0.62 0.13 145)` – green-teal
- Liked: `oklch(0.64 0.18 15)` – warm red/coral
- Archived: `oklch(0.55 0.02 250)` – cool gray

**Priority badge colors:**

- Vysoká (High): `oklch(0.65 0.18 25)` (red-orange tint bg + fg)
- Střední (Medium): `oklch(0.72 0.13 75)` (amber tint)
- Nízká (Low): muted/default badge

**Typography (from tokens.css):**

- Headings: Noto Sans (font-heading)
- Body: Figtree (font-sans)
- Owner name: text-2xl (24px), bold, primary
- Wishlist title: text-3xl (32px), bold, tight tracking, Noto Sans
- Gift name: text-base (15px), semibold
- Price: text-lg (17px), bold, primary
- Link: text-xs (12px), primary, inline-flex with icon
- Metadata: text-sm (13px), muted

---

## 9. Interaction Patterns

### Reserve flow

1. Visitor clicks "Rezervovat"
2. If anonymous: modal "Jak se jmenuješ?" (name required, email optional) → confirm
3. If logged in: instant reservation, success toast "Rezervováno!"
4. Button state: changes to "Zrušit rezervaci" (ghost/danger) – only for reserving user
5. Other visitors see: "Rezervováno" badge, disabled button

### Like flow

1. Visitor clicks heart icon
2. Heart fills (red), count increments
3. If clicked again: unfills, decrements
4. No auth required for likes (session-persistent)

### Sort/Filter dropdown

1. Click filter button → dropdown appears below, z-index 20
2. Sort: radio-style (one active, checkmark)
3. Filter: toggle checkboxes
4. Active filters: dot badge on filter button
5. Click outside → dismiss

### View switching

- Instant (no loading state)
- Preference persisted to localStorage

---

## 10. Empty States

**No gifts (draft):**

```
[Gift box illustration]
Zatím tu nic není
Přidej svá první přání a pak seznam sdílej.
[+ Přidat první přání]
```

**No gifts matching filters:**

```
[Search illustration]
Žádná přání neodpovídají filtrům
[Zrušit filtry]
```

**Archived, no gifts:**

```
[Archive illustration]
Tento seznam byl archivován a je prázdný.
```

---

## 11. Accessibility

- All icon-only buttons: `aria-label` in Czech
- View switcher: `role="group"`, each button `aria-pressed`
- Reserve button: `aria-label="Rezervovat {gift name}"`
- Heart: `aria-label="Oblíbit {gift name}"`, `aria-pressed` state
- Reserved badge: conveyed via text, not color alone
- Keyboard: Tab order follows visual order; dropdown dismissable via Escape
- Focus rings: 3px solid `--ring`, 2px offset

---

## 12. Responsive Breakpoints

| Breakpoint         | Card columns | Toolbar                                   |
| ------------------ | ------------ | ----------------------------------------- |
| < 480px (mobile)   | 1 column     | View + filter inline, share/add in header |
| 480–768px (tablet) | 2 columns    | Full toolbar                              |
| 768–1024px         | 3 columns    | Full toolbar                              |
| > 1024px           | 4 columns    | Full toolbar                              |

List view: stacks to thumbnail + name on very narrow screens (actions below name).
Compact view: horizontal scroll on mobile if too many columns.

---

## 13. Variants Summary

| Variant | Layout concept     | Key differentiator                                   |
| ------- | ------------------ | ---------------------------------------------------- |
| 1       | Pinterest masonry  | Staggered heights, organic rhythm, artisan feel      |
| 2       | E-commerce grid    | Uniform cards, professional, familiar to shoppers    |
| 3       | Magazine editorial | Large hero gift, editorial hierarchy, aspirational   |
| 4       | Compact efficient  | Dense, maximizes visible gifts, power-user friendly  |
| 5       | Visual-first       | Large images, minimal text, action overlays on hover |

All variants: sage green primary, Figtree + Noto Sans, Czech text, light + dark mode, full app shell.
