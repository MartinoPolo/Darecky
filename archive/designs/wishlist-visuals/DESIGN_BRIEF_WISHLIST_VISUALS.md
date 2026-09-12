# Wishlist Visuals & Settings Workflow – Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/wishlist-visuals/refined.html`
> **Summary**: `designs/wishlist-visuals/SUMMARY.md`
> **Refinements**: based on Variant A (slot tab switcher + nav + settings nav kept); added a zoom slider under the fit-mode control (cover-crop only); added mouse-wheel zoom on the crop stage; fixed dark-mode preview text contrast (`--foreground-subtle` lift); corrected token path to `../tokens.css`.

Owners need a single place to give a wishlist its visual identity: assign one image, crop it correctly for every surface it appears on (dashboard card, list row, header banner, social share), and preview how the chosen theme colors plus image-or-fallback will actually render – in both light and dark mode. This brief covers the **wishlist settings/editing** screen and the visual primitives (theme-aware fallback, per-slot crop editor, realistic theme card preview) it introduces.

**Source**: GitHub issue #36 – "Upgrade Wishlist visuals and settings workflow". Blocked by #34 (image-frame + token foundation) and #35 (persisted image metadata).

---

## 1. Purpose

A Přejeme si wishlist surfaces in many places at very different proportions: a 3:2 dashboard card, a 52px square list-row thumbnail, a wide header/banner on the wishlist page itself, and a 1.91:1 social-share card (Open Graph). Today the owner picks a theme during creation and the no-image surfaces fall back to raw gradients with no occasion personality. Issue #36 fixes three gaps:

1. **Image assignment lives in the wrong place** – it should be in settings/editing, not the create flow (create stays lightweight: title, occasion theme, done).
2. **One image, many crops** – the owner uploads one image and tunes how it frames in each slot, so a tall portrait still reads well as a wide banner and a square thumbnail.
3. **Fallbacks look unfinished** – no-image wishlists should show a theme-aware background plus a large occasion emoji/icon, and the theme picker should preview a real card, not a thin accent line.

**Key value**: One screen where an owner sets a wishlist's look once and sees – truthfully, in light and dark – exactly how it will appear everywhere it travels.

---

## 2. Surrounding Context

The mockup **MUST** show the full viewport with the app shell at correct proportions.

### Full Viewport Structure (top to bottom)

1. **App nav bar** (56px fixed, `--nav-height`): logo `prejemesi.cz` left (primary color), nav links center (`Moje seznamy` active), avatar chip right. Faithful reproduction of the established shell (see `designs/dashboard/variant-2.html`, `designs/wishlist-page/refined.html`). Render at full fidelity, slightly de-emphasized – it is context, not the focus.
2. **Settings page heading row**: back affordance + breadcrumb ("Moje seznamy / Vánoce 2026 / Nastavení vzhledu"), page title `Vzhled seznamu`, primary `Uložit změny` button right (sticky/affixed acceptable). The settings page also has other sections (Základní údaje, Sdílení, Moderátoři, Nebezpečná zóna) – represent these only as collapsed/adjacent nav or section stubs so the visuals section is clearly the focus.
3. **The Visuals section – THE FOCUS** – contains three sub-areas:
    - **A. Image assignment** – drop/upload zone, current image, replace/remove.
    - **B. Per-slot crop editor** – one image, four slot crops (card 3:2, list-row 1:1, header/banner wide, social 1.91:1), each with a draggable focal point / crop frame and a live preview.
    - **C. Theme + card preview** – theme preset picker (5 presets + custom color) and a realistic wishlist-card preview that reflects the selected theme AND the image-or-fallback state.
4. **Light / dark demonstration**: the page is shown twice (Light Mode strip, then Dark Mode strip), stacked, exactly like existing variant HTML, so readability of every wishlist theme is provable in both modes.

**What parent provides**: nav shell, settings-page chrome (heading, save button, sibling section nav).
**What this component fills**: the Visuals section body – image assignment + crop editor + theme/card preview.
**Must NOT include**: gift list, reservation UI, sharing dialog internals, create-wishlist wizard (image assignment is explicitly NOT in create – see Notes).

**Mockup rendering instructions**:

