# Wishlist Visuals & Settings Workflow – Design Summary

**Base**: Variant A (tabbed slot editor) | **Refined**: 2026-06-02

## Refinements Applied

Variant A was chosen for its per-slot tab switcher (Karta / Miniatura / Záhlaví / Sdílení), its app
nav, and its settings section nav. See the design brief for full requirements. Changes applied on
top of Variant A:

1. **Zoom slider added** (adapted from Variant B) – a `Slider`-style control sits directly under the
   fit-mode toggle in the crop stage column, active only in `cover-crop` (disabled with an em-dash
   in `auto` / `contain-padded` and while no image is assigned). Range 100–300 %.
2. **Mouse-wheel zoom on the crop stage** – scrolling over the stage zooms the image (anchored on
   the focal point) and keeps the slider, fill bar, and % label in sync. `wheel` is `preventDefault`-ed
   over the stage so the page doesn't scroll while cropping.
3. **Dark-mode contrast fix** – `--foreground-subtle` was lifted from `oklch(0.5 …)` to
   `oklch(0.66 …)` in `.theme-dark`. This fixes the dim/low-contrast text _around the previews_ (rail
   titles, mini-info captions, fallback notes, tab ratios) that the user flagged. `.mini-info b` and
   `.preset .plabel` were also pinned to `--foreground` so labels stay crisp in both modes.
4. **Token path corrected** – `refined.html` links `../tokens.css` (one level up from `variants/`).
   The `.theme-light` / `.theme-dark` color blocks stay inlined because `tokens.css` owns only
   structural tokens; the surface palette lives in `src/app.css` / per-theme blocks.

Kept as-is from Variant A: layout, nav, settings nav, image-assignment panel, four-slot tab switcher

- "Všechna místa" rail, theme preset grid, and the realistic card preview. The light page shows the
  has-image state; the dark page shows the no-image theme-aware fallback.

## Component Map

### Codebase – Use As-Is

| Component          | Path                                           | Usage                                                 | Key Props/Variants               |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| `ImageUpload`      | `src/lib/components/derived/image-upload/`     | Image assignment drop zone / replace-remove           | derived drop zone + preview      |
| `Tabs`             | `src/lib/components/base/tabs/`                | Slot switcher (Karta / Miniatura / Záhlaví / Sdílení) | `Tabs.List` + `Tabs.Trigger`     |
| `ToggleGroup`      | `src/lib/components/base/toggle-group/`        | Fit-mode switch (auto / contain-padded / cover-crop)  | single-select                    |
| `Slider`           | `src/lib/components/base/` (adopt if absent)   | **Zoom within cover-crop** (new in refine)            | single value, min 100 / max 300  |
| `RadioGroup`       | `src/lib/components/base/radio-group/`         | Theme preset selection (single-select)                | preset cards as radio options    |
| `Card`             | `src/lib/components/base/card/`                | Section panels + realistic card preview               | Header/Title/Description/Content |
| `Button`           | `src/lib/components/base/button/`              | Save, Replace, Remove, controls                       | default / outline / ghost / sm   |
| `Badge`            | `src/lib/components/base/badge/`               | Slot / occasion labels (`.tag`)                       | secondary / occasion             |
| `Alert`            | `src/lib/components/base/alert/`               | Upload error                                          | `variant="destructive"`          |
| `Separator`        | `src/lib/components/base/separator/`           | Section dividers                                      | –                                |
| `Skeleton`         | `src/lib/components/base/skeleton/`            | Slot preview loading                                  | –                                |
| `Tooltip`          | `src/lib/components/base/tooltip/`             | Fit-mode / focal-point / zoom hints                   | –                                |
| `Progress`         | `src/lib/components/base/progress/`            | Upload progress                                       | –                                |
| `dark-mode-toggle` | `src/lib/components/derived/dark-mode-toggle/` | Mode demonstration affordance                         | derived                          |

### Adopt from shadcn-svelte / Bits UI

| Component | Source        | Install command                            | Purpose                                                                       |
| --------- | ------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `Slider`  | shadcn-svelte | `pnpm dlx shadcn-svelte@latest add slider` | Only if a base `Slider` is not already present – drives the new zoom control. |

### Build Custom

| Proposed Name          | Description                                                             | Why existing components don't cover it                      |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `WishlistCropEditor`   | One image → four constrained per-slot crops with live previews + zoom   | No existing multi-slot crop composer; composes #34 renderer |
| `SlotPreviewCard`      | Renders a single slot at representative size (card/thumb/banner/social) | Slot-specific framing wrapper around #34 renderer           |
| `ThemeCardPreview`     | Realistic wishlist-card preview reacting to theme × image/fallback      | Replaces thin accent-line preview (acceptance criterion)    |
| `WishlistFallbackHero` | Theme-aware bg + large emoji fallback, scale-aware                      | Standardizes REQ-3 across all surfaces                      |

## Implementation Notes

- **Zoom maps to the #34 renderer**, not a parallel transform: zoom scales the `cover-crop` window
  around the focal point; the normalized crop rect + zoom factor persist via #35. The mockup fakes
  this with a CSS `transform: scale()` on the stage image anchored at the focal origin (`56% 38%`).
- **Wheel handler must `preventDefault`** while pointer is over the stage so the settings page does
  not scroll mid-crop; restore normal scroll once the pointer leaves. Consider a modifier (e.g. only
  zoom on wheel, pan on drag) to avoid hijacking trackpad scroll – evaluate during implementation.
- **Zoom is cover-crop-only**: disable (and visually dim) the slider in `auto` / `contain-padded`
  and whenever no image is assigned, mirroring the disabled state shown in the dark page.
- **Dark-mode legibility**: the `--foreground-subtle` lift is the fix for the flagged preview text;
  keep subtle text ≥ `oklch(0.66 …)` on dark surfaces and verify WCAG AA for every theme tint.
- **Slider a11y**: `role="slider"` with `aria-valuemin/max/now`, arrow-key stepping (±5 %), visible
  focus ring via `--ring`. Use the base `Slider` primitive in the real build rather than a hand-rolled
  knob.
- Persistence, fit-mode semantics, and bg-fill priority are all delegated to **#34 / #35** – this UI
  only produces the metadata `{ perSlot: { fitMode, cropRect, zoom }, theme }`.
