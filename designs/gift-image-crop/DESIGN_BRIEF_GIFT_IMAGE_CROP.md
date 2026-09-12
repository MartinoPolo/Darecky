# Gift Image Crop Workflow – Design Brief

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/gift-image-crop/refined.html`
> **Summary**: `designs/gift-image-crop/SUMMARY.md`
> **Refinements**: accepted Variant A as-is; corrected token path to `../tokens.css`; added full state coverage (Auto + extreme-AR bias, Fit-whole bg-fill, Crop, Loading, External-URL token fallback, Empty); surfaced bg-fill priority via fill chip; a11y/focus polish.

The gift create/edit modal gains an **image presentation step**: owners pick how a gift image is fitted (Auto / Fit whole image / Crop image) and immediately see how that choice renders across the four real consumer surfaces – gift card, list thumbnail, detail modal, and reservation modal. This removes the guesswork of "how will my image actually look?" by making the four common display outcomes visible at the moment of editing, while delegating the actual rendering to the shared image-frame renderer (#34) and persisting the chosen metadata (#35).

**Source:** GitHub issue #37 – "Add Gift image crop workflow". Blocked by #34 (image-frame foundation) and #35 (persisted gift image metadata).

---

## 1. Purpose

A gift image arrives in unpredictable aspect ratios: a tall portrait product shot, a wide banner, a square icon, or an external store URL with letterboxing. Each of the four places a gift image appears has a **different aspect ratio**, so a single naive `object-fit: cover` either crops the product out of frame or pads it awkwardly. This workflow lets the owner decide, once, how their image should behave everywhere – and confirm it visually before saving.

The owner's mental model: _"I picked this picture; show me what visitors will actually see on the card, in the list, in the big modal, and when they reserve it – and let me fix it if the crop is wrong."_

**Key value:** One decision, four previews, zero surprises – the owner sees every common display outcome before the gift goes live.

---

## 2. Surrounding Context

The image fit controls live **inside the existing gift create/edit modal** (`GiftDetailForm.svelte`, rendered in `GiftDetailModal`). They are an enhancement of the current Image field (URL/Upload tabs), not a new surface.

### Full Modal Structure (current, to be preserved)

The modal is a centered `Dialog` (`max-w-[900px]`, `max-h-[90dvh]`) over a dimmed/blurred backdrop of the wishlist page. Current layout is a two-column grid `45% / 55%`:

- **Left column (45%)** – large image preview area (`min-h-520px`), placeholder gift icon when empty.
- **Right column (55%)** – scrollable form: Name, Description, URL, Price + Currency, **Image (URL / Upload tabs)**, Quantity, Priority, then a `Separator` and the action row (Save / Mark received / Delete).

**What parent provides:** the `Dialog` shell, backdrop, close button, title, body-scroll lock, focus trap. Do NOT redraw nav/app-shell chrome.

**What this component fills:** the **Image section of the form** plus the **left preview column**, which together become the "image presentation" experience. Everything else in the form (Name, Description, URL, Price, Quantity, Priority, actions) stays exactly as-is and must be shown faithfully so the modal reads as one coherent form.

**Must NOT include:** reservation state, like counts, owner-vs-visitor role logic for the gift itself – this is the owner/moderator editing surface only (REQ-5: permissions unchanged).

**Mockup rendering instructions:**

- Show the full modal at ~900px wide centered on a dimmed wishlist backdrop (reuse the backdrop + blur treatment from `designs/gift-detail-modal/refined.html`).
- The image fit controls + crop canvas + the 4-slot preview cluster are the **focus** – render them at full fidelity. The rest of the form fields are shown realistically but are not the design exploration.
- Show the **edit** mode (an image already present) since that is where crop matters most. A short note may indicate the create-mode difference (controls appear once an image is added).
- Provide a light AND dark rendering path (tokens drive both; no hard-coded colors).

---

## 3. Requirements

### 3.1 Fit-mode controls (REQ-1)

A 3-option segmented control selecting the gift image **fit mode**. These map 1:1 onto the shared image-frame renderer's fit modes from #34 – do **not** invent a parallel fitting system.

| Control label (cs / en)              | Renderer fit mode | Behavior                                                                                                     |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Auto** (`Automaticky`)             | `auto`            | Renderer chooses per-slot. Biased toward **product visibility** for extreme aspect ratios (REQ-4) – see 3.5. |
| **Fit whole image** (`Celý obrázek`) | `contain-padded`  | Entire image visible, never cropped; empty space filled by the bg-fill color (see 3.4). No manual crop box.  |
| **Crop image** (`Oříznout`)          | `cover-crop`      | Image fills each slot; owner positions a manual crop region that is reused across all slots (REQ-3).         |

- Default for a new image: **Auto**.
- Selecting **Crop image** reveals the crop canvas (3.2). Switching away from Crop hides the canvas but retains the last crop metadata (re-selecting Crop restores it).
- The control must be keyboard-operable (arrow keys move selection) and show a clear active state.

### 3.2 Manual crop canvas (REQ-3, Crop mode only)

When **Crop image** is active, show an interactive crop surface over the source image:

- Full source image shown at natural aspect, dimmed outside the crop region.
- A draggable / resizable crop rectangle. Mockup shows it statically positioned (e.g. centered on the product) with corner + edge handles and a rule-of-thirds grid overlay.
- The crop is stored as **normalized rect metadata** `{ x, y, width, height }` in 0–1 space (so it survives re-rendering at any slot size). This is the single crop that feeds every slot preview.
- A subtle reset affordance ("Reset crop" / `Obnovit`) returns the rect to full-frame.
- The crop rectangle is **aspect-free** (free-form) – each slot derives its own visible window from the same normalized rect by centering within it; document this as the chosen approach (not per-slot independent crops).

### 3.3 Live multi-slot previews (REQ-2)

Show the image rendered through the current fit mode (+ crop, if any) in **four preview tiles**, each at the **exact aspect ratio of its real consumer**. Each tile is labeled with where it appears. These update live as the fit mode or crop changes.

| Slot                  | Real consumer (source)                                    | Aspect / size in real UI              | Preview tile ratio |
| --------------------- | --------------------------------------------------------- | ------------------------------------- | ------------------ |
| **Gift card**         | `GiftCard.svelte` image area (`imageArea: h-40 w-full`)   | Landscape, ~3:2 (full-width card top) | 3:2 landscape      |
| **List thumbnail**    | `GiftListItem.svelte` thumbnail (`size-16` square)        | 1:1 square, small                     | 1:1 square         |
| **Detail modal**      | this modal's left image column (`45%` × `min-h-520px`)    | Portrait, ~3:4                        | 3:4 portrait       |
| **Reservation modal** | `ReserveModal.svelte` gift summary (`giftImage: size-12`) | 1:1 square, very small                | 1:1 square         |

- Each tile uses the **shared image renderer** so previews are pixel-faithful to production (REQ-2, AC: "use the shared image renderer").
- Tiles must show the **bg-fill color** behind any padding (3.4) so Fit-whole-image previews are accurate.
- Label each tile with its consumer name (cs labels: `Karta dárku`, `Náhled v seznamu`, `Detail`, `Rezervace`).
- The two square slots (list + reservation) differ only in size; both are shown so the owner sees how a small square reads.

### 3.4 Background fill priority (from #34)

For `contain-padded` (and any letterboxing in `auto`), the empty area behind the image uses the renderer's **bg-fill priority chain**:

1. Extracted dominant color from the image, OR manually chosen image color (if the owner set one).
2. Wishlist theme token (`--wishlist-surface` / wishlist primary-soft).
3. Global token fallback (`--surface-2` / `--muted`).

- External image URLs (which may not support color extraction / CORS) fall back to the **token color** (issue Notes: "External image URLs may use token fallback for background color").
- The mockup should visibly demonstrate the fill behind a Fit-whole-image preview (e.g. a soft wishlist-tinted surface behind a portrait image in the landscape card slot).

### 3.5 Auto mode bias (REQ-4)

`auto` is not plain `cover`. For **extreme** aspect ratios (very tall or very wide relative to a slot) it must keep the **full product visible** rather than cropping it away:

- Extreme-tall or extreme-wide images → behaves closer to `contain-padded` (show whole product, fill remainder) instead of an aggressive center-crop that would slice the product.
- Near-slot ratios → behaves like `cover-crop` for a clean fill.
- The mockup should communicate this with a short helper note under the Auto option (e.g. "Keeps the whole product visible for very tall or very wide images").

### 3.6 Preserve existing modal behavior (REQ-5)

- Keep URL / Upload image input tabs, all other form fields, Save / Mark received / Delete actions, and owner/moderator permission gating exactly as they are today.
- The fit controls + previews only appear once an image exists (URL entered or upload complete); empty state keeps the current placeholder.
- Saving persists fit mode + crop metadata alongside the existing gift fields (#35) – no new save button; reuse the existing Save action.

### 3.7 Persistence & propagation (REQ-3, AC)

- Saved metadata = `{ fitMode: 'auto' | 'contain-padded' | 'cover-crop', cropRect?: {x,y,w,h}, bgColor?: string }`.
- After save, **all** gift image consumers (card, list item, detail modal, reservation modal) render through the shared renderer using this metadata (AC: "Saved crop affects all common gift image consumers").

---

## 4. States

| State                         | Visual Treatment                                                                         | Trigger                          |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| **No image (empty)**          | Current placeholder; fit controls + previews hidden                                      | No URL / no upload yet           |
| **Image present – Auto**      | Segmented control on "Auto"; 4 previews shown; no crop canvas; helper note re extreme AR | Image added, default mode        |
| **Image present – Fit whole** | "Fit whole image" active; previews show full image + bg-fill padding                     | Owner picks Fit whole image      |
| **Crop active**               | Crop canvas with handles + thirds grid over source; 4 previews reflect crop window       | Owner picks Crop image           |
| **Crop dragging**             | Crop rect highlighted, handles emphasized, dimmed outside; previews update live          | Owner drags/resizes crop rect    |
| **Extreme aspect (Auto)**     | Auto previews show full product with bg-fill rather than slicing                         | Source image very tall/wide      |
| **External URL fallback**     | bg-fill uses token color (no extracted color)                                            | Image is an external URL         |
| **Loading / extracting**      | Skeleton shimmer on preview tiles while image / dominant color resolves                  | Image just added, render pending |
| **Save in progress**          | Existing Save button disabled + "Saving…" (unchanged)                                    | Owner clicks Save                |
| **Dark mode**                 | All surfaces, controls, fills resolve via tokens; no hard-coded light values             | `.dark` on root                  |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component                    | Variant / Props                                    | Usage in this design                                                    |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `ToggleGroup.Root` + `.Item` | single-select, 3 items                             | The Auto / Fit whole image / Crop image segmented control (REQ-1)       |
| `Dialog.*`                   | existing `GiftDetailModal` shell                   | Modal container, backdrop, close, title – unchanged                     |
| `Label`                      | –                                                  | "Image" / fit-mode label, slot labels                                   |
| `Input`                      | URL/Upload tabs (existing)                         | Image URL field – preserved                                             |
| `ImageUpload` (derived)      | `target="gift-image"` `size="small"`               | Upload tab – preserved                                                  |
| `Button`                     | `intent="ghost"` size sm                           | "Reset crop"; existing Save / Mark received / Delete                    |
| `Separator`                  | –                                                  | Existing form/action divider – preserved                                |
| `HelpText`                   | –                                                  | Helper note under Auto (extreme-AR bias explanation)                    |
| `Skeleton`                   | –                                                  | Preview tile loading state                                              |
| `Tooltip`                    | –                                                  | Optional: explain each fit mode / slot on hover                         |
| Shared image renderer (#34)  | fit modes `auto` / `contain-padded` / `cover-crop` | Renders every preview tile AND all production consumers – single source |

### Components to Adopt (install from shadcn-svelte)

| Component | Source | Rationale                                                  |
| --------- | ------ | ---------------------------------------------------------- |
| –         | –      | None required; segmented control = existing `ToggleGroup`. |

### Components to Design (new)

| Component               | Description                                                                                                    | Why New                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GiftImageCropCanvas`   | Interactive crop surface: source image + draggable/resizable rect + thirds grid, emits normalized `{x,y,w,h}`. | No existing crop primitive; must produce the normalized rect that feeds the shared renderer. |
| `GiftImagePreviewSlots` | The 4-tile preview cluster, each tile binding the shared renderer to a slot aspect ratio.                      | App-specific composition of the #34 renderer at the four known consumer ratios.              |

