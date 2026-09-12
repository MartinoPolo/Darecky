# Design Brief – Sharing Flow

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant 2 – Multi-step wizard)
> **Refined mockup**: `designs/sharing-flow/refined.html`
> **Summary**: `designs/sharing-flow/SUMMARY.md`
> **Refinements**: Approved app shell nav as backdrop, 3-step wizard (confirm → share → success), post-share guidance text listing allowed actions, social intent buttons, moderator invite section, link copy with success feedback, light-mode only

## Purpose

The Sharing Flow is the primary mechanism by which a wishlist owner distributes their list to friends and family. It is triggered by the "Sdílet" button in the wishlist header toolbar. The flow has two sequential phases: a one-time lock confirmation (first share only) and the persistent share modal (accessible any time after sharing).

This is a high-stakes moment: sharing permanently changes the owner's editing permissions. The UI must communicate this consequence clearly without creating friction that would deter legitimate sharing.

---

## Surrounding Context

The entire flow overlays the wishlist page (`/w/<short-id>` as owner). The backdrop shows the owner's own wishlist – nav bar, wishlist header with owner name and title, gift grid. The overlay consists of:

1. A semi-transparent scrim (backdrop) covering the full page
2. The dialog or modal on top of the scrim

The owner never sees reservation state, so the background wishlist cards always show unreserved appearance even when reservations exist.

---

## Requirements

### Functional

- First-time share must show a confirmation step explaining the edit lock before revealing the share modal
- Share modal must be accessible on every subsequent "Sdílet" click without repeating the confirmation
- Visitor link must be copyable with immediate visual feedback ("Zkopírováno!")
- Social share buttons must use intent URLs (no API keys):
    - WhatsApp: `https://wa.me/?text=<encoded>`
    - Email: `mailto:?subject=<encoded>&body=<encoded>`
    - Messenger: `fb-messenger://share?link=<encoded>` (falls back to `https://www.facebook.com/dialog/send?link=<encoded>`)
    - Telegram: `https://t.me/share/url?url=<encoded>&text=<encoded>`
    - SMS: `sms:?body=<encoded>`
- Moderator section must be visually secondary to the sharing section – it is a power-user feature
- Moderator invite link generation must be a deliberate action (button, not auto-generated on open)
- Each moderator entry must have an individual "Odvolat" (Revoke) button
- The modal must be closable via: close button (×), pressing Escape, clicking the scrim

### Accessibility

- Focus must be trapped inside the modal while open
- Escape closes the modal
- All interactive elements must be keyboard reachable
- Copy button feedback must be screen-reader announced (aria-live)

---

## States

| State                          | Trigger                                               | Key UI Elements                                                                          |
| ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Confirmation dialog**        | First-ever "Sdílet" click                             | Warning icon, lock-consequence text, "Sdílet" CTA + "Zrušit" cancel                      |
| **Share modal – initial**      | After confirmation (or any subsequent "Sdílet" click) | Wishlist preview card, link field, copy button, social buttons, moderator section        |
| **Link copied**                | User clicks copy button                               | Copy button turns green with checkmark, "Zkopírováno!" label, auto-resets after 2s       |
| **Moderator invite generated** | User clicks "Vygenerovat odkaz"                       | One-time invite link appears in a field with its own copy button; "Platný 48 hodin" note |
| **Moderator list populated**   | After moderators have accepted invites                | List of moderator rows: avatar initial + name + "Aktivní" badge + "Odvolat" button       |
| **Modal closed**               | ×, Escape, or scrim click                             | Modal unmounts; wishlist page is fully interactive again                                 |

---

## Component Reuse Map

| Component                 | Source tier                      | Notes                                                              |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Dialog / Modal shell      | `base/dialog`                    | shadcn dialog primitive                                            |
| Button variants           | `base/button`                    | Primary, secondary, ghost, destructive                             |
| Input field               | `base/input`                     | Read-only for link display                                         |
| Badge                     | `base/badge`                     | "Aktivní" moderator status                                         |
| Separator                 | `base/separator`                 | Divides link, social, moderator sections                           |
| Wishlist preview card     | `derived/WishlistPreviewCard`    | New derived component: title + theme badge + gift count            |
| Copy-link field           | `derived/CopyLinkField`          | Input + copy button + "Zkopírováno!" state                         |
| Social share button row   | `derived/SocialShareButton`      | Icon + label, opens intent URL in new tab                          |
| Moderator invite section  | `blocks/ModeratorInviteSection`  | Generate link, list, revoke – entire sub-feature                   |
| Sharing lock confirmation | `blocks/SharingLockConfirmation` | Warning dialog, shown once, orchestrates transition to share modal |