- Full viewport at ~1440 wide proportions; content column capped at `--content-max-width` (1200px) for the settings body, or a centered 960–1040px settings column (designer's choice).
- Visuals section at full design fidelity; sibling settings sections shown as muted stubs.
- Render BOTH light and dark, each with its own `Light Mode` / `Dark Mode` eyebrow strip (match existing variant pattern).
- Show the no-image fallback state for at least one slot/preview so the theme-aware background + large emoji is visible.

---

## 3. Requirements

### 3.1 Image Assignment (REQ-1)

- Lives in wishlist **settings/editing**, never in create. (Create flow only picks a theme.)
- One image per wishlist (singular – not a gallery). Backed by `wishlist.bannerImageKey` / `wishlist.thumbnailImageKey` today; #35 persists the unified image + per-slot crop metadata.
- **No-image (default) state**: drop zone – dashed border, upload icon, "Přetáhněte obrázek sem nebo " + "Vyberte soubor" link, helper text "JPG, PNG nebo WebP, max 5 MB". Reuse the `ImageUpload` derived component (`src/lib/components/derived/`).
- **Has-image state**: show the source image with a "Nahradit obrázek" (replace) and "Odebrat" (remove, destructive-ghost) control. Removing returns to fallback state.
- Uploading state: progress / shimmer over the drop zone.
- Error state: inline `Alert` (variant destructive) – "Soubor je příliš velký" / "Nepodporovaný formát".

### 3.2 Per-Slot Crop Editor (REQ-2)

The owner assigns **one** image and tunes its crop/focal point **per slot**. Four required slots:

| Slot            | Aspect / size              | Where it appears                              |
| --------------- | -------------------------- | --------------------------------------------- |
| Dashboard card  | 3:2 landscape              | Dashboard "Moje seznamy" / "Spravované" cards |
| List row thumb  | 1:1 square (renders ~52px) | Dashboard list-row view, compact lists        |
| Header / banner | wide (~3.5:1 to 4:1)       | Wishlist page header on `/w/<short-id>`       |
| Social preview  | 1.91:1 (Open Graph)        | Link unfurl in WhatsApp / Messenger / FB      |

- **Crop interaction** (reuse the #34 shared image renderer – do NOT invent new fitting):
    - Each slot exposes the #34 fit modes: **auto**, **contain-padded**, **cover-crop**.
    - For `cover-crop`, a draggable focal point (or crop frame) lets the owner choose what stays centered. The crop rectangle is constrained to the slot aspect.
    - Background fill (visible behind `contain-padded` and letterboxed areas) follows the #34 priority: **extracted/manual image color → wishlist theme token → global token**.
- **Live preview per slot**: each slot shows the resulting framed image at representative size, so the owner sees the real outcome (card preview = realistic dashboard card, header = wide banner strip, thumb = small square, social = OG card with title overlay).
- Saving stores per-slot crop metadata (#35). Until #34/#35 land, mockups simulate the metadata visually.
- Sensible default: on first upload, all slots default to `cover-crop` centered; owner adjusts only the ones that need it.

### 3.3 Theme-Aware Fallback Visuals (REQ-3)

When a wishlist has **no image**, surfaces must NOT show a raw flat gradient. Instead:

- **Theme-aware background** – derived from the selected theme preset's `gradient` (see `theme_presets.ts`) or the custom color, tinted to suit light vs dark surface.
- **Large emoji / icon visual** – the preset emoji (🎁 default, 🎄 christmas, 🎂 birthday, 🎉 fun, 💍 elegant) rendered large and centered as the fallback hero. Custom theme uses the default 🎁 unless overridden.
- This same fallback renders at every slot scale (large in header/card, small in list thumb).
- Fallback must remain legible and on-brand in BOTH light and dark mode (theme background tints shift per mode).

### 3.4 Realistic Theme / Card Preview (REQ-4)

- The theme picker shows the 5 presets as preset cards (reuse `themePresetCardVariants` pattern: swatch row + emoji + label + selected checkmark) plus a **Vlastní barva** (custom color) option (OKLCH/hex color input, reuse `themeSelectorVariants`).
- Selecting a theme updates a **realistic wishlist-card preview** – an actual card with theme primary applied to title/accents, theme surface as the card background, and the image-or-fallback hero. This replaces the old "thin accent line" preview (per acceptance criteria).
- The preview reflects the live combination: selected theme × (uploaded image with its card crop) OR (theme-aware fallback). Toggling remove-image flips the preview to fallback so the owner can compare.

### 3.5 Light & Dark Readability (REQ-5)

- All five preset palettes plus a representative custom color must be readable in light and dark. Mockups prove this by rendering the full section twice.
- Title/price text on theme surfaces meets contrast; foreground tokens (`--foreground`, `--foreground-muted`) used over theme surfaces, never theme-primary text on theme-primary bg.
- Fallback emoji + background readable in both modes (dark mode tints the theme background darker, lighter emoji glow acceptable).

---

## 4. States

| State                     | Visual Treatment                                                                                  | Trigger                          |
| ------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| No image (default)        | Drop zone active; all slot previews show theme-aware fallback (bg + large emoji)                  | Wishlist has no image            |
| Uploading                 | Shimmer / progress over drop zone; slot previews show skeleton                                    | File selected, upload in flight  |
| Image assigned            | Source image shown; replace/remove controls; slot previews show cropped image                     | Upload succeeds                  |
| Editing a slot crop       | Focal point / crop frame draggable; active slot highlighted (ring); other previews update live    | Owner interacts with a slot      |
| Fit mode = contain-padded | Image letterboxed inside slot; background-fill color (extracted → theme → global) fills remainder | Owner picks contain-padded       |
| Fit mode = cover-crop     | Image fills slot, cropped to aspect; focal point movable                                          | Owner picks cover-crop (default) |
| Fit mode = auto           | Renderer chooses based on image vs slot aspect                                                    | Owner picks auto                 |
| Theme selected (preset)   | Preset card shows selected ring + checkmark; card preview recolors                                | Owner clicks a preset            |
| Custom theme              | Color input active; card preview uses custom OKLCH/hex; emoji defaults to 🎁                      | Owner picks "Vlastní barva"      |
| Upload error              | Destructive `Alert` inline; drop zone returns to default                                          | File too large / wrong format    |
| Remove image confirm      | Inline confirm or `AlertDialog`; on confirm, previews flip to fallback                            | Owner clicks "Odebrat"           |
| Save success              | `toast` "Vzhled uložen"; Save button returns to idle                                              | Owner saves                      |
| Light mode                | Light surfaces, light theme tints                                                                 | User light/system mode           |
| Dark mode                 | Dark surfaces, dark theme tints; same content readable                                            | User dark/system mode            |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component          | Variant/Props                                          | Usage in This Design                                          |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------- |
| `ImageUpload`      | derived – drop zone + preview                          | Image assignment zone (3.1)                                   |
| `Button`           | `variant="default"` / `outline` / `ghost`, `size="sm"` | Save, Replace, Remove, fit-mode controls                      |
| `Badge`            | secondary / occasion (`--primary-soft`)                | Occasion/theme label, slot labels                             |
| `Tabs`             | `Tabs.List` + `Tabs.Trigger` + `Tabs.Content`          | (Variant A) slot tabs; (any) light/dark or mode toggling demo |
| `ToggleGroup`      | `ToggleGroup.Root` + `Item` (2–5 options)              | Fit-mode switch (auto / contain-padded / cover-crop)          |
| `Card`             | `Card.Header/Title/Description/Content`                | Section containers, the realistic card preview                |
| `RadioGroup`       | preset cards as radio options                          | Theme preset selection (single-select semantics)              |
| `Alert`            | `variant="destructive"` + Title/Description            | Upload error                                                  |
| `AlertDialog`      | confirm                                                | Remove image confirmation                                     |
| `Separator`        | –                                                      | Section dividers                                              |
| `Tooltip`          | –                                                      | Fit-mode explanations, focal-point hint                       |
| `Skeleton`         | –                                                      | Slot preview loading                                          |
| `Slider`           | (optional)                                             | Zoom within cover-crop (designer's choice)                    |
| `Progress`         | –                                                      | Upload progress                                               |
| `Switch`           | –                                                      | "Použít stejný ořez pro všechny" sync toggle (optional)       |
| `Label` / `Field`  | `Field.Field` + `Field.FieldGroup`                     | Form layout for color input + labels                          |
| `dark-mode-toggle` | derived                                                | Mode demonstration affordance                                 |

### Domain primitives to reuse (from #34, not re-invented here)

| Primitive                                           | Source                            | Usage                                                                 |
| --------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| Shared image renderer                               | #34                               | All slot previews + fallback. Owns the 3 fit modes + bg-fill priority |
| `themePresetCardVariants` / `themeSelectorVariants` | `blocks/theme/`                   | Preset card + custom-color UI                                         |
| `THEME_PRESETS`                                     | `modules/themes/theme_presets.ts` | emoji, palette, gradient per occasion                                 |

### Components to Design (new)

| Component              | Description                                                             | Why New                                                     |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `WishlistCropEditor`   | Block: one image → four constrained per-slot crops with live previews   | No existing multi-slot crop composer; composes #34 renderer |
| `SlotPreviewCard`      | Renders a single slot at representative size (card/thumb/banner/social) | Slot-specific framing wrapper around #34 renderer           |
| `ThemeCardPreview`     | Realistic wishlist-card preview reacting to theme × image/fallback      | Replaces thin accent-line preview (acceptance criterion)    |
| `WishlistFallbackHero` | Theme-aware bg + large emoji fallback, scale-aware                      | Standardizes REQ-3 across all surfaces                      |

---

## 6. Layout Constraints

- Nav: 56px fixed (`--nav-height`). Content max-width 1200px (`--content-max-width`); settings body may use a narrower centered column (~960–1040px).
- Crop editor slot previews: keep true aspect ratios (3:2, 1:1, wide, 1.91:1) – these are load-bearing, not decorative.
- Spacing on the 4px base scale (`--space-*`). Section gaps 24–32px; intra-section 12–16px.
- Radii: cards `--radius-lg` (12px) / `--radius-xl` (16px); pills `--radius-full`.
- Shadows: `--shadow-sm` resting card, `--shadow-md` hover/active.
- Responsive: on narrow viewports the three sub-areas stack; slot previews wrap to 1–2 columns.

---

## 7. Design Tokens

Reference `designs/tokens.css` (link, never inline) plus the surface palette established in existing variant HTML (`.theme-light` / `.theme-dark` blocks define `--surface`, `--surface-2`, `--surface-hover`, `--foreground`, `--foreground-muted`, `--foreground-subtle`, `--border`, `--border-strong`, `--primary`, `--primary-fg`, `--primary-soft`, `--ring`).

- Fonts: body Figtree (`--font-sans`), headings Noto Sans (`--font-heading`).
- App primary (sage green): light `oklch(52.7% 0.154 150.069deg)`, dark `oklch(57% 0.155 151deg)`.
- **Wishlist theme palettes** (from `theme_presets.ts`) – apply via `--wishlist-*` vars on the preview scope:
    - default 🎁 – sage green; christmas 🎄 – red+green+gold; birthday 🎂 – magenta/violet; fun 🎉 – blue+amber; elegant 💍 – deep indigo + gold.
    - Each preset has a `gradient` used for the fallback background and theme swatch.
- Status: danger `--status-danger` for destructive remove; success toast uses `--status-success`.
- Background-fill priority for image frames (from #34): extracted/manual image color → `--wishlist-*` token → global `--background`/`--surface`.

---

## 8. Design Constraints (Non-Negotiable)

- Image assignment is in **settings/editing only** – never render it in the create-wishlist flow.
- **One image per wishlist** – a single source image, multiple crops. No multi-image gallery.
- **Reuse the #34 shared image renderer and its 3 fit modes + bg-fill priority** – do not invent new image-fitting logic in this design.
- Slot aspect ratios (3:2, 1:1, wide banner, 1.91:1) must be accurate in previews.
- No-image surfaces use theme-aware background + large emoji – never a raw flat gradient with no emoji/icon.
- Theme preview must be a **realistic card**, not a thin accent line.
- Czech UI text throughout. No English labels.
- Both light and dark must be shown and readable for every theme.
- Theme selection itself remains available in create; this screen edits it but the constraint is that image assignment does not move into create.
- Owner never sees reservation state anywhere on this screen (owner invariant).

---

## 9. Design Freedom

- **Overall organization of crop editor + slot previews + theme preview** is the primary axis of variation between the three variants (tabbed vs. side-by-side vs. stacked-wizard).
- Whether slot previews are tabbed, gridded, or a scrollable strip.
- Focal-point UI: draggable dot vs. movable crop frame vs. 9-point grid + drag.
- Whether fit-mode control is a `ToggleGroup` per slot or a global default with per-slot override.
- Custom-color input style (native color input vs. OKLCH sliders vs. preset chips + hex).
- How the realistic card preview is framed (floating mock dashboard card vs. inline preview pane vs. device-frame social mock).
- Placement of the light/dark demonstration (two full stacked pages vs. side-by-side split preview).
- Optional zoom slider for cover-crop.

---

## 10. Visual References

- **Internal**:
    - `designs/dashboard/variant-2.html` + `refined.html` – nav shell, card/row patterns, `.theme-light`/`.theme-dark` palette blocks, badge styles.
    - `designs/wishlist-page/refined.html` + brief – header/banner anatomy, gift card states, fallback gradient+emoji placeholder.
    - `designs/tokens.css` – typography, spacing, radii, shadows, motion, domain colors.
    - `src/app.css` – final color values, `--wishlist-*` theme vars.
    - `src/lib/modules/themes/theme_presets.ts` – preset emoji/palette/gradient (source of truth for fallback visuals).
    - `src/lib/components/blocks/theme/theme_selector_variants.ts` – preset card + selector styling.
- **External** (optional): standard image-crop UIs (e.g. focal-point pickers); Open Graph card mocks for the social slot.

---

## 11. Not Included (Scope Exclusions)

- The #34 image-frame renderer internals and token plumbing – consumed here, defined there.
- The #35 metadata persistence layer / upload storage – this is the UI that produces the metadata.
- Create-wishlist wizard (image assignment explicitly excluded from create).
- Gift-level images (covered by `gift-detail-modal`).
- Sharing dialog, moderator invite, reservation flows – other sections of settings / other briefs.
- Actual social-platform unfurl behavior – we only mock the OG card preview.
  </content>
  </invoke>
