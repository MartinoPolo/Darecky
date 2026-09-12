# Gift Edit Modal Mode Section (Vyplnit / Přizpůsobit / Ručně) — Design Brief

The gift create/edit modal's left column groups the three-way image display-mode control (Vyplnit / Přizpůsobit / Ručně), the live preview it drives, and the square crop-target tile. Issue #156: this section was framed by a thin grey (dashed `ink-faint`) border that read as unfinished. This brief specs the intentional, design-system-native treatment for the whole mode+preview grouping — the anime-sky sticker/mat language instead of an accidental seam.

**Source**: issue #156. Related: #174 (interim fix, merged `64ba3bb`), #165/v3 visitor modal, #116 (editor model), #131 (click-to-edit), #159 (control heights).

---

## Scope Reconciliation: what #174 already did vs. what remains

Issue #156 predates the merged #174. Base the design on the ACTUAL current code, not the issue's screenshot:

**Already addressed by #174 (do not re-solve):**

- The dashed `border-ink-faint` seam (the literal "thin grey border") is **already removed in edit mode** — `GiftDetailForm.svelte` overrides the shared `imageColumn` slot with `border-none border-b-0 sm:border-r-0`. The issue's first acceptance checkbox ("no longer uses the thin grey border") is literally met.
- #165 (shipped inside #174) retired the `detail` crop target: the tile strip is now a **single** `square` tile ("Seznam a rezervace"), and the visitor view got its own `view*` slots — the edit-mode column can be redesigned without touching the view mode.

