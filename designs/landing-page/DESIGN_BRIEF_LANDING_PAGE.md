# Design Brief – Landing Page (Přejeme si)

> **Status**: Refined (Variant 2 – Feature showcase)
> **Refined mockup**: `designs/landing-page/refined.html`
> **Summary**: `designs/landing-page/SUMMARY.md`
> **Refinements**: Consistent logo from app shell, simple public nav, hero + feature sections + how-it-works + footer, Czech text, warm family feel, light-mode only

## 1. Purpose

The landing page is the first screen unauthenticated visitors see. Its sole job is to convert curiosity into sign-up by communicating the core value proposition in under 10 seconds: create a wishlist, share it, let family and friends reserve gifts anonymously – the owner never knows who got what.

Secondary purpose: provide enough feature context to remove doubt ("is this the right tool for me?") without overwhelming.

---

## 2. Surrounding Context

- **Viewport:** Full browser window, optimised for 1440 × 900 desktop. Responsive from 320px.
- **Layout container:** Own standalone layout, not the authenticated app shell. No dashboard sidebar, no breadcrumbs.
- **Navigation:** Simple top bar – logo left, "Přihlásit se" ghost button + "Začít zdarma" primary CTA right.
- **Below the fold:** Sections stacked vertically with consistent horizontal padding. Max-width `1200px`, centred.
- **Footer:** Minimal – copyright + language switcher (CS / EN) + optional social/GitHub link.
- **Background:** Off-white / very-light-green tinted surface in light mode; deep near-black in dark mode. Decorative blobs/gradients allowed in hero only.

---

## 3. Requirements

### Content Sections (in order)

| #   | Section                | Content                                                                                       |
| --- | ---------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **Nav**                | Logo (`prejemesi.cz`), "Přihlásit se" (ghost), "Začít zdarma" (primary)                         |
| 2   | **Hero**               | Headline, subheadline, primary CTA, optional social proof signal (e.g. "Vyzkoušeno v rodině") |
| 3   | **How It Works**       | 4-step process: Vytvořte seznam → Přidejte přání → Sdílejte odkaz → Překvapení!               |
| 4   | **Key Features**       | Tajné rezervace, Tematické seznamy, Sdílení jedním odkazem, Zdarma navždy                     |
| 5   | **App Preview / Mock** | Visual preview of the wishlist UI (cards, list, compact view) – the product in action         |
| 6   | **Trust Signal**       | Small reassurance block: no ads, no payment required, no surprise spoiled                     |
| 7   | **Final CTA**          | Repeat the "Začít zdarma" + "Přihlásit se" pair before the footer                             |
| 8   | **Footer**             | © Přejeme si, language toggle                                                                    |

### Primary CTAs

- "Začít zdarma" – primary green button, large (`dk-btn-lg`)
- "Vytvořit seznam přání" – alternate wording in hero variants

### Trust Signals

- "Zdarma navždy – žádná platební karta"
- "Překvapení je vždy zachováno"
- "Funguje bez registrace pro dárce"
- "Žádné reklamy, žádné sledování"

---

## 4. States

| State                | Behaviour                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default**          | Static; no user data needed. All content is marketing copy.                                                                                                                                                      |
| **Loading**          | Not applicable for the landing page (fully static render).                                                                                                                                                       |
| **Auth-aware**       | If the user is already signed in, the nav CTA changes to "Přejít do aplikace" and the hero CTA changes to "Moje seznamy". This is a progressive enhancement – SSR delivers the signed-out state; JS upgrades it. |
| **Mobile (< 768px)** | Nav collapses to logo + hamburger or logo + single CTA only. Hero becomes single-column. How-it-works steps stack vertically. Feature cards become a 1-column scroll.                                            |
| **Reduced motion**   | No parallax, no auto-play animations. Transitions respect `prefers-reduced-motion`.                                                                                                                              |

---

## 5. Component Reuse Map

The landing page does NOT use the authenticated app shell, but it can reuse base and derived components:

| Need                    | Component                                   |
| ----------------------- | ------------------------------------------- |
| Primary / ghost buttons | `base/button`                               |
| Feature badges          | `base/badge`                                |
| Feature cards           | `base/card` (content-wrapped)               |
| Alert / info strip      | `base/alert`                                |
| Avatar (testimonials)   | Custom inline (no component needed)         |
| Navigation              | Custom `<nav>` – not a shared component yet |

Design mockups should use `dk-btn`, `dk-card`, `dk-badge` from `tokens.css` directly (no framework dependency in HTML prototypes).

---

## 6. Layout Constraints

- **Max content width:** `1200px` (from `--content-max-width` token), centred with `margin: 0 auto`.
- **Nav height:** `56px` (from `--nav-height` token). Sticky with backdrop blur on scroll.
- **Horizontal padding:** `24px` (`--space-6`) on desktop; `16px` (`--space-4`) on mobile.
- **Section vertical rhythm:** `80px` top/bottom padding between sections (`--space-20`).
- **Hero height:** Minimum `calc(100vh - 56px)` on desktop; auto on mobile.
- **Grid columns:** Features section uses 2-col or 4-col grid depending on variant. How-it-works uses 4-col on desktop, 2-col on tablet, 1-col on mobile.
- **App preview:** Full-width within the content column, max-height `480px`, clipped with `overflow: hidden` and a bottom fade gradient to suggest continuity.

