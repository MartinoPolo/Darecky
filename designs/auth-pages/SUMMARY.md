# Auth Pages – Refined Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

Variant 2 – Split Screen · Light mode only · 2026-05-30

---

## Component Map

| Component               | File (planned)                                                | Description                                                                             |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `AuthLayout`            | `src/routes/(auth)/+layout.svelte`                            | Standalone layout, no app shell. Hosts split-screen grid.                               |
| `AuthBrandPanel`        | `src/lib/components/blocks/auth/AuthBrandPanel.svelte`        | Left 45%: sage green gradient, logo, illustration, tagline, feature list, bottom badge. |
| `AuthFormPanel`         | `src/lib/components/blocks/auth/AuthFormPanel.svelte`         | Right 55%: white background, centers form inner.                                        |
| `AuthLogo`              | `src/lib/components/blocks/auth/AuthLogo.svelte`              | Gift-box SVG icon + wordmark + dimmed TLD. Consistent with app-shell logo.              |
| `FormField`             | `src/lib/components/derived/FormField.svelte`                 | Label + input + optional error message. Wraps base Input.                               |
| `PasswordField`         | `src/lib/components/derived/PasswordField.svelte`             | FormField + eye/eye-off toggle. Strength bar variant for registration.                  |
| `PrimaryButton`         | `src/lib/components/base/button/`                             | Full-width, loading state (spinner + disabled), maps to shadcn Button.                  |
| `GoogleOAuthButton`     | `src/lib/components/derived/GoogleOAuthButton.svelte`         | Outline button with inline Google G SVG. Used on login and register.                    |
| `AuthDivider`           | `src/lib/components/derived/AuthDivider.svelte`               | Horizontal rule with centered "nebo" label.                                             |
| `ErrorBanner`           | `src/lib/components/derived/ErrorBanner.svelte`               | Red soft background banner for server-level errors (wrong credentials, rate limit).     |
| `MagicLinkSuccessState` | `src/lib/components/blocks/auth/MagicLinkSuccessState.svelte` | Replaces form on success. Shows email address, 15-min expiry notice, back link.         |
| `AuthFooterLinks`       | `src/lib/components/blocks/auth/AuthFooterLinks.svelte`       | Nemáte účet / Již máte účet toggle links.                                               |

---

## Route Structure

```
src/routes/(auth)/
  +layout.svelte      ← standalone layout (no nav/sidebar)
  login/
    +page.svelte      ← Přihlášení
  register/
    +page.svelte      ← Registrace
  magic-link/
    +page.svelte      ← Magický odkaz (form + success state)
```

---

## BetterAuth Integration

- Auth provider: `better-auth` with `better-auth/minimal` for Cloudflare Workers edge compatibility.
- Catch-all route: `src/routes/api/auth/[...all]/+server.ts` handles all BetterAuth callbacks.
- Login form: `POST /api/auth/sign-in/email` → on success redirect to `callbackUrl` or `/dashboard`.
- Register form: `POST /api/auth/sign-up/email` → brief success message, then redirect to `/dashboard`.
- Google OAuth: `GET /api/auth/sign-in/social?provider=google` → OAuth redirect flow, Google profile image stored in session.
- Magic link: `POST /api/auth/sign-in/magic-link` → replace form with `MagicLinkSuccessState`. Clicking link in email calls `/api/auth/verify-magic-link?token=…`.
- Session check: `locals.user` populated by BetterAuth handle hook in `src/hooks.server.ts`.
- Redirect after auth: preserve original URL via `callbackUrl` query param (e.g. `/login?callbackUrl=/w/abc123` for wishlist visitors arriving unauthenticated).

---

## Form Validation

- Validation runs on blur (not on keystroke) – per design brief.
- Client-side: `zod` schemas per form, validated in `+page.svelte` before submission.
- Server-side: BetterAuth returns structured errors; map to field-level `is-error` state + `ErrorBanner` for server errors.
- Error messages in Czech (defined in `src/lib/i18n/` via Paraglide JS).

| Form       | Fields                | Validation rules                                                   |
| ---------- | --------------------- | ------------------------------------------------------------------ |
| Login      | email, password       | email format; password non-empty                                   |
| Register   | name, email, password | name ≥ 2 chars; email format; password ≥ 8 chars, strength bar 1–4 |
| Magic link | email                 | email format                                                       |

---

## Google OAuth Button

- Inline SVG Google G logo (4-path official mark, no external image dep).
- Button label: "Přihlásit přes Google" (login) / "Registrovat přes Google" (register).
- Triggers `signIn.social({ provider: 'google', callbackURL: callbackUrl })` from BetterAuth client.
- Loading state: spinner replaces G icon, button disabled.
- Error handling: if OAuth fails (popup blocked, user cancels), show `ErrorBanner` with generic Czech message.

---

## Magic Link Flow

1. User enters email → clicks "Odeslat přihlašovací odkaz".
2. Loading state: spinner in button, input disabled.
3. BetterAuth sends email via Resend (configured in `src/lib/server/auth.ts`).
4. Form replaced with `MagicLinkSuccessState` showing: email address, 15-min expiry, spam folder hint.
5. User clicks link in email → BetterAuth verifies token → sets session cookie → redirects to `callbackUrl` or `/dashboard`.
6. Token expiry: 15 minutes (BetterAuth default, configurable).
7. "Zpět na přihlášení" link returns to login page, clearing success state.

---

## Redirect After Auth

- Wishlist visitors arriving unauthenticated are redirected to `/login?callbackUrl=/w/<id>`.
- After successful auth (any method), redirect to `callbackUrl` if present and path is local (security: reject external URLs).
- Default redirect: `/dashboard` (Moje seznamy page).
- Implementation: `src/hooks.server.ts` sets `callbackUrl` in `locals`; login/register pages read it and pass to BetterAuth.

---

## Design Tokens Used

| Token             | Value                           | Use                                                 |
| ----------------- | ------------------------------- | --------------------------------------------------- |
| `--primary`       | `oklch(52.7% 0.154 150.069deg)` | Brand panel bg, primary buttons, focus rings, links |
| `--panel-bg-deep` | `oklch(0.38 0.12 150)`          | Brand panel gradient end                            |
| `--surface`       | `oklch(1 0 0)`                  | Form panel background                               |
| `--error`         | `oklch(0.577 0.245 27.325deg)`  | Error borders, error text, error banner             |
| `--error-soft`    | `oklch(0.97 0.025 27)`          | Error banner background                             |
| `--success`       | `oklch(0.66 0.13 145)`          | Password strength bar, success state icon           |
| `--success-soft`  | `oklch(0.95 0.04 145)`          | Success icon circle background                      |
| `--border`        | `oklch(0.918 0.012 150)`        | Input borders (default)                             |
| `--font-sans`     | Figtree Variable                | Form labels, inputs, buttons                        |
| `--font-heading`  | Noto Sans Variable              | Form headings, logo wordmark                        |

---

## Layout Constraints

- Viewport minimum: 1280px desktop (mobile layout: TBD, stacks vertically).
- Brand panel: 45% width, `min-height: 100vh`, sticky for tall forms.
- Form panel: 55% width, centered content, `max-width: 420px` for form inner.
- Form field gap: 16px (`--space-4`).
- Primary CTA: `margin-top: 24px` (`--space-6`) from last field.
- "Nebo" divider: 20px above/below (`--space-5`).
- Footer links: `margin-top: 24px`, centered.