---

## Layout Constraints

- Modal max-width: 480px (compact), 540px (standard), full-width on mobile with bottom sheet behavior optional
- Modal max-height: 90vh with internal scroll on the moderator list
- Confirmation dialog: narrower – 400px max-width, no scroll needed
- Scrim: `rgba(0,0,0,0.45)` or `oklch(0.1 0 0 / 0.5)`, blurred backdrop optional
- Side sheet (variant 3): 420px wide, full viewport height
- Bottom sheet (variant 5): max-height 80vh, rounded top corners

---

## Design Tokens

### Colors

- Primary (sage green): `oklch(52.7% 0.154 150.069deg)` light / `oklch(44.8% 0.119 151.328deg)` dark
- Primary foreground: `oklch(98.2% 0.018 155.826deg)`
- Background (light): `oklch(100% 0 0deg)` – surfaces use this
- Background (dark): `oklch(15.3% 0.006 107.1deg)`
- Card (dark): `oklch(22.8% 0.013 107.4deg)`
- Border (light): `oklch(93% 0.007 106.5deg)`
- Border (dark): `oklch(100% 0 0deg / 10%)`
- Muted foreground: `oklch(58% 0.031 107.3deg)` (light)
- Status danger: `oklch(57.7% 0.245 27.325deg)` – used for lock warning
- Status success: `oklch(0.66 0.13 145)` – used for "Zkopírováno!" feedback

### Typography

- Body: Figtree Variable, 15px / 1.5
- Heading: Noto Sans Variable, semibold
- Modal title: `--text-xl` (20px), semibold, Noto Sans
- Section eyebrow labels: 11px, uppercase, `--tracking-wider`
- Link field text: `--text-sm` (13px), monospace feel via letter-spacing

### Spacing

- Modal padding: `--space-6` (24px)
- Section gap: `--space-5` (20px)
- Button gap (social row): `--space-3` (12px)

### Radii

- Modal: `--radius-xl` (16px) or `--radius-2xl` (20px)
- Buttons: `--radius-md` (8px) default; `--radius-full` for pill style
- Link field: `--radius-md` (8px)

### Shadows

- Modal: `--shadow-xl`
- Confirmation dialog: `--shadow-lg`

### Motion

- Modal enter: scale(0.95) → scale(1), opacity 0 → 1, `--duration-slow` (250ms), `--ease-out`
- Scrim enter: opacity 0 → 1, `--duration-normal` (150ms)
- Copy feedback: color transition `--duration-fast` (100ms)
- Bottom sheet enter: translateY(100%) → translateY(0), `--duration-slower` (350ms), `--ease-bounce`

---

## Design Constraints

- The confirmation warning must use danger/warning color (not primary green) – this is a destructive-consequence action
- The copy button "Zkopírováno!" feedback must be clearly different from the default state (color change + icon change minimum)
- Social share buttons must not look like the primary CTA – they are secondary actions
- The moderator section must be visually separated and feel like a "pro" area: smaller type, more subdued colors
- No more than one primary button visible at a time per step
- The permanent visitor URL must be displayed in full (`prejemesi.cz/w/xk9m2p`) – users need to recognize and trust the link
- Pre-filled share message must be shown collapsed or as a small hint – not as a dominant text block

---

## Design Freedom

- Visual treatment of the social platform buttons (icon only vs icon + label, pill vs rectangle, grid vs column)
- Whether to use a tab bar, accordion, or flat scroll for organizing link / social / moderator sections
- Illustration or icon in the confirmation dialog header
- Wishlist preview card style (minimal chip vs fuller card)
- Whether the moderator section is inside the same modal or accessible via a secondary "Moderátoři" button
- Animation style for modal entrance
- Whether the link field has a light inset background or standard input styling

---

## Visual References

- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-a-honey.html` is historical provenance only.
- `designs/tokens.css` – full token vocabulary
- `src/app.css` – actual production color tokens (use these, not Direction A colors)
- App primary = sage green `oklch(52.7% 0.154 150.069deg)` – warm-cool neutral feel, not aggressive

---

## Not Included

- The actual wishlist edit-lock enforcement UI (banner shown after sharing – separate feature)
- Owner self-promote to moderator flow (separate dialog)
- Moderator invitation acceptance flow (email → magic link → role assignment)
- Notification system for moderator activity
- Archiving flow
- Gift management modals
- Mobile responsive breakpoints (these mockups target desktop viewport ~1280px)