> The actual fitting/painting is the #34 renderer. The new components only provide the crop UI and the preview layout – they must not re-implement fitting.

---

## 6. Layout Constraints

- Modal max width **900px**, max height **90dvh**; image controls + previews must fit inside the existing scrollable right column OR a reflowed two-column body without exceeding these bounds.
- Preview tiles share a small row/grid; total preview cluster height should not dominate the modal (target ≤ ~180px tall in the compact arrangements).
- Crop canvas: max-height ~280px so it never pushes the Save action below the fold on a laptop.
- Tile aspect ratios are **fixed and non-negotiable** (3:2, 1:1, 3:4, 1:1) – they mirror real consumers.
- Spacing on the 4px grid (`--space-*`); radii `--radius-md` (tiles), `--radius-lg` (canvas/modal).
- Mobile (<600px): modal goes full-screen; preview tiles wrap to a 2×2 grid; crop canvas stays full-width.
- All controls minimum 32px control height (`--size-control-sm/md`); crop handles ≥ 12px hit target.

---

## 7. Design Tokens

From `designs/tokens.css` (structural) and `src/app.css` (theme) – **never inline token values**:

- Typography: `--font-sans` (Figtree), `--font-heading` (Noto Sans), scale `--text-xs`…`--text-2xl`; `.dk-eyebrow` for slot/section labels.
- Spacing: `--space-1`…`--space-8`.
- Radii: `--radius-md` (tiles, controls), `--radius-lg` (canvas, modal body), `--radius-full` (segmented control pills if pill-styled).
- Surfaces: `--surface`, `--surface-2`, `--muted` (preview backplate + token bg-fill fallback).
- Wishlist fill: `--wishlist-surface`, `--wishlist-primary` / `--primary-soft` (bg-fill priority tier 2).
- Primary: `--primary`, `--primary-foreground` (active segment, Save).
- Borders: `--border`, `--border-strong`; focus `--ring` + `--focus-ring-width`.
- Motion: `--duration-normal` + `--ease-standard` for segment/crop transitions.
- Status: `--status-info` (optional helper accent). Avoid hot colors except semantic.

