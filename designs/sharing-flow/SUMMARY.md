# Sharing Flow – Design Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Base**: Variant 2 – Multi-step wizard | **Refined**: 2026-05-30

## Refinements Applied

Variant 2 was chosen and refined with: approved app shell nav as backdrop, 3-step wizard (confirm → share → success), post-share guidance text listing allowed actions, social intent buttons, moderator invite section, link copy with success feedback, light-mode only. Key changes: added explicit permissions card in Step 3 listing what owner can still do after sharing.

## Component Map

### Codebase – Use As-Is

| Component | Path                                 | Usage                                                                                               | Key Props/Variants                                                                   |
| --------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Button    | `src/lib/components/base/button/`    | Primary (Sdílet), outline (Zrušit, Vytvořit pozvánku), ghost (close ×), destructive-ghost (Odebrat) | `variant="default"`, `variant="outline"`, `variant="ghost"`, `variant="destructive"` |
| Input     | `src/lib/components/base/input/`     | Read-only link field                                                                                | `readonly`                                                                           |
| Badge     | `src/lib/components/base/badge/`     | "Aktivní" moderator status                                                                          | `variant="outline"` with success color                                               |
| Separator | `src/lib/components/base/separator/` | Divides link / social / moderator sections in Step 2                                                | –                                                                                    |

### Adopt from shadcn-svelte / Bits UI

| Component   | Source        | Install command                                  | Purpose                                        |
| ----------- | ------------- | ------------------------------------------------ | ---------------------------------------------- |
| Dialog      | shadcn-svelte | `pnpm dlx shadcn-svelte@latest add dialog`       | Steps 2–3 shell with focus trap + Escape close |
| AlertDialog | shadcn-svelte | `pnpm dlx shadcn-svelte@latest add alert-dialog` | Step 1 confirmation (destructive-consequence)  |

### Build Custom

| Proposed Name          | Description                                                       | Why New                                           |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| WishlistPreviewCard    | Title + theme badge + gift count; read-only snapshot              | No existing card variant covers this mini-preview |
| CopyLinkField          | Input + copy icon button + "Zkopírováno!" success state           | Composed input + button + state management        |
| SocialShareButton      | Full-width row: platform icon + label + chevron; opens intent URL | Platform-specific styling + intent URL generation |
| ModeratorInviteSection | Generate link, active moderator list, per-row revoke              | Complex block with invite token flow              |
| ShareWizard            | Top-level orchestrator: step state machine + Dialog shell         | Wizard pattern not covered by existing components |

## Step State Machine

```
idle
  └─(owner clicks "Sdílet")
      ├─[neverShared=true]  → step: 'confirm'
      └─[neverShared=false] → step: 'share'

confirm
  ├─(Zrušit / Escape / scrim) → step: 'idle'
  └─(Sdílet seznam)           → POST /api/wishlists/:id/share
                                  ├─[ok]    → step: 'share'
                                  └─[error] → step: 'confirm' + toast error

share
  ├─(Hotovo / Escape / scrim) → step: 'idle'
  └─(first open after share)  → step: 'success'

success
  └─(Hotovo / Escape / scrim) → step: 'idle'
```

## Implementation Notes

- Use `base/alert-dialog` for Step 1 (destructive-consequence flow). Use `base/dialog` for Steps 2–3 – same instance, swap content with `{#if}` to avoid remount flicker.
- Clipboard API with `aria-live="polite"` on "Zkopírováno!" text. Fallback: `document.execCommand('copy')`.
- All social intent URLs are client-side only – no server involvement. Open with `window.open(url, '_blank', 'noopener,noreferrer')`.
- Moderator invite: `POST` generates 48h-TTL token. Revoke: `DELETE` with optimistic UI removal.
- Server applies edit lock atomically when share succeeds (`wishlists.sharedAt` set). Do NOT apply lock optimistically client-side.
