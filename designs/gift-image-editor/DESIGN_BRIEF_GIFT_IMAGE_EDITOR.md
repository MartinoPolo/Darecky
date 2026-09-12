# Gift Image Editor — Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/gift-image-editor/refined.html`
> **Summary**: `designs/gift-image-editor/SUMMARY.md`
> **Refinements**: dropped the „Hlavní" primary-link badge (first link is primary by order) · link label field renamed „Popisek" → **„Viditelný popisek"** (EN „Visible label") · close button re-seated **inside** the panel top-right (16 px, rotate-90 on hover, #164) instead of overhanging the corner.

The gift create/edit modal's left column is a "photo workshop": the owner uploads one photo, then decides how it is framed everywhere the gift appears — the grid card (4:3), the wishlist list row and the reservation thumb (1:1). This brief specs the completed design on top of the PR #188 baseline: a **two-target crop family** with a two-tile switcher, an **adaptive full-photo crop stage** that always shows the whole picture, an intentional **design-system treatment** for the whole mode section, the **link-editor rows**, and the **list-view row alignment**.

**Source**: issue #189 (follow-up to PR #188 / issue #183). Supersedes `archive/designs/gift-edit-mode-section/` (historical provenance only; current requirements are stated in this brief). Related: #159 (control heights + dialog chrome), #165/v3 visitor modal, #116 (editor model), #131 (click-to-edit).

---

## Scope Reconciliation: what PR #188 landed vs. what this completes

Base the design on the **actual post-#188 code**, not on the pre-#188 screenshots or the superseded archived `gift-edit-mode-section` brief. PR #188 (merged to `dev` as `2f13f84`) already shipped:

**Already landed (do not re-solve; reproduce as the baseline):**

- **One 4:3 crop target** (persisted key `square`, aspect changed 1:1 → **4/3**) consumed by grid card, list thumb and reservation thumb; `card`/`detail` retired to legacy-parse-only.
- **~1100 px modal** (`content` = `sm:max-w-[1100px]`), **50/50 two-column body** (`sm:grid-cols-[50%_50%]`, `sm:min-h-[520px]`).
- **Unified crop stage** for all three modes via `ImageCropStage` `interactive` / `containMode` props — Fill/Fit are static renderings of the Manual stage. Good foundation; this issue changes only its sizing model.
- **Mode section already de-seamed in edit mode** — `GiftDetailForm` overrides the shared column slot with `border-none border-b-0 sm:border-r-0`, leaving a full-bleed dotted mat with a floating pill and NO intentional framing (the "photo workshop" treatment is this brief's job).
- **Single preview tile** (`GiftImagePreviewSlots` `TILES` = one `square` entry, label „Seznam a rezervace" — now a **stale label**, see §3.1), the stage label/pixel chip removed for the gift editor (`showLabelChip={false}`), legacy-`auto` presented-mode honesty, sticker/edited-line cleanups.

**Still open (this brief's job):**

1. **Reintroduce a second crop target** (1:1) + a two-tile switcher — 4:3 is wrong for list rows and mobile list view (§3.1).
2. **Make the crop stage show the whole photo** — today it is a fixed-viewport box (`h-[400px]` mobile / `sm:min-h-[520px]` desktop row) with `overflow-hidden` that clips a tall portrait even at default zoom (§3.2).
3. **Give the mode section an intentional treatment** (sticker/mat, no thin grey border) grouping pill + stage + tiles as one unit (§3.3–3.6).
4. **Link-editor row styling** + **list-view row alignment** (§3.7, §3.9).

---

## 1. Purpose

The image column answers, while the owner edits: **"how will my gift photo look in every place it appears?"** The mode control chooses the framing strategy (Vyplnit = automatic cover crop, Přizpůsobit = whole picture letterboxed, Ručně = user-drawn crop); the big adaptive stage shows the full photo with the active surface's window overlaid live; the two tiles show the exact card (4:3) and list/reservation (1:1) crops and switch which one the stage is editing.

**Key value**: the owner sees the whole photo and both output crops at once, adjusts a single focal point, and trusts that what the window frames is exactly what each surface renders — WYSIWYG across two aspect ratios, no clipped previews, no guesswork.

---

## 2. Surrounding Context

The mockup **MUST** show the full modal with both columns at correct proportions. The image column never exists alone.

### Full viewport structure (top to bottom, left to right)

- **Backdrop**: owner's wishlist page (`/w/<shortId>`), dimmed + blurred under the Dialog overlay scrim. Reduced fidelity; sticker gift cards visible behind.
- **Dialog panel** (`giftDetailModalVariants.content`): centered, **`sm:max-w-[1100px]`**, `max-h-[90dvh]`, `p-0 gap-0`, rounded panel with ink border and the production circled-X close button (#164, top-right of the panel — belongs to the Dialog chrome, not the column).
- **Body** (desktop ≥ 640 px): 2-col grid **`grid-cols-[50%_50%]`**, **`min-h-[520px]`**. Each column ≈ 550 px wide.
  - **Left = THE DESIGN AREA** (≈ 550 px × ≥ 520 px): mode pill + adaptive stage + two tiles + empty state.
  - **Right = form column (FINAL — reproduce at production fidelity, do not redesign the fields):** scrollable fieldset (Název, Popis, Odkazy editor, Cena + Měna row, Počet + Priorita, Obrázek source tabs Nahrát/URL) over a pinned action footer (Uložit / Označit jako přijatý / Smazat full-width buttons above a dashed top seam). Dialog chrome (title/description/labels) per #159 §3.9.
- **Mobile** (< 640 px): one scrolling flex column; the image column is a strip on top, fields flow under it, footer sticky at bottom. In **Ručně** the column becomes `sticky top-0` so the stage stays visible while fields scroll (this stickiness is preserved; its fixed `h-[400px]` is the thing the adaptive stage reworks — §3.2 / §6).

**What parent provides**: Dialog chrome + circled close, body grid, right form column, pinned footer.
**What this component fills**: the left column only — mode control + adaptive stage + two tiles (+ empty state).
**Must NOT include / redesign**: the circled close button, the right-column fields' internals (reproduce them), the footer buttons.

### Mockup rendering instructions

- Desktop ~1440×900: full modal over the dimmed wishlist. Right column reproduced faithfully at final fidelity; left column is the exploration.
- **Use a PORTRAIT sample photo** so the adaptive stage renders tall and the target window is demonstrative (a portrait 4:3 window sits inside the photo; the 1:1 window is a smaller square). A landscape photo would hide the whole point.
- Show, at minimum, these frames: **(a) Vyplnit** with the photo + auto-centered 4:3 window; **(b) Přizpůsobit** (whole photo letterboxed inside the window); **(c) Ručně** with the interactive window + thirds grid + zoom control + the two tiles below, **Seznam a rezervace (1:1) tile active** (so the 1:1 window shows); **(d) empty** (no image) state.
- One ~390 px **mobile strip**: the image column above the first fields.
- Light mode only (dark derives from tokens). Sky palette; per-wishlist themes re-map tokens, so use **semantic tokens only**.

---

## 3. Requirements

### 3.1 Two-target crop family + two-tile switcher (REQ-1, REQ-2, REQ-3)

- **Two gift crop targets**, both offered by the editor:
  - **`square` key → 4:3 "card" target** (grid card image area). The key name is kept for backward-compatible persistence — a **documented misnomer** (it is 4:3, not square; renaming needs a data migration, rejected).
  - **new `thumb` key → 1:1 target** for the wishlist **list-view thumbnail** + **reservation thumbs**.
- **Two preview tiles**, one per target, in the mode section:
  - **„Karta"** — 4:3 tile (`square` target).
  - **„Seznam a rezervace"** — 1:1 tile (`thumb` target). *(The current single tile's label „Seznam a rezervace" moves to the 1:1 tile; the 4:3 tile takes the new „Karta" label.)*
  - Tiles are the **only** crop-target switcher. **Clicking a tile jumps to Ručně with that target active.** The active tile shows `ring-2 ring-primary`.
- **List thumb** (`GiftListItem`) renders the **1:1** target (reverts PR #188's interim 4:3 list thumb). **Reservation thumb** (`ReserveModal`, the `size-12` rotated square) binds to the **1:1** target so it becomes an **exact** consumer (today it approximates the 4:3 `square` focal+zoom).
- **Carry-over, no migration**: the 1:1 target reads `targets.thumb ?? targets.square` (pre-#188 manual crops were drawn as 1:1 squares → render verbatim), else automatic center cover-fit. Focal + zoom are aspect-independent; carry-over is render-time re-projection only. Re-examine the one-way seed shim in `GiftDetailForm.initTargetRects()` (`targets.square ?? targets.card`) when adding the second target.

### 3.2 Adaptive full-photo crop stage (REQ-4, REQ-5) — the core geometry change

One crop stage drives all three modes (already unified). The change is the **sizing model**, inverted from today:

- **Today (PR #188):** the stage viewport is a fixed box sized by its parent (`h-[400px]` mobile / the `sm:min-h-[520px]` desktop grid row); `cropWindow` is the largest target-aspect box that fits **inside** the viewport; the photo is scaled so its cropped region fills the window and everything past the viewport is **clipped** (`overflow-hidden`). A tall portrait is cut off even at default zoom.
- **New:** the **stage adapts to the photo's natural aspect** within the column — a portrait renders tall, a landscape wide — bounded by **sensible min / max height caps** (see §6). The **full uncropped photo** renders **contained** at default zoom, always fully visible. The **target window is overlaid on the photo**, marking exactly the region the active surface renders. So: *the photo fills the stage; the window sits inside the photo* — the reverse of today.
  - **Overhang** = the parts of the photo **outside** the window → **dimmed** (the existing `bg-black/55` veil with a rectangular hole over the window), **never clipped** at default zoom.
  - **Window frame** = the active target's region only — `outline-2 outline-white/90` (existing). **Active target only; no secondary indication of the inactive target** (the tiles carry that).
- **Per-mode behavior on the adaptive stage:**
  - **Vyplnit**: window **auto-centered, static**, **no thirds grid**; wheel-over the stage **promotes to Ručně** (existing `onWheelPromote`).
  - **Přizpůsobit**: the **whole photo sits inside the window** with the **letterbox mat / fill color** around it (existing `containMode`) — the window equals the target aspect, the photo is letterboxed within it.
  - **Ručně**: the same window becomes **interactive** — drag to move, zoom slider, **thirds grid** overlay, reset. **At default zoom the full photo is still visible;** zooming in (up to **300 %**, `IMAGE_ZOOM_MAX = 3`) scales the photo past the stage bounds and **may crop** — that is expected Ručně behavior.
- **Rework the fixed-height containers** that currently size the viewport — the mobile sticky `h-[400px]` (in `GiftDetailForm`) and the `sm:min-h-[520px]` grid row (in `gift_detail_modal_variants.ts`) — to support the adaptive stage. **Ručně mobile stickiness is preserved** (the column still sticks; only the fixed inner height gives way to the aspect-driven, capped height).

### 3.3 Photo-workshop mode section (REQ-6)

Give the mode + stage + tiles grouping an **intentional design-system treatment** so it reads as a designed surface, not a bare full-bleed mat meeting the white form column at a raw edge.

- Use the app's **sticker / mat vocabulary** — dotted notebook mat, sticker panel (2.5 px ink border + hard offset shadow), tape / polaroid accents, surface tints. **No thin grey border** (`border-ink-faint` dashed) — that is the "unfinished wireframe" look #156 rejected.
- The treatment must **group** mode pill + adaptive stage + two tiles as **one unit** ("the photo and its controls"), **visually distinct** from the form column on the right.
- Decide the column/form boundary explicitly: either **no seam** (surface-tint contrast carries it) or a **deliberate seam**. If a seam returns, echo the v3 visitor view's language (`border-dashed border-ink-faint`, 2 px, bottom on mobile / right on desktop) — do not invent a third seam style.
- Works at **both geometries**: tall desktop column (≈ 550 × ≥ 520) and the mobile strip (full width × the adaptive-capped height).
- **All current behaviors preserved, function unchanged**: immediate mode swap (live preview), wheel-zoom promotion, tile-click → Ručně, pencil overlay opens the file picker, empty state = whole-column upload button, Ručně mobile sticky.

### 3.4 Mode control (segmented pill)

- Component: **`ToggleGroup.Root type="single"`** + three **`ToggleGroup.Item`**, Button-backed, group **`size="md"` (32 px)** — the correct step per the control-heights brief (gift edit modal = dense editor = `md`; do **not** upsize, even though it is the section's hero control — visual weight comes from the treatment).
- Baseline container (refine, already sticker-ish): `rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-[3px_3px_0_var(--hard-shadow)]`; items `rounded-full`.
- Pressed item: `intent="default"` toggle (accent tint + ink border) — the designer may propose the `outline` intent (pressed = `bg-primary text-primary-foreground`) if accent reads too weak; pick one, apply consistently.
- Labels (existing i18n, do NOT change): **„Vyplnit" / „Přizpůsobit" / „Ručně"**; group `aria-label` „Zobrazení obrázku".
- Lives **in the image column with the stage it drives** — never returns to the form fields (settled #116 decision). Placement within the column (centered top vs. docked) is open (§9).

### 3.5 Preview tiles (the two-tile strip)

- Component: `GiftImagePreviewSlots`, now **two tiles**:
  - **„Karta"** — 4:3 (`square`), tile at `h-14` with `aspect-ratio: 4 / 3`.
  - **„Seznam a rezervace"** — 1:1 (`thumb`), **square** tile (e.g. `size-14`).
- Tile face (baseline): `rounded-md border-2 border-ink bg-card shadow-[3px_3px_0_var(--hard-shadow)]`; **active** tile `ring-2 ring-primary`. Label chip under each: `rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold`.
- **Placement**: in Vyplnit/Přizpůsobit the tiles float over the stage's lower edge (`absolute inset-x-0 bottom-3` baseline); in **Ručně** the tiles sit **below** the stage (`px-4 pb-3` baseline) — **never overlapping the stage** in Ručně (every crop pixel matters). Each tile is a live `ImageFrame` render of its target.

### 3.6 Empty state (no image)

- Whole-column `imagePlaceholder` button (existing `openImageEditor`): upload icon (`size-16 text-ink-faint`), „Přidat obrázek" (semibold), „Klikněte pro nahrání nebo výměnu" (subtle). **In scope to restyle** so the empty column also reads intentional (e.g. dashed drop-zone sticker, taped note) within this structure. **No mode pill and no tiles render without an image.**

### 3.7 Form column — link-editor rows (REQ-7)

Keep production behavior, adopt the accepted mockup styling, enrich with a visible label field („Viditelný popisek"):

- **Behavior (production, keep):** each link = **URL + per-link label**; the label **defaults to the URL's domain** and is the text gift cards render (e.g. „↗ alza.cz"). Add / remove / reorder, cap counter, URL validation error. **The primary-link badge („Hlavní odkaz") is dropped** (refine) — the first row is primary by order alone, so a visible chip is redundant noise; `gift_link_primary` may survive only as an aria/screen-reader hint on `links[0]`, never a visible badge.
- **Visible label field, renamed (refine):** the per-link label input gains a **visible `Label` reading „Viditelný popisek"** (EN „Visible label"). Production today shows only a placeholder („Popisek (volitelné)"); a visible label disambiguates it from the gift **„Popis"** (description) field above and states plainly that this text is what visitors see. Needs a **new message key** (e.g. `gift_link_visible_label` = „Viditelný popisek" / „Visible label"); the existing `gift_link_label_placeholder` stays as the input placeholder.
- **Styling (requirements stated here; `archive/designs/gift-edit-mode-section/variants/variant-a.html` is historical provenance only):** a **bordered URL input** with the **trash icon to the right of the row**, and a **„+ Přidat odkaz" ghost affordance below** the rows. Reconcile with production, which already carries the label field but in a heavier bordered-card row (`rounded-md border border-border/60 p-2.5`) — the target is the lighter accepted row **plus a visible label field** (URL row + label field, trash right, ghost add below).
- Uses `GiftLinkEditor` / `GiftLinkRow`; label „Odkazy" per existing i18n.

### 3.8 Form column — two-column rows (#159 REQ-5, inherited)

- **„Cena" + „Měna"** and **„Počet" + „Priorita"** render as **two-column rows** (`grid grid-cols-2 gap-3`), label rows sharing a height so control tops sit flush. This layout is **#159 REQ-5**; this issue inherits it. (Current code already pairs Cena+Měna; Počet and Priorita are separate full-width fields today and become the second paired row.) Reproduce faithfully; do not redesign the field internals.

### 3.9 Wishlist list-view row alignment (REQ-8)

- **Align list-view rows horizontally with the components above them** (hero card + toolbar): the **thumbnail's left edge** and the **row's right edge** match the toolbar / hero edges, reclaiming the current side padding — desktop and mobile.
- **Mechanism (resolves the open spec item):** `GiftListItem`'s row container carries **`px-2`** (`grid ... px-2 py-3 ... sm:grid-cols-[6rem_minmax(0,1fr)]`), while its list wrapper `WishlistGiftListView` is a bare `flex flex-col` (no padding). Remove the row's **`px-2` horizontal inset** (keep `py-3`) so the thumbnail column starts at the same x as the hero card content / left-most toolbar control, and the row's right edge (like button / actions) aligns with the hero/toolbar right edge. If the hero/toolbar sit inside a page container with its own horizontal padding, match that value instead of going to `px-0` — the **outcome is flush edges**, the reclaimed inset is ≈ the `px-2` (8 px) each side.
- Secondary in the mockup: the primary deliverable is the editor modal; a small **before/after list-view inset** may illustrate the alignment but is optional.

### 3.10 Dialog chrome (#159 §3.9, authoritative)

Reproduce these in the mockup — they are settled, not open:

- **`Dialog.Title`**: **`text-2xl` 22 px DynaPuff semibold** (NOT off-scale 21 px, NOT Noto Sans).
- **`Dialog.Description`**: `text-sm` 12 px muted, tight gap.
- **Form `Label`**: 12 px / weight **600** / **≈72 % ink** (scoped to `Label`; no global ink flip; helper/meta text stays ≈62 %).
- **Close button**: production **circled X** (`overlayCloseButtonClass`, #164) — not a bare `×`. It sits **inside** the panel's top-right (`top-4 right-4`, 16 px inset; `size-control-lg` 38 px), **never overhanging** the corner, and **rotates 90° + scales on hover** via `--ease-spring` (motion-reduce gated). *(Refine: the first mockup drew it overhanging at `-13px`; corrected to the production inside position.)*

### 3.11 Copy

- All labels exist in `messages/cs.json` — no new copy required. Any copy the mockup adds must **never use em-dashes (—) in Czech text** — use comma, colon, or a spaced en-dash.

---

## 4. States

| State | Visual treatment | Trigger |
| --- | --- | --- |
| Empty (no image) | Whole column = upload button (§3.6); no pill, no tiles | `imageUrl` and `imageKey` both empty |
| Vyplnit (default) | Adaptive stage shows full photo; **active target window auto-centered, static**; overhang dimmed; pencil overlay; two tiles float at lower edge | mode = fill (also after image replace) |
| Přizpůsobit | Whole photo **letterboxed inside the window** (mat / fill color around it); tiles float | mode = fit |
| Ručně | Interactive window (drag + zoom + thirds grid + reset); full photo visible at default zoom, may crop when zoomed ≤ 300 %; **tiles sit below the stage**; active tile `ring-2 ring-primary` | mode = manual, tile click, or wheel-zoom |
| Karta tile active | Stage window = **4:3** region of the photo | tile „Karta" selected |
| Seznam a rezervace tile active | Stage window = **1:1** region of the photo | tile „Seznam a rezervace" selected |
| Pill item hover | ghost Button hover (accent tint) | pointer over item |
| Pill item pressed | accent bg + ink border (or `outline` intent — §3.4) | selected mode |
| Focus visible | `focus-visible:ring-2 ring-ring` on pills, tiles, interactive stage | keyboard |
| Portrait photo | Stage renders **tall** (min/max caps); 4:3 window is a tall-ish rectangle inside it, 1:1 window a centered square | photo natural ratio < 1 |
| Landscape photo | Stage renders **wide**; windows sit inside the wider frame | photo natural ratio > 1 |
| Mobile | Adaptive strip on top; **Ručně**: column `sticky top-0` while fields scroll | < 640 px |
| Create vs. edit | Identical section (one `GiftDetailForm`); create starts empty | modal mode |
| Themed list / dark | Derives via semantic tokens (`--wishlist-*` remap, dark palette) — no bespoke colors | wishlist theme, dark mode |

---

## 5. Component Reuse Map

### Existing components (MUST use)

| Component | Variant / Props | Usage in this design |
| --- | --- | --- |
| `ToggleGroup` (base) | `type="single"`, items at group `md` 32 px; intent per §3.4 | Three-way mode control |
| `Button` (base) | `intent="ghost-overlay" size="icon-sm"` | Pencil click-to-edit overlay; `intent="ghost" size="sm"` for „+ Přidat odkaz" |
| `ImageFrame` (derived) | `fitMode/focal/zoom/fillColor`, `tokenScope="wishlist"` | Live tile renders (both targets) |
| `ImageCropStage` (derived) | `interactive`, `containMode`, `targetAspect`, `fillColor`, `showLabelChip={false}`, `onWheelPromote` | The adaptive stage (sizing model reworked, §3.2) |
| `GiftImagePreviewSlots` (block) | **two** `TILES` entries (`square` 4:3 „Karta", `thumb` 1:1 „Seznam a rezervace"), `activeTarget`, `onTileSelect` | Two-tile switcher |
| `GiftLinkEditor` / `GiftLinkRow` (block) | URL + label, add/remove/reorder | Link-editor rows (§3.7) |
| `Input`, `Select`, `Switch`, `Textarea` (base) | production props | Right-column fields (reproduce) |
| `Dialog` (base) | `Dialog.Title` `text-2xl`, circled close (#164) | Modal chrome (§3.10) |
| `giftDetailModalVariants` (tv) | `imageColumn`, `imagePlaceholder`, `body`, `formRow`, `formField` slots | The slots this design restyles (edit-mode only) |

### Components to adopt (install)

None — all primitives exist.

### Components to design (new)

None expected. Deliverables are: the adaptive-stage sizing rework (`ImageCropStage` + its containers), the second tile in `GiftImagePreviewSlots`, and the mode-section treatment (`imageColumn` / `imagePlaceholder` slots, pill container, tile-strip placement). If the treatment needs new tv() slots (e.g. `modeSectionPanel`), add them beside the existing **edit-mode** slots without touching the `view*` slots.

---

## 6. Layout Constraints

- **Modal**: `sm:max-w-[1100px]`, `max-h-[90dvh]`. **Body**: `grid-cols-[50%_50%]`, `min-h-[520px]` desktop → each column ≈ 550 px.
- **Adaptive stage height**: driven by the photo's natural aspect within the column width, **clamped by min / max caps** (replaces today's fixed `h-[400px]` / `sm:min-h-[520px]`). Suggested caps: never shorter than a usable editing area (~ the 1:1 window plus tiles), never taller than the body row (≤ `min-h-[520px]` desktop / a bounded mobile height so fields stay reachable). The **stage window** keeps `WINDOW_PAD = 16` inset from the stage bounds.
- **Control step**: `md` 32 px for pill items; tiles ≥ 32 px hit area (44 px preferred on mobile via padding). No 36 / 38 / 44 px controls in this surface.
- **Spacing**: 8 px rhythm; baseline insets `px-4 pt-3` (pill row), `p-4` (stage), `px-4 pb-3` (tile strip) — may shift on the rhythm.
- **Radii**: `--radius-panel` 16 px panels, `--radius-btn` 7 px buttons, pill `rounded-full`, tiles `rounded-md`.
- **Mobile**: image column strip on top; Ручně `sticky top-0`; the section must not grow so tall on mobile that fields become unreachable.
- **Zoom model**: `IMAGE_ZOOM_BASE = 1`, `IMAGE_ZOOM_MAX = 3` (300 %), `IMAGE_ZOOM_OUT_MIN = 0.05`.

---

## 7. Design Tokens

`src/app.css` is canonical (`designs/tokens.css` is a legacy structural reference only — its Noto Sans / larger scale is NOT the live app). Live scale: **DynaPuff** headings, **Geist** body; `xs 11 · sm 12 · base 14 · lg 15 · xl 17 · 2xl 22 · 3xl 28`; control heights 26 / 32 / 38 / 48.

- **Mat**: `bg-surface` + `bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px]` (dotted notebook mat).
- **Ink**: `--ink`, `--ink-soft`, `--ink-faint`; `--border-w` 2.5 px for sticker borders. (The rejected grey was `border-ink-faint` dashed.)
- **Shadows**: `--hard-shadow` / `--hard-shadow-strong` hard offsets (`3px 3px 0` on pill/tiles today).
- **Surfaces**: `bg-card` (white panel), `--surface-2/3`, hover `bg-accent` tint. **Stage veil**: `bg-black/55`. **Window frame**: `outline-white/90`.
- **Semantic only** — must survive `--wishlist-*` theme remap (Christmas cream/red) and dark mode with no bespoke colors.
- **Type**: Geist for all control labels (never DynaPuff in controls); tile label chip `text-[10px] font-semibold`; `Dialog.Title` DynaPuff `text-2xl` 22 px.

---

## 8. Design Constraints (Non-Negotiable)

1. **Two targets, both editor-offered**: 4:3 `square` „Karta" + 1:1 `thumb` „Seznam a rezervace"; tiles are the only switcher; tile click → Ručně with that target active. Persisted keys unchanged (`square` = 4:3 misnomer kept; new `thumb`).
2. **Adaptive stage shows the whole photo at default zoom in every mode**; window overlays the photo (photo fills stage, not stage-fills-photo); overhang dimmed not clipped; Ručně zoom-in ≤ 300 % may crop.
3. **Active target only** in the stage window — no secondary indication of the inactive target.
4. **Keep the three modes, their Czech labels, and every behavior in §3.3** — this is a reskin + sizing rework of a working surface, zero functional change to mode semantics.
5. **Mode pill at `md` 32 px** (control-heights). Right column and footer untouched except the inherited #159 REQ-5 two-column rows and the §3.7 link rows.
6. **No destructive data ops**: all carry-over is render-time re-projection (no migration); never silently rewrite legacy `auto` meta on an untouched save.
7. **View-mode slots** (`view*` in `gift_detail_modal_variants.ts`) are FINAL per v3 — do not modify; edit-mode changes must not leak into the visitor view.
8. **Semantic tokens only**; wishlist themes + dark mode keep working with no bespoke colors.
9. **Preserve test hooks**: `data-testid="gift-image-column"`, `"crop-stage"`, `"crop-stage-window"`, `"gift-preview-tile-square"` (+ the new 1:1 tile testid), `"gift-list-item"`, `"gift-list-image"`, `"gift-link-url"`.
10. **A11y**: group `aria-label` „Zobrazení obrázku" kept, `aria-pressed`/active on tiles, visible focus rings, pencil `aria-label` „Vyměnit obrázek", empty state stays a real button, stage `role`/`aria-label` for the crop region.
11. **Dialog chrome** per #159 §3.9 (§3.10). **Czech copy**: never em-dashes.
12. In Ручně **nothing overlaps the crop stage** — tiles sit below it.

---

## 9. Design Freedom

- **The core exploration — mode-section composition** (pick a direction): (a) full-bleed mat, polished (pill/tile/inset refinements); (b) **inset sticker panel** — pill + stage + tiles in a rounded ink-bordered panel floating on the mat; (c) **photo-workshop metaphor** — echo the v3 polaroid / tape language around the stage with the pill as a docked tool; (d) **header-strip** — pill on its own tinted strip above a clean stage.
- **Seam or no seam** at the column boundary (if seam: v3 dashed language, §3.3).
- **Pill placement** (centered top vs. docked corner) and pressed-intent choice (`default` accent vs. `outline` primary).
- **Two-tile treatment**: floating chips vs. taped mini-polaroids vs. a tray; how the two tiles (4:3 + 1:1) sit together; label-chip styling; which tile is active by default (Karta).
- **Adaptive-stage caps** — the exact min/max height within §6 (the constraint is: full photo visible + tiles reachable + fields reachable on mobile).
- **Empty-state art direction** (dashed drop zone, taped note, mascot doodle) within §3.6's structure.
- **Pencil overlay** styling / placement (must not fully cover the wheel-zoom area).
- **Motion**: mode-switch transition (crossfade / spring per app's ~200 ms + spring easing), `prefers-reduced-motion` gated.

---

## 10. Visual References

- **Current implementation (behavior + baseline source of truth):** `src/lib/components/blocks/gift/GiftDetailForm.svelte`, `gift_detail_modal_variants.ts`, `GiftImagePreviewSlots.svelte`, `GiftListItem.svelte`; `src/lib/components/blocks/reservation/ReserveModal.svelte`; `src/lib/components/derived/image-crop/ImageCropStage.svelte`; `src/lib/modules/images/crop_targets.ts` + `types.ts`; `GiftLinkEditor.svelte` / `GiftLinkRow.svelte`.
- **Accepted link-row historical provenance:** `archive/designs/gift-edit-mode-section/variants/variant-a.html` records the `.linkrow` + „Přidat odkaz" pattern; §3.7 is authoritative and enriches it with a label field.
- **Superseded predecessor (historical provenance only):** `archive/designs/gift-edit-mode-section/DESIGN_BRIEF_GIFT_EDIT_MODE_SECTION.md` — §3.7 and the current implementation define the requirements; its single-tile / pre-#188 geometry does not.
- **Design language**: `designs/redesign-2026/sky-final/anime-sky-final.html`, `anime-gift-detail-modal.html`; v3 accepted `designs/gift-detail-modal-v3/refined.html` + `SUMMARY.md` (the sibling visitor surface this must feel related to).
- **Sibling briefs (consistency)**: `designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` §3.9 (dialog chrome, `md` step) + `refined.html` (chrome reference); `designs/creation-dialog-accordion/DESIGN_BRIEF_CREATION_DIALOG_ACCORDION.md` §4.8 (chrome supersession table); `designs/unified-filters/` (token-inheritance rule).
- **Tokens**: `src/app.css` (canonical).

---

## 11. Not Included (Scope Exclusions)

- **Visitor / read-only view** (`GiftDetailView`, `view*` slots, action bar) — v3 / #165, FINAL.
- **`ImageCropStage` internal handle/zoom mechanics** — reuse as-is; only the sizing model + window-over-photo overlay change here.
- **Right-column field internals** (image source tabs Nahrát/URL, price-range switch, currency/priority selects) — reproduce at production fidelity; the only in-scope form changes are §3.7 link rows and the inherited #159 REQ-5 two-column rows.
- **Control-height sweep** beyond this surface — #159.
- **Dialog close-button treatment** — #164 (reproduce the circled X, seated inside the panel top-right with the hover rotation — see §3.10).
- **Editor mode semantics** (legacy `auto` preservation, per-target persistence, carry-over math) — behavior, not design; specced in #189 requirements, not the mockup.
- **Wishlist image editor tile chip** (still shown there) — out of scope; only the gift editor drops the stage chip.
- **Docs & tests** (REQ-9 `.mpx/DECISIONS.md`/`CONTEXT.md`, REQ-10 e2e geometry specs) — implementation deliverables, not design.