---

## 8. Design Constraints (Non-Negotiable)

1. **Reuse the #34 renderer** – fit modes Auto/Fit-whole/Crop map onto `auto`/`contain-padded`/`cover-crop`. No separate fitting logic, no duplicate `object-fit` rules in consumers.
2. **bg-fill priority order is fixed**: extracted/manual color → wishlist token → global token (3.4). External URLs fall to token color.
3. **One crop, all slots** – manual crop is a single normalized rect reused everywhere; not per-slot crops.
4. **Auto preserves full product for extreme AR** (REQ-4) – Auto previews must never slice a clearly-extreme image.
5. **Preserve existing modal** – all current fields, tabs, actions, and owner/moderator permissions unchanged (REQ-5). No new Save button.
6. **Four preview ratios are exact** – 3:2 / 1:1 / 3:4 / 1:1, matching real consumers; labeled.
7. **Token-driven, light + dark safe** – no hard-coded colors; both themes must render correctly.
8. **WCAG AA** contrast on all labels, controls, helper text; crop handles visible on any image (use ring/outline, not color alone).
9. **Fits in 900×90dvh** without pushing Save off-screen on a laptop.

---

## 9. Design Freedom

- **Arrangement of fit controls + crop canvas + 4 previews within the modal** – this is the primary differentiator across variants (see below). Options: previews in left column under a hero, previews as a horizontal strip, previews stacked beside the crop canvas, a tabbed "Edit / Preview" split, etc.
- Segmented-control styling: pill vs. boxed vs. underline (must remain a `ToggleGroup`).
- Whether the crop canvas replaces the left image column or floats inline in the form.
- Preview tile labels: caption under vs. corner chip vs. tooltip.
- How the extreme-AR Auto bias is communicated (helper text, mini before/after, icon).
- Crop grid overlay style (thirds vs. center cross), handle shape.
- Transition/animation on mode switch and crop drag.

