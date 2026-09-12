# Gift Detail Modal – Refined Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Mockup:** `designs/gift-detail-modal/refined.html`
**Base variant:** Variant 1 – center modal, 2-column (image left / details right)
**Date:** 2026-05-30

---

## Component Map

```
blocks/gift-detail-modal/
  GiftDetailModal.svelte          – orchestrator: open state, role prop, scroll lock, focus trap
  GiftDetailImage.svelte          – product image with lazy loading + placeholder fallback
  GiftDetailMeta.svelte           – name, description, price, external link, priority badge, dates
  GiftDetailActions.svelte        – role-aware buttons (Rezervovat / Zrušit rezervaci / nothing for owner)
  GiftDetailReserveForm.svelte    – quantity selector + anonymous identity form (v1: qty=1 only)
  GiftDetailReservations.svelte   – moderator-only table: who reserved + when
  GiftDetailSkeleton.svelte       – shimmer skeleton for name, description, image during load

derived/
  PriorityBadge.svelte            – reusable pill badge (Nízká / Střední / Vysoká); used on cards too
  LikeButton.svelte               – heart icon + count, optimistic update via SvelteKit remote command

base/
  badge/, button/, dialog/        – shadcn-svelte primitives; Dialog handles backdrop + aria role
```

---

## Visitor States Shown in Refined Mockup

| State                   | Trigger                        | Key visual                                                                            |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| **Default – available** | Gift not reserved              | "Rezervovat" primary button active                                                    |
| **Reserved by me**      | Visitor has active reservation | Green "Rezervováno vámi" banner + "Zrušit rezervaci" destructive outline button       |
| **Fully reserved**      | All units claimed by others    | "Plně rezervováno" muted label, no action button, image desaturated, name/price muted |

---

## Implementation Notes

### Dialog Component (shadcn-svelte)

Use `<Dialog.Root>` / `<Dialog.Content>` from `src/lib/components/base/dialog/`. The `Dialog.Content` provides:

- `role="dialog"` + `aria-modal="true"` automatically
- Portal rendering to `<body>` (avoids z-index stacking context issues)
- Managed open/close state via `bind:open`

### Keyboard Navigation

- **Esc** closes the modal – handled by Dialog primitive natively
- **Tab** cycles focus within modal only – Dialog primitive's focus trap handles this
- Close button (×) must be the first focusable element for screen reader discoverability

### Focus Trap

Dialog primitive implements focus trap automatically. Ensure no `tabindex="-1"` is applied to interactive elements inside the modal. On open, focus should land on the modal container (Dialog.Content) or the first focusable element (close button).

### Scroll Lock

Apply `overflow: hidden` to `<body>` while modal is open. shadcn Dialog primitive does this automatically. If using a custom solution: set in `onMount` / `onDestroy` of `GiftDetailModal.svelte`.

### Image Lazy Loading

`GiftDetailImage.svelte` renders `<img loading="lazy" decoding="async">`. Show `GiftDetailSkeleton` shimmer until image `load` event fires. Placeholder SVG shown when `gift.imageUrl` is null.

### Surprise Protection (Owner Role)

`GiftDetailActions.svelte` receives a `role: 'owner' | 'visitor' | 'moderator'` prop. When `role === 'owner'`:

- Render nothing where reservation state would be (no availability pill, no reserve button, no "Plně rezervováno" label)
- Owner sees only: image, name, price, description, link, priority badge, like button, added date

### Responsive Stacking (Mobile)

At `<640px` breakpoint: `grid-template-columns: 1fr` – image stacks above details. Image collapses to `200px` height with `object-fit: cover`. Modal becomes full-screen (`width: 100vw; height: 100dvh; border-radius: 0`).

### Backdrop

```css
backdrop-filter: blur(8px);
background: oklch(0 0 0 / 0.5);
```

Wrap blur animation in `@media (prefers-reduced-motion: reduce)` to skip the animated blur (but keep the opacity overlay).

### Animation

Open: scale from `0.96` + fade in, `250ms var(--ease-out)`.
Close: scale to `0.96` + fade out, `150ms var(--ease-standard)`.
Use Svelte's `scale` + `fade` transitions on `Dialog.Content`.

### Like Button (Optimistic Update)

`LikeButton.svelte` fires a `command` remote function (`toggleGiftLike`) and updates local count optimistically. Roll back on error. `aria-pressed` reflects liked state.

### External Link

Opens `target="_blank" rel="noopener noreferrer"`. Domain extracted from `gift.url` for display label (e.g., "Koupit na alza.cz ↗").

### Quantity = 1 Hidden Rule

The quantity selector (GiftDetailReserveForm) is hidden when `gift.quantity === 1` – the reserve button directly triggers reservation without asking for quantity. Quantity selector appears only when `gift.quantity > 1`.
