# Design Brief – Auth Pages

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant 2 – Split screen)
> **Refined mockup**: `designs/auth-pages/refined.html`
> **Summary**: `designs/auth-pages/SUMMARY.md`
> **Refinements**: Consistent logo from app shell, all 3 auth forms (login + register + magic link), error state on login, magic link success state, Google OAuth button, split-screen with sage green branding panel, light-mode only

Přejeme si · Auth layout · Czech primary · 2026-05-30

---

## Purpose

The auth pages are the first screen a new or returning user sees before entering
the app. They must convey warmth and trust quickly, authenticate the user with
minimum friction, and get out of the way. Magic link is the priority path for
casual visitors arriving from a shared wishlist link.

---

## Surrounding Context

Auth pages run under a **separate, unauthenticated layout** – no app shell nav,
no sidebar, no dashboard chrome. The full viewport belongs to the auth form.
After successful auth the user is redirected into the app (dashboard or the
original wishlist they were viewing).

---

## Requirements

### 1. Přihlášení (Login)

| Element                              | Notes                                       |
| ------------------------------------ | ------------------------------------------- |
| Email field                          | `type="email"`, autofocus                   |
| Password field                       | `type="password"`, show/hide toggle         |
| "Přihlásit se" button                | Primary CTA, full-width                     |
| "Přihlásit přes Google" button       | Secondary, Google color logo                |
| "Přihlásit se odkazem" link          | Opens magic link form; lowest friction path |
| "Nemáte účet? Zaregistrujte se" link | Navigates to Register form                  |
| "Zapomněli jste heslo?" link         | Small, below password field                 |

### 2. Registrace (Register)

| Element                            | Notes                                              |
| ---------------------------------- | -------------------------------------------------- |
| Name field                         | `type="text"`, full name                           |
| Email field                        | `type="email"`                                     |
| Password field                     | `type="password"`, show/hide toggle, strength hint |
| Password confirmation field        | `type="password"`                                  |
| "Vytvořit účet" button             | Primary CTA, full-width                            |
| "Registrovat přes Google" button   | Secondary, Google color logo                       |
| "Již máte účet? Přihlaste se" link | Navigates to Login form                            |

### 3. Magický odkaz (Magic Link)

| Element                             | Notes                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Email field                         | `type="email"`, autofocus                                                      |
| "Odeslat přihlašovací odkaz" button | Primary CTA, full-width                                                        |
| Success state                       | "Odkaz odeslán! Zkontrolujte svou emailovou schránku." + envelope illustration |
| "Zpět na přihlášení" link           | Always visible                                                                 |

---

## States per Form

| State       | Behaviour                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Default** | Empty fields, placeholder text, all controls enabled                                                                               |
| **Filled**  | User has typed; validation runs on blur (not on keystroke)                                                                         |
| **Loading** | Primary button shows spinner, all inputs disabled, opacity 0.7                                                                     |
| **Error**   | Red border on the offending field(s) + inline error text below; banner error for server errors (e.g. "Nesprávný email nebo heslo") |
| **Success** | Magic link: replace form with confirmation message + icon. Register: brief success message, then redirect.                         |

---

## Component Reuse Map

| Component          | Used in                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `AuthCard`         | Wrapper for all three forms – consistent padding, max-width, optional illustration |
| `AuthLogo`         | Logo + tagline at top of card; same across all three forms                         |
| `FormField`        | Label + input + optional error message; reused for every field                     |
| `PasswordField`    | `FormField` + show/hide toggle button                                              |
| `PrimaryButton`    | "Přihlásit se", "Vytvořit účet", "Odeslat odkaz" – loading state baked in          |
| `SocialButton`     | Google OAuth button – consistent across login and register                         |
| `DividerWithLabel` | "nebo" separator between social and email/password sections                        |
| `AuthFooterLinks`  | "Nemáte účet?", "Již máte účet?" – switches between forms                          |
| `SuccessState`     | Magic link sent confirmation; reusable for any async success                       |

---

## Layout Constraints

- Max card width: **440px** (login/magic link), **480px** (register – extra fields)
- Card must be **vertically centered** in viewport on desktop; top-aligned with padding on mobile
- Logo area fixed height ~**80px** above form fields
- Form stack: `gap: 16px` between fields, `gap: 24px` between field group and primary CTA
- "Nebo" divider adds `24px` above/below
- Social button below primary CTA (or above – variant decision)
- Footer links: `margin-top: 24px`, centered, small text
- Mobile: card fills width with `16px` horizontal padding; no box shadow on very small screens

---

## Design Tokens in Use

From `tokens.css` and `app.css`:

| Token                | Value                                      | Use                               |
| -------------------- | ------------------------------------------ | --------------------------------- |
| `--primary`          | `oklch(52.7% 0.154 150.069deg)` (light)    | Primary button, logo, focus rings |
| `--background`       | `oklch(100% 0 0)` (light)                  | Page background                   |
| `--card`             | `oklch(100% 0 0)` (light)                  | Card surface                      |
| `--border`           | `oklch(93% 0.007 106.5deg)`                | Input borders                     |
| `--input`            | `oklch(93% 0.007 106.5deg)`                | Input background hint             |
| `--ring`             | `oklch(73.7% 0.021 106.9deg)`              | Focus ring                        |
| `--destructive`      | `oklch(57.7% 0.245 27.325deg)`             | Error states                      |
| `--muted-foreground` | `oklch(58% 0.031 107.3deg)`                | Placeholder, helper text          |
| `--font-sans`        | Figtree Variable                           | Body, inputs, buttons             |
| `--font-heading`     | Noto Sans Variable                         | Logo, form titles                 |
| `--radius-md`        | `8px` (computed from `--radius: 0.625rem`) | Inputs, buttons                   |
| `--radius-lg`        | `10px`                                     | Card                              |
| `--shadow-md`        | multi-layer subtle shadow                  | Card elevation                    |

Dark mode tokens from `.dark` class apply automatically.

---

## Design Constraints

- **No GDPR banner** – decision confirmed
- **No navigation** – auth layout has no app nav
- Logo links back to landing/home (`/`)
- Error messages in Czech
- Google button uses the official Google "G" SVG logo (inline); no external image deps
- Password show/hide uses eye/eye-off SVG icons (inline)
- Loading spinner is a simple CSS animation (no JS library)
- All interactive states must be visible in the static mockup (show multiple states simultaneously)
- Dark and light mode both shown in every variant

---

## Design Freedom

- Logo treatment: wordmark only vs wordmark + gift icon glyph
- Background of the auth page: plain color, very subtle texture, radial gradient, or illustration
- Card shape: sharp, medium-radius, or pill-like rounded corners
- Form field style: outlined, filled (surface-2), or underline-only
- Position of social button: above or below email/password block
- Tagline presence: shown in all variants or only some
- "Nebo" divider: horizontal line with text, or text only
- Illustration/decoration: gift box SVGs, ribbon shapes, abstract geometric

---

## Visual References

- `direction-a-honey.html` – warmth, rounded buttons (pill), no card borders, shadow-elevated cards
- `tokens.css` – spacing, type scale, shadow system
- `app.css` – exact color tokens, font stack
- Primary color is **sage green** `oklch(52.7% 0.154 150.069deg)` – fresh, gift-giving, friendly
- The Honey direction shows the level of polish expected; auth pages should match or exceed it

---

## Not Included

- Password reset form (receives email, sends reset link) – separate brief
- OAuth callback / error screens
- Email verification screen (post-registration)
- Two-factor authentication
- Anonymous visitor modal (separate component, not an auth page)
- Account settings / profile editing