---

## 7. Design Tokens

All values reference `../tokens.css`. Key tokens for the landing page:

```
Typography:
  --font-heading (Noto Sans) – hero headlines
  --font-sans (Figtree) – body, nav, buttons
  --text-5xl: 52px – hero headline
  --text-4xl: 40px – section headlines
  --text-3xl: 32px – sub-section heads
  --text-xl / --text-lg – feature titles
  --text-base / --text-sm – body / captions

Spacing:
  --space-20: 80px – section padding
  --space-16: 64px – inner section gaps
  --space-12: 48px – card gap / step gap
  --space-6: 24px – horizontal content padding

Shadows:
  --shadow-lg – feature card on hover
  --shadow-xl – hero visual / app preview

Radii:
  --radius-2xl, --radius-3xl – hero illustration cards
  --radius-full – pill badges / CTA buttons (optional)

Motion:
  --duration-slow: 250ms – hover transitions
  --ease-out – all transforms
  --ease-bounce – CTA button click

Z-index:
  --z-sticky: 30 – sticky nav
```

**Primary color (sage green):**

- Light mode: `oklch(52.7% 0.154 150.069deg)` – buttons, accents, logo
- Dark mode: `oklch(44.8% 0.119 151.328deg)` – slightly desaturated

**Semantic surface palette (light mode):**

```
--background: oklch(98.8% 0.004 150)   /* very slight green tint */
--surface:    oklch(100% 0 0)
--surface-2:  oklch(96.5% 0.008 150)
--foreground: oklch(15% 0.008 150)
--foreground-muted: oklch(45% 0.02 145)
--foreground-subtle: oklch(62% 0.015 145)
--border:     oklch(91% 0.01 150)
--primary:    oklch(52.7% 0.154 150.069deg)
--primary-fg: oklch(98.5% 0.018 155)
--primary-soft: oklch(92% 0.04 150)
```

---

## 8. Design Constraints (Non-Negotiable)

1. **Czech text primary** – all visible copy in Czech. No English placeholder text.
2. **App name "Přejeme si"** – always rendered as `prejemesi.cz` in logo (lowercase, with `.cz` dimmed at 50% opacity).
3. **Sage green primary** – `oklch(52.7% 0.154 150.069deg)`. No orange, yellow, red, or purple primary colors.
4. **Owner-never-sees mechanic must be communicated** – headline or subheadline must make the "nobody sees who reserved what" promise explicit.
5. **No GDPR/cookie banner** – excluded by project decision.
6. **No external icon libraries** – inline SVG or Unicode only.
7. **Fonts via Google Fonts CDN** – `Figtree` + `Noto Sans`.
8. **Standalone HTML** – `<link rel="stylesheet" href="../tokens.css" />` included, no build step.
9. **Both light and dark** shown in every mockup file.
10. **WCAG AA contrast** on all text (min 4.5:1).

---

## 9. Design Freedom (Creative Latitude Areas)

- **Hero composition:** Illustration style (SVG abstract shapes, gift/ribbon motifs, scattered card mockups, CSS art), layout split (50/50 text+visual, full-width text centered, angled split).
- **How-it-works format:** Numbered steps in cards, horizontal timeline with connectors, vertical steps list with icons, staggered comic-strip tiles.
- **Feature section style:** Icon + text cards, large bold feature tiles, two-column alternating text+image, badges-only strip.
- **Decorative elements:** Confetti dots, ribbon curves, subtle grid or dot patterns in hero background, warm/cool gradient blobs.
- **Button shape:** Pill (`--radius-full`) vs rounded rect (`--radius-md`) – vary per variant.
- **App preview format:** Browser chrome mockup, floating phone frame, flat screenshot with drop shadow, angled perspective card.
- **Section transitions:** Wave SVG dividers, diagonal cuts, solid color bands, subtle gradient fades.
- **Social proof placement:** Inline in hero vs dedicated section vs floating badge.

---

## 10. Visual References

- **Tone:** Notion's warmth + Linear's precision + Loom's approachability. Personal, not enterprise.
- **Color family:** Sage green primary (like Craft.do or Notion's green). Warm neutrals for backgrounds.
- **Typography mood:** Clean, slightly humanist (Figtree body; Noto Sans for impact headings).
- **App preview fidelity:** Use actual `dk-card`, `dk-badge`, `dk-btn` components from the design system to show the real UI.
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-a-honey.html` is historical provenance only.

---

## 11. Not Included (Scope Exclusions)

- Authenticated dashboard, wishlist detail page, gift management UI – those are separate page designs.
- Pricing page (app is free-forever, no pricing section needed beyond the "Zdarma navždy" trust signal).
- Blog, changelog, help docs – out of scope for v1.
- Mobile app store badges – no mobile app in v1.
- Cookie/consent UI – excluded by architectural decision.
- Accessibility interactive states (focus traps, ARIA live regions) – these are implementation concerns, not mockup concerns.
- Animation keyframes (beyond CSS hover transitions) – conceptual mockups only; no JS-driven animations needed.