---

## 10. Visual References

- **Internal**:
    - `designs/gift-detail-modal/refined.html` – exact modal shell, backdrop, two-column body, close button, typography. Match this fidelity.
    - `src/lib/components/blocks/gift/GiftDetailForm.svelte` – current form fields + Image tabs to preserve.
    - `src/lib/components/blocks/gift/GiftCard.svelte` + `gift_card_variants.ts` – card image ratio (`h-40`).
    - `src/lib/components/blocks/gift/GiftListItem.svelte` – `size-16` thumbnail.
    - `src/lib/components/blocks/reservation/reserve_modal_variants.ts` – `size-12` reservation thumbnail.
    - `designs/tokens.css`, `src/app.css` – all tokens (light + dark).
- **External** (conceptual): standard image-crop UIs (rule-of-thirds overlay, corner handles) – e.g. social-media avatar croppers; do not copy chrome, only the interaction affordance.

---

## 11. Not Included (Scope Exclusions)

- The shared image-frame renderer internals (color extraction, fit math) – that is **#34**.
- The DB schema / persistence layer for image metadata – that is **#35**.
- Banner / thumbnail wishlist image uploads (separate flow, per DECISIONS.md "Separate banner and thumbnail uploads per wishlist").
- Filters, rotation, brightness, or other photo editing – crop + fit only.
- Multi-image galleries per gift – single image per gift.
- Visitor-facing changes beyond consuming the saved metadata via the shared renderer.
