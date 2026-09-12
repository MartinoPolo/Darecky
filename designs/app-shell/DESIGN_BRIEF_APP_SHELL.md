# Design Brief – App Shell / Navigation

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant 1)
> **Refined mockup**: `designs/app-shell/refined.html`
> **Summary**: `designs/app-shell/SUMMARY.md`
> **Refinements**: Logo with dimmed TLD, nav items as links + dropdown triggers, no Dashboard page, cycling dark mode toggle, merged title + toolbar row, explicit sort labels, Lucide icons, light-mode only

## Purpose

The App Shell is the persistent layout chrome that wraps every authenticated page in Přejeme si. It provides global orientation (which app, which user), primary navigation between the three dashboard views, and access to transient UI (notifications, user menu, dark mode toggle). It never competes with page content – it recedes when content is active.

---

## Surrounding Context

Pages that render inside the App Shell:

| Route         | Label           | Notes                                                     |
| ------------- | --------------- | --------------------------------------------------------- |
| `/dashboard`  | Moje seznamy    | Lists the authenticated user's own wishlists (owner role) |
| `/spravovane` | Spravované      | Wishlists where the user is a moderator                   |
| `/sledovane`  | Sledované       | Wishlists the user follows as a visitor                   |
| `/w/:id`      | Wishlist detail | Visitor/moderator view of a specific wishlist             |
| `/profil`     | Profil          | User profile settings                                     |
| `/nastaveni`  | Nastavení       | App preferences (notifications, dark mode)                |

Anonymous visitors (no account) do NOT see the App Shell – they land directly on wishlist pages with a minimal nav strip. The App Shell is authenticated-only.

---

## Requirements

### Navigation Items

**Primary nav links (always visible):**

1. Moje seznamy – `/dashboard`
2. Spravované – `/spravovane`
3. Sledované – `/sledovane`

**Primary action:**

- `+ Vytvořit` – creates a new wishlist (button, not a link)

**Active state:** Current page link is highlighted with primary color indicator (underline, pill, or sidebar highlight depending on variant).

### User Menu

Trigger: avatar with initials (36×36px, `--radius-full`, primary-soft background, primary text).

Dropdown items:

- Profil
- Nastavení
- – divider –
- Odhlásit se (destructive color)

### Notification Bell

- Icon: bell SVG, 24×24px
- Badge: red dot or numeric count (3 nepřečtené in mockups)
- Count badge: 18×18px pill, `--status-danger` background, white text, `--text-xs`
- Position: top-right of bell icon, overlapping

### Dark Mode Toggle

- Three-state: Světlý / Tmavý / Systém
- Variants may show: icon-only toggle (sun/moon), segmented 3-button group, or dropdown
- Stored per-user, not per-session

### Content Area

- `max-width: 1200px` (`--content-max-width`)
- `margin: 0 auto`
- Side padding: `--space-6` (24px) minimum; expands naturally on larger viewports
- Content sits below the nav (top-bar variants) or to the right of the sidebar (sidebar variants)

---

## States

### Authenticated (default)

All nav items visible. Avatar loaded with initials. Notification bell shows count if > 0.

### Loading

Nav renders immediately (no skeleton needed – it's static). Content area below/beside the nav shows a skeleton or spinner per page.

### Mobile (≤768px)

- Top-bar variants: hamburger icon replaces primary nav links; slide-in drawer on open
- Sidebar variants: sidebar collapses to hidden by default; hamburger opens it as an overlay
- `+ Vytvořit` becomes a floating action button (FAB) or moves to the drawer
- User menu and bell remain in the top bar

### Empty states (no wishlists yet)

Handled by the page, not the shell. Shell chrome is identical.

---

## Component Reuse Map

| Shell Component   | Source Tier                                  | Notes                      |
| ----------------- | -------------------------------------------- | -------------------------- |
| Nav bar container | `blocks/AppShell`                            | Owns layout                |
| Logo mark         | `derived/BrandLogo`                          | Text + optional icon       |
| NavLink           | `derived/NavLink`                            | Active state, aria-current |
| AvatarButton      | `derived/AvatarButton`                       | Initials fallback          |
| UserMenuDropdown  | `blocks/UserMenu`                            | Uses base `popover`        |
| NotificationBell  | `blocks/NotificationBell`                    | Badge count                |
| DarkModeToggle    | `derived/DarkModeToggle`                     | 3-state                    |
| CreateButton      | inline in AppShell or `derived/CreateButton` | Primary CTA                |

---

## Layout Constraints

- **Nav height:** `--nav-height: 56px` – fixed in tokens, do not change
- **Sidebar width (persistent):** 240px – comfortable for Czech nav labels
- **Sidebar width (collapsed):** 56px – icons only, no labels
- **Content max-width:** `--content-max-width: 1200px`
- **Z-index:** Nav/sidebar at `--z-sticky: 30`; dropdowns at `--z-dropdown: 20`; overlays at `--z-overlay: 40`
- **Backdrop blur:** `backdrop-filter: blur(12px)` on nav bar when scrolled

---

## Design Tokens Used

From `tokens.css` and `app.css`:

```
--nav-height: 56px
--content-max-width: 1200px
--font-heading: 'Noto Sans'
--font-sans: 'Figtree'
--primary: oklch(52.7% 0.154 150.069deg)   ← sage green
--primary-foreground: oklch(98.2% 0.018 155.826deg)
--background, --foreground, --border, --surface
--shadow-sm, --shadow-md, --shadow-lg
--radius-md, --radius-lg, --radius-full
--space-2 through --space-8
--z-sticky: 30, --z-dropdown: 20
--duration-normal: 150ms, --ease-standard
--status-danger: oklch(0.62 0.2 25)
```

---

## Design Constraints

- Czech text first – all labels in Czech
- No English fallback labels in mockups
- Logo text: `prejemesi` (lowercase, heading font) + `.cz` (muted, 50% opacity)
- Nav bar must not exceed 56px height
- No horizontal scroll on nav bar at any viewport ≥ 320px
- Sage green (`oklch(52.7% 0.154 150.069deg)`) is the only accent color in the shell – never warm amber/honey in this context
- 60-30-10 color rule: background is neutral (90%+ of shell surface), sage green used only for active states, primary CTA, logo, badges
- WCAG AA contrast required for all text
- No emoji in nav labels

---

## Design Freedom

- Logo mark: pure text, text + gift icon, or wordmark with subtle gift motif
- Active nav indicator: underline, left/bottom border stripe, filled pill, or background highlight
- `+ Vytvořit` styling: ghost, outlined, or filled primary – just must read as CTA
- Sidebar: may use full color, white, or subtle gradient background
- Notification dropdown (not required in mockup, but bell + badge should be shown)
- Dark mode toggle placement: may be in user menu dropdown or exposed in nav bar
- Divider lines between nav sections: optional
- Page title in nav bar (breadcrumb variant): allowed in variant 5

---

## Visual References

- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-a-honey.html` is historical provenance only.
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-b-sage.html` is historical provenance only.
- `designs/tokens.css` – authoritative spacing, radius, shadow values

---

## Not Included

The following are OUT OF SCOPE for the App Shell design brief:

- Wishlist page chrome (theme colors, gift cards, hero banners)
- Auth pages (login, register, magic link) – no App Shell
- Anonymous visitor pages – minimal nav strip only, not this shell
- Notification dropdown panel – bell + badge only; panel is a separate design
- Onboarding flows
- Mobile app (v2)
- Footer (none planned for v1)