**Still open (this design's job):** #174 was subtraction only — a 6-line CSS interim fix. The section now has NO framing at all: a full-bleed dotted mat with a floating pill, meeting the white form column with a bare edge. The issue's second criterion ("the new treatment reads as intentional and matches the design system") is unmet. This brief covers: the full composition of the mode+preview grouping, how the column meets the form column (seam or no seam), pill/tile/empty-state polish, and the Manual-mode layout — as one intentional treatment.

---

## 1. Purpose

The image column answers "how will my gift photo look everywhere it appears?" while the user edits. The mode control chooses the framing strategy (Vyplnit = automatic cover crop, Přizpůsobit = whole picture letterboxed, Ručně = user-drawn crop), the big preview shows it live, and the square tile shows the exact card/list/reservation crop. The grouping must read as one deliberate "photo workshop" surface, visually distinct from the form fields on the right, in the app's sticker/notebook language.

**Key value**: the mode section stops looking like an unfinished wireframe and reads as a designed part of the sky system, without changing how it works.

---

## 2. Surrounding Context

The mockup **MUST** show the full modal with both columns at correct proportions — the section never exists alone.

### Full viewport structure

- **Backdrop**: owner's wishlist page (`/w/<shortId>`), dimmed + blurred by the Dialog overlay. Reduced fidelity; sticker cards visible.
- **Dialog** (`giftDetailModalVariants.content`): centered, `max-w-[900px]`, `max-h-[90dvh]`, `p-0`, rounded panel with ink border per Dialog base.
- **Body** (desktop ≥640 px): 2-col grid `45% / 55%`, `min-h-[520px]`. Left = **THE DESIGN AREA** (~405 px wide × ≥520 px tall). Right = form column (FINAL — reproduce, do not redesign): scrollable fields (Název, Popis, Odkaz editor, Cena+Měna row, Počet, Priorita, Obrázek source tabs Nahrát/URL) + pinned footer (Uložit / Označit jako přijatý / Smazat full-width buttons above a dashed top seam).
- **Mobile** (<640 px): one scrolling flex column; the image column is a `260px`-tall strip on top (`shrink-0`), fields flow under it, footer sticky at bottom. In Manual mode the column becomes `sticky top-0 h-[400px]` so the crop stage stays visible while fields scroll.

**What parent provides**: Dialog chrome, body grid, right form column, pinned footer.
**What this component fills**: the left column only — mode control + preview + tile (+ empty state).
**Must NOT include**: Dialog close button (issue #164 spec), right-column fields, footer.

**Mockup rendering instructions**:

- Desktop ~1440×900: full modal over the dimmed wishlist, right column reproduced faithfully at final fidelity, left column is the exploration.
- Show at least: (a) Vyplnit with an image, (b) Ručně with the crop stage + tile below, (c) empty (no image) state. Fit may share a frame with (a).
- One ~390 px mobile strip: the 260 px column above the first fields.
- Light mode only (dark derives from tokens). Sky palette; note that per-wishlist themes re-map tokens, so use semantic tokens only.

---

## 3. Requirements

### 3.1 REQ-1 — Intentional section treatment (the core ask)

- Replace the "nothing" left by #174 with a treatment from the design-system vocabulary: dotted notebook mat, sticker panels (2.5 px ink border + hard offset shadow), tape/polaroid accents, surface tints.
- The treatment must visually group: mode pill + big preview + square tile as ONE unit ("the photo and its controls"), clearly separate from the form fields.
- Decide the column/form boundary explicitly: either no seam (surface-tint contrast carries it — current interim state) or a deliberate seam. If a seam returns, echo the v3 visitor view's language (`viewMedia` kept `border-dashed border-ink-faint`, 2 px, bottom on mobile / right on desktop) — do not invent a third seam style. Cross-mode consistency (edit vs. visitor view of the same modal) is a stated goal, not a hard constraint.
- The treatment must work at both geometries: tall desktop column (~405×≥520) and short mobile strip (full-width × 260 px).

### 3.2 REQ-2 — Keep the functional grouping intact

All current behaviors survive visually unchanged in function:

- Three-way `ToggleGroup` sets the editor mode; selection is immediate (live preview swap).
- Wheel-zoom over the plain preview promotes to Ručně (`promoteOnWheel`).
- Clicking the square tile jumps to Ručně with that target active.
- Pencil overlay button (top-right of preview) opens the file picker (switches right-column image field to Nahrát tab, #131).
- Empty state: the whole column is one clickable upload button (#131 REQ-2).
- Manual mode: `ImageCropStage` replaces the plain preview; the tile strip moves BELOW the stage (never overlapping — every stage pixel matters); mobile sticky behavior kept.

### 3.3 Mode control (segmented pill)

- Component: `ToggleGroup.Root type="single"` + three `ToggleGroup.Item`s — Button-backed, group default `size="md"` (32 px items) — this is the correct step per the control-heights brief (gift edit modal = dense editor = `md`). Do not upsize.
- Current container styling (baseline to refine, already sticker-ish): `rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-[3px_3px_0_var(--hard-shadow)]` (~44 px outer). Items `rounded-full`.
- Pressed item: `intent="default"` toggle → ghost Button with `data-[state=on]:bg-accent data-[state=on]:text-foreground data-[state=on]:border-ink`. The designer may propose the `outline` intent (pressed = `bg-primary text-primary-foreground`) if the accent tint reads too weak — pick one, apply consistently.
- Labels (existing i18n, do not change): „Vyplnit" / „Přizpůsobit" / „Ručně"; group `aria-label` „Zobrazení obrázku".
- Placement freedom exists (see §9) but the round-3 decision stands: the control lives IN the image column with the preview it drives — never back in the form column.

### 3.4 Preview area

- Vyplnit/Přizpůsobit: `ImageFrame` fills the remaining column height; Přizpůsobit letterboxes (mat shows through / fill color). Pencil `Button intent="ghost-overlay" size="icon-sm"` overlay top-right (`rounded-full bg-surface/90 shadow-sm` today — may be restyled to sticker language).
- The square tile (`GiftImagePreviewSlots`): one `size-14` tile, `rounded-md border-2 border-ink bg-card shadow-[3px_3px_0_var(--hard-shadow)]`, label chip „Seznam a rezervace" under it. Floats over the preview's lower edge in Fill/Fit; sits below the stage in Ručně; `ring-2 ring-primary` when active.

### 3.5 Empty state (no image)

- Whole-column `imagePlaceholder` button: upload icon (size-16, `text-ink-faint`), „Přidat obrázek" (semibold), „Klikněte pro nahrání nebo výměnu" (subtle). Currently a bare centered stack on the mat with a hover `bg-accent` tint — in scope to restyle (e.g. dashed drop-zone sticker, taped note) so the empty column also reads intentional. No mode pill renders without an image.

### 3.6 Copy

- All labels exist in `messages/cs.json` — no new copy required. Any copy the mockup adds must never use em-dashes (—) in Czech text; use comma, colon, or spaced en-dash.

---

## 4. States

| State                  | Visual treatment                                                                                     | Trigger                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Empty (no image)       | Whole column = upload button (§3.5); no mode pill, no tile                                            | `imageUrl` and `imageKey` both empty     |
| Vyplnit (default)      | Pill top, cover-cropped `ImageFrame`, pencil overlay, floating square tile at lower edge              | mode = fill (also after image replace)   |
| Přizpůsobit            | Same, letterboxed image (mat/fill color visible around it)                                            | mode = fit                               |
| Ručně                  | Pill top, `ImageCropStage` (aspect-locked rect, zoom), tile strip below the stage, tile ring-active   | mode = manual, tile click, or wheel zoom |
| Pill item hover        | ghost Button hover (accent tint)                                                                      | pointer over item                        |
| Pill item pressed      | accent bg + ink border (or `outline` intent variant — designer's pick, §3.3)                          | selected mode                            |
| Focus visible          | ring per Button/`focus-visible:ring-2 ring-ring`; tile has its own focus ring                          | keyboard                                 |
| Mobile                 | 260 px strip; Manual: sticky `top-0 h-[400px]` while fields scroll                                    | <640 px                                  |
| Create vs. edit        | Identical section (one `GiftDetailForm`); create simply starts empty                                  | modal mode                               |
| Themed list / dark     | Derives via semantic tokens (`--wishlist-*` remap, dark palette) — no bespoke colors                  | wishlist theme, dark mode                |

---

## 5. Component Reuse Map

### Existing components (MUST use)

| Component               | Variant/Props                                                       | Usage                                                    |
| ----------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `ToggleGroup` (base)    | `type="single"`, items at group default `md`; intent per §3.3       | The three-way mode control                               |
| `Button` (base)         | `intent="ghost-overlay" size="icon-sm"`                             | Pencil click-to-edit overlay                             |
| `ImageFrame` (derived)  | `fitMode/focal/zoom/fillColor`, `tokenScope="wishlist"`             | Live preview in Vyplnit/Přizpůsobit                      |
| `ImageCropStage` (derived) | aspect-locked to `square`, existing chrome                       | Ručně editing surface (internals out of scope, §11)      |
| `GiftImagePreviewSlots` | single `square` tile, `activeTarget`, `onTileSelect`                | Crop tile + target switcher                              |
| `ImageUpload` (derived) | mounted in the right column's Nahrát tab                            | File picker target of pencil/empty-state clicks          |
| `giftDetailModalVariants` (tv) | `imageColumn`, `imagePlaceholder` slots                      | THE slots this design restyles (edit-mode only)          |

### Components to adopt (install)

None — all primitives exist.

### Components to design (new)

None expected. The deliverable is a restyle of the edit-mode slots (`imageColumn`, `imagePlaceholder`, pill container, tile strip placement); if the chosen treatment needs new tv() slots (e.g. `modeSectionPanel`), add them beside the existing edit-mode slots without touching `view*` slots.

---

## 6. Layout Constraints

- Desktop column: 45% of ≤900 px ≈ 405 px wide, ≥520 px tall (body `min-h`). Mobile: full width × 260 px (Manual: 400 px sticky).
- Control step: `md` 32 px for the pill items (control-heights brief: whole gift edit modal is a dense `md` surface; only the reserve/like sticker bar of the VIEW mode is exempt). No 36/38/44 px controls here.
- Spacing: 8 px rhythm; current insets `px-4 pt-3` (pill row), `p-4` stage, `px-4 pb-3` tile strip — may shift on the rhythm.
- Radii: `--radius-panel` 16 px panels, `--radius-btn` 7 px buttons, pill is `rounded-full`, tile `rounded-md`.
- Touch: tile + pill items ≥ 32 px hit area (44 px preferred on mobile via padding); the pencil overlay must not cover the wheel-zoom area entirely.
- The section must not add vertical height on mobile beyond the current 260 px strip (fields must stay reachable).

---

## 7. Design Tokens

`src/app.css` is canonical (`designs/tokens.css` structural reference):

- Mat: `bg-surface` + `bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px]` (the dotted notebook mat — current baseline).
- Ink: `--ink`, `--ink-soft`, `--ink-faint` (the offending grey WAS `border-ink-faint` dashed); `--border-w` 2.5 px for sticker borders.
- Shadows: `--hard-shadow` / `--hard-shadow-strong` hard offsets (`3px 3px 0` pill/tile today; `shadow-sticker` scale elsewhere).
- Surfaces: `bg-card` (white panel), `--surface-2/3`, hover `bg-accent` tint.
- Semantic only — must survive `--wishlist-*` theme remap (Christmas cream/red) and dark mode untouched.
- Type: Geist for control labels (never DynaPuff in controls); tile label chip `text-[10px] font-semibold`.

---

## 8. Design Constraints (Non-Negotiable)

1. Keep the three modes, their Czech labels, and all behaviors in §3.2 — this is a reskin of a working surface, zero functional change.
2. Mode control stays in the image column with its preview (#116 round-3 decision) — never returns to the form fields.
3. Pill items at `md` 32 px (control-heights). Right column and footer untouched (footer hover-lift suppression #142 stays).
4. View-mode slots (`view*` in `gift_detail_modal_variants.ts`) are FINAL per v3 — do not modify them; edit-mode changes must not leak into the visitor view.
5. Semantic tokens only; wishlist themes + dark mode must keep working with no bespoke colors (the polaroid's fixed paper/ink in `viewPhoto` is a view-mode exception, not a license).
6. Preserve test hooks: `data-testid="gift-image-column"`, `"image-fit-preview"`, `"gift-preview-tile-square"` (e2e `image-crop.spec.ts` depends on them).
7. A11y: group `aria-label` kept, `aria-pressed` on the tile, visible focus rings, pencil `aria-label` „Vyměnit obrázek", empty state stays a real button.
8. Czech copy: never em-dashes; comma, colon, or spaced en-dash.
9. In Ručně every stage pixel matters: nothing may overlap the crop stage.

---

## 9. Design Freedom

- **The core exploration — section composition** (pick a direction): (a) full-bleed mat, polished (current interim + intentional pill/tile/inset refinements); (b) inset sticker panel — mode+preview in a rounded ink-bordered panel floating on the mat; (c) photo-workshop metaphor — echo the v3 polaroid/tape language around the preview with the pill as a docked tool; (d) header-strip — pill on its own tinted strip above a clean preview area.
- Seam or no seam at the column boundary (if seam: v3 dashed language, §3.1).
- Pill placement (centered top vs. docked corner vs. bottom near tile) and pressed-intent choice (`default` accent vs. `outline` primary).
- Tile strip treatment: floating chip vs. taped mini-polaroid vs. tray; label chip styling.
- Empty-state art direction (dashed drop zone, taped note, mascot doodle) within §3.5's structure.
- Pencil overlay styling/placement.
- Motion: mode-switch transition (crossfade/spring per app's 200 ms + spring easing), `prefers-reduced-motion` gated.

---

## 10. Visual References

- **Current implementation (source of truth for behavior)**: `src/lib/components/blocks/gift/GiftDetailForm.svelte` (lines ~472–598), `src/lib/components/blocks/gift/gift_detail_modal_variants.ts`, `src/lib/components/blocks/gift/GiftImagePreviewSlots.svelte`, `src/lib/components/base/toggle-group/`, `src/lib/components/base/toggle/toggle_variants.ts`.
- **Pre-#174 state (what the issue complains about)**: board screenshot `.mpx/board-files/Pasted image 20260715145125.png` (note: old teal palette + 3 tiles — both since replaced).
- **Design language**: `designs/redesign-2026/sky-final/anime-sky-final.html`, `anime-gift-detail-modal.html`; v3 accepted design `designs/gift-detail-modal-v3/refined.html` + `SUMMARY.md` (the sibling surface this section must feel related to).
- **Sibling briefs (consistency)**: `designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` (md step), `designs/unified-filters/DESIGN_BRIEF_UNIFIED_FILTERS.md` (token-inheritance rule), `designs/gift-detail-modal/DESIGN_BRIEF_GIFT_DETAIL_MODAL_V2.md` (edit-mode form column).
- Tokens: `src/app.css` (canonical), `designs/tokens.css`.

---

## 11. Not Included (Scope Exclusions)

- Visitor/read-only view (`GiftDetailView`, `view*` slots, action bar) — v3 / #165, FINAL.
- `ImageCropStage` internals (handles, zoom model, target label chrome) — #116, accommodate as-is.
- Right form column fields, image source tabs (Nahrát/URL), footer buttons — v2 brief + #142.
- Control-height sweep and price/currency row alignment — #159 (`designs/control-heights/`).
- Dialog close button treatment — #164.
- Editor mode semantics (legacy `auto` preservation, per-target persistence) — behavior, not design.

---

## 12. Decisions Taken (revisit if needed)

1. **Current state documented from code, not a live screenshot**: at brief time the shared checkout carried a concurrent session's WIP that broke gift-card rendering in the dev server, so a live capture would have shown foreign work-in-progress. `GiftDetailForm.svelte` itself is clean; §2/§3 baselines come from it. Mockup authors should re-shoot the modal if the tree is clean (`node scripts/shot.mjs` + a card click, user martin).
2. **#174's border removal is the accepted baseline**, not a candidate for revert: the design starts from "no seam" and may reintroduce framing only as an intentional sticker/mat element (§3.1).
3. **Empty state is in scope** (it is the same section at its other extreme); crop-stage internals are not.
4. **Pill stays `md`** per control-heights' dense-editor rule even though it is the section's hero control — visual weight should come from the treatment, not height.
