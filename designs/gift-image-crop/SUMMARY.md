# Gift Image Crop Workflow – Design Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Base**: Variant A (stage + preview strip) | **Refined**: 2026-06-02

## Refinements Applied

Variant A was accepted as-is ("variant A is amazing, go with that") – no layout changes
requested. The refinement pass therefore promotes Variant A to the authoritative design and adds
the items a single happy-path variant left implicit. See the design brief for full requirements.

Key changes from the base variant:

1. **Token path corrected** – `refined.html` lives one level above `variants/`, so it links
   `../tokens.css` (the variant used `../../tokens.css`). Color palettes stay inlined because
   `tokens.css` owns only structural tokens (typography/spacing/radii/shadows/motion); colors live
   in the per-theme files / `src/app.css`.
2. **Full state coverage** – the base variant showed only Crop-active. Refined renders every state
   from brief §4 via a mockup-only state switcher: **Auto** (with the REQ-4 extreme-AR bias visible
   – card slot stays `contain` to keep the whole product, squares `cover`), **Fit whole**
   (`contain` everywhere, bg-fill visible), **Crop** (canvas + thirds + handles, all slots `cover`
   off the shared focal point), **Loading** (skeleton shimmer on stage + tiles), **External URL**
   (bg-fill falls back to the wishlist token, not an extracted color), and **Empty** (placeholder;
   fit controls disabled + previews hidden).
3. **bg-fill priority made legible** – a fill chip names the active tier (extracted image color vs.
   wishlist token) so the §3.4 priority chain is reviewable, and the external-URL state proves the
   token fallback.
4. **A11y/affordance polish** – segmented control gets `:focus-visible` ring, slot captions carry
   their exact aspect ratio (3:2 / 3:4 / 1:1 / 1:1), crop handles use ring+outline (not color
   alone), and the control set disables in the empty state.

## Post-Refinement Tweaks (review feedback)

1. **Real preview image** – `--src-img` now points at the same Unsplash photo Variant A
   used (a `url()`), so the stage and all four preview tiles render a real image instead
   of a faked gradient. One token drives every surface.
2. **Loading shimmer** – slowed `1.3s → 2.4s` with `ease-in-out`, and the highlight is now
   a brand-tinted `--skeleton-shine` (`color-mix(primary → surface-2)`) over `--skeleton-base`
   so the sweep is clearly visible. The skeleton tokens are redefined under `.dark` (var()
   in a custom property substitutes where declared, and `.dark` sits on `<body>`, not
   `:root`). A `.pv-frame .ph.skeleton` rule keeps loading tiles showing only the shimmer
   (the real photo would otherwise paint through via the `cover` rule).
3. **Empty state = ImageUpload dropzone** – `.stage-empty` now mirrors
   `src/lib/components/derived/image-upload`: dashed `border-2` drop target, Lucide `upload`
   icon, "Přetáhněte obrázek sem nebo klikněte pro výběr" label, hover border/bg affordance –
   instead of the prior bare centered placeholder.

## Component Map

### Codebase – Use As-Is

| Component     | Path                                       | Usage                                                             | Key Props/Variants          |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------- | --------------------------- |
| `ToggleGroup` | `src/lib/components/base/toggle-group/`    | Auto / Celý obrázek / Oříznout fit-mode segmented control (REQ-1) | single-select, 3 items      |
| `Dialog`      | `src/lib/components/base/dialog/`          | The existing `GiftDetailModal` shell, backdrop, close – unchanged | existing modal              |
| `Label`       | `src/lib/components/base/label/`           | Field + slot labels                                               | –                           |
| `Input`       | `src/lib/components/base/input/`           | Image URL field (preserved), other form fields                    | –                           |
| `ImageUpload` | `src/lib/components/derived/image-upload/` | Upload tab (preserved)                                            | `target="gift-image"` small |
| `Button`      | `src/lib/components/base/button/`          | "Obnovit ořez"; existing Uložit / Označit / Smazat                | `intent="ghost"` / primary  |
| `Separator`   | `src/lib/components/base/separator/`       | Form/action divider (preserved)                                   | –                           |
| `HelpText`    | `src/lib/components/base/help-text/`       | Helper note (Auto extreme-AR bias, fill explanation)              | –                           |
| `Skeleton`    | `src/lib/components/base/skeleton/`        | Preview-tile + stage loading state                                | –                           |
| `Tooltip`     | `src/lib/components/base/tooltip/`         | Optional: explain each fit mode / slot on hover                   | –                           |

### Adopt from shadcn-svelte / Bits UI

None – the segmented control is the existing `ToggleGroup`; no new primitives needed.

### Build Custom

| Proposed Name           | Description                                                                                        | Why existing components don't cover it                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GiftImageCropCanvas`   | Crop surface: source image + draggable/resizable rect + thirds grid, emits normalized `{x,y,w,h}`. | No crop primitive exists; must produce the normalized rect that feeds the shared #34 renderer. |
| `GiftImagePreviewSlots` | The 4-tile preview cluster, binding the shared renderer to each slot aspect (3:2/3:4/1:1/1:1).     | App-specific composition of the #34 renderer at the four known consumer ratios.                |

> Neither custom component re-implements fitting – the actual painting is the **#34** shared image
> renderer. They only provide the crop interaction and the preview layout.

## Implementation Notes

- **Renderer dependency (#34)**: the three fit modes map onto the renderer's `auto` /
  `contain-padded` / `cover-crop`. Both the preview tiles and the production consumers (`GiftCard`,
  `GiftListItem`, detail modal, `ReserveModal`) must render through the same renderer so previews
  are pixel-faithful – do not add parallel `object-fit` rules.
- **One crop, all slots**: crop is a single normalized `{x,y,w,h}` in 0–1 space; each slot derives
  its visible window by centering within that rect (not per-slot crops). In the mockup this is
  faked with a shared `background-position` focal point across all `cover` slots.
- **Auto bias (REQ-4)** is a per-slot decision inside the renderer: when the image is extreme
  relative to a slot it falls back to `contain` (keep whole product) rather than slicing; near-ratio
  slots use `cover`. The mockup shows this by rendering the Auto card slot as `contain`.
- **bg-fill priority** (extracted/manual color → wishlist token → global token): external URLs skip
  extraction (CORS) and fall to the wishlist token. Persist an optional `bgColor` so a manual
  override is possible.
- **Persistence (#35)**: save `{ fitMode, cropRect?, bgColor? }` alongside existing gift fields via
  the existing Save action – no new save button. Switching away from Crop retains the last rect.
- **Empty state**: fit controls + previews only mount once an image exists; the placeholder and the
  URL/Upload tabs are the current behavior, preserved.
- **Mobile (<720px)**: modal body collapses to one column; the preview strip wraps. Crop canvas
  stays full-width, max-height ~280px so Save never goes below the fold.
- **A11y**: `ToggleGroup` arrow-key selection; crop handles ≥12px hit target with ring+outline;
  WCAG AA on labels/helper text; `:focus-visible` rings via `--ring` / `--focus-ring-width`.
- The state switcher in `refined.html` is **mockup-only review chrome** – in Svelte these states
  are derived from `fitMode`, image load status, and `cropRect`, not a manual toggle.
