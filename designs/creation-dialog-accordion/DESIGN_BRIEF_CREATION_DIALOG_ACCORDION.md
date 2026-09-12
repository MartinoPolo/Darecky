# Creation Dialog — „Další nastavení" Accordion — Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/creation-dialog-accordion/refined.html`
> **Summary**: `designs/creation-dialog-accordion/SUMMARY.md`
> **Refinements**: equal, centered spacing of the accordion trigger between the dashed divider and the solid separator (8px each side — tighter than the form's `gap-4`, so the optional zone reads as a compact cluster)
> **Chrome note**: the mockup's dialog chrome (title, description, labels, segmented toggle, close button) predates and is superseded by control-heights §3.9 — see §4.8.

The create-wishlist dialog today offers only recipient choice („Pro mě" / „Pro někoho jiného"), optional recipient name, title, and event date; description, palette, and image become editable only after creation (settings modal). This design adds an optional, **collapsed-by-default** „Další nastavení" disclosure section to the creation dialog containing description and palette (image participation is an open HITL question, §3), so a list can be fully dressed at creation time without any post-creation edit round-trip. Leaving the section untouched must produce exactly today's creation behavior.

**Source**: issue #112.

---

## 1. Purpose

Creating a list and then immediately opening settings to add a description and pick a palette is a two-step chore for what is one mental act: "make my Christmas list, red". The dialog's own subtitle already promises it — „Zadejte název a volitelně další údaje." — but the dialog delivers only the name and date. The accordion keeps the fast path fast (two fields, create, done) while letting motivated users finish the list's identity in one place.

This is also the **first feature integration of a disclosure component** (`base/accordion` / `base/collapsible` exist but are unused in feature code), so the pattern chosen here becomes the app's disclosure precedent.

**Key value**: full list setup in one dialog for those who want it, zero added friction for those who don't.

---

## 2. Surrounding Context

The mockup **MUST** show the full viewport with the dialog floating over real app chrome at correct proportions.

### Full Viewport Structure

1. **Backdrop surface**: the dialog opens from the navbar „Vytvořit" button and from dashboard empty states — render it over the **Moje seznamy** dashboard. Reproduce the chrome faithfully from `designs/unified-filters/current-dashboard-my-lists.png`: app header (~56 px: logo, nav pills, Vytvořit, bell, palette, CZ, dark-mode, avatar), „Moje seznamy" DynaPuff page title + toolbar, 3-column sticker wishlist-card grid. All FINAL — context only, dimmed under the overlay scrim.
2. **The dialog — THE DESIGN AREA**: centered `Dialog.Content` — `bg-card`, `rounded-panel` (16 px), `border-[2.5px] border-ink`, `shadow-sticker`, `p-6`, width `sm:max-w-lg` (512 px), full-width minus 2 rem on mobile. Contents top to bottom:
    - Header: title „Nový seznam přání", subtitle „Zadejte název a volitelně další údaje."
    - Recipient segmented `ToggleGroup` („Pro mě" / „Pro někoho jiného"), unified ink border (FINAL, keep)
    - (conditional) recipient-name `Field` + `RecipientPreview` (FINAL, keep)
    - Title `Field` („Název", placeholder „např. Vánoce 2026") (FINAL, keep)
    - Event-date `Label` + `DatePicker` („Datum události") (FINAL, keep)
    - **→ NEW: „Další nastavení" accordion section (collapsed by default)**
    - Import escape hatch: `Separator` + „nebo" + small ghost „Importovat dárky" (FINAL, keep, stays BELOW the accordion)
    - Footer: „Zrušit" outline + „Vytvořit" primary (FINAL, keep)

**What parent provides**: overlay/scrim, dialog shell, header, footer — the base `Dialog` component.
**What this component fills**: one new section in the form flow between the event date and the import separator.
**Must NOT include**: any change to the existing fields, the import hatch, or the footer; no navigation chrome redesign.

**Mockup rendering instructions**:

- Desktop viewport ~1440×900, dashboard chrome behind the scrim; light mode, sky palette (light mode is the source of truth — dark derives from tokens).
- Show at least: (a) dialog with accordion **collapsed** (the default — must look calm, near-identical to today), (b) accordion **expanded** with description + palette visible, a non-default palette selected.
- One narrow (~390 px) strip of the expanded state proving the dialog scrolls internally (no viewport overflow, footer reachable).
- Per issue #159 (`designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` §3.5) every height-bearing control in this dialog renders at `lg` 38 px — mock at those metrics, not today's 32 px.

---

## 3. Open Questions (HITL)

Issue #112 carries the HITL label; these product questions are **unresolved**. Each gets a provisional recommendation the mockup follows — clearly marked, not a settled decision.

### Q1 — Is image upload part of the creation accordion at all?

Prior decision tension: issue #36's historical brief (`archive/designs/wishlist-visuals/`, provenance only) made "image assignment lives in settings, never in create" a non-negotiable; #112 explicitly reopens it. Technical blockers have since dissolved: uploads are wishlist-id-independent (target-prefix keys, `src/lib/server/storage/r2.ts`) and abandoned pre-save uploads already get client-side cleanup (see Q2). The real cost is UX weight: the full `WishlistCropEditor` (3 slots, three-mode Fill/Fit/Manual model) would balloon a quick-create dialog.

**Provisional recommendation (mockup follows this)**: the accordion contains **description + palette only**. If product later approves image-at-creation, the design extension is a *simple upload-only field* (drop zone → thumbnail preview → remove), all slots defaulting to automatic centered cover framing, with a helper line pointing to settings for fine-tuning crops („Ořezy upravíte později v nastavení seznamu.") — never the full crop editor inside the creation dialog. The brief's layout reserves room for that third item; the mockup does not render it.

### Q2 — Orphaned-upload cleanup strategy (if image-at-creation is approved)

The issue text ("no cleanup mechanism exists today") predates the current code: since issue #107, every upload authorization mints a per-object **delete token**, and `createPendingUploads()` (`src/lib/modules/uploads/upload.ts`) tracks pending objects — `commit(finalKey)` deletes all but the saved one, `discardAll()` deletes everything on cancel/unmount. `WishlistCropEditor` already uses it. A creation-dialog image field would reuse the same helper; dialog cancel/close calls `discardAll()`. Residual orphan risk (tab crash before cleanup) is identical to the existing settings image tab.

**Provisional recommendation**: reuse `createPendingUploads()`; no new UI implication. A TTL-based sweep for crash-orphans is an infra decision that applies equally to all existing upload flows and is **out of this design's scope**.

### Q3 — Accordion vs Collapsible, default state, focus management

Both base components exist, neither has feature usage. `base/accordion` is pre-styled (semibold `py-4` trigger with chevron-down/up swap, hover underline, dashed `border-ink-faint` item divider, animated height); `base/collapsible` is a bare animated primitive that would need bespoke trigger styling.

**Provisional recommendation (mockup follows this)**: single-item `Accordion.Root type="single"` (collapsible), **collapsed by default** (the default state is also REQ-1, i.e. not itself open). Focus management: expanding keeps focus on the trigger (bits-ui default); revealed fields join the natural tab order; the dialog's initial focus behavior (autofocus recipient-name on „Pro někoho jiného") is unchanged; expansion must never scroll-jump the dialog — growth is downward inside the dialog's own scroll region. The designer may argue for Collapsible with a custom trigger if the accordion's underline-hover voice clashes with form context (§10 Design Freedom), but a bespoke non-primitive disclosure is banned.

---

## 4. Requirements

### 4.1 The disclosure section (REQ-1)

- One section labeled „Další nastavení" (new i18n key; Czech copy must never use em-dashes), placed after the event-date field and before the import separator.
- Collapsed by default on every open; reopening the dialog after close resets to collapsed (the form already resets all fields on close — the accordion state joins that reset).
- Trigger row: label + chevron affordance (base accordion supplies chevron-down ↔ chevron-up swap); optional leading icon (lucide `settings-2` or `sliders-horizontal`) — designer's call.
- Expanding reveals, in order: description field, palette field (image reserved per Q1). Collapsing hides them; **entered values are kept** while the dialog stays open (collapse is visual, not destructive).
- With values set and the section re-collapsed, the trigger row should hint that hidden values exist (see §5 States; exact treatment is design freedom §10).
- The whole dialog must handle the added height: cap at `max-h-[85vh]` with internal `overflow-y-auto` (the settings modal's proven pattern) so the footer stays reachable at 390 px with the section expanded.

### 4.2 Description field (REQ-1, REQ-3)

- `Label` „Popis" + base `Textarea`, placeholder „Přidejte volitelný popis" (reuse existing keys `wishlist_description_label` / `wishlist_description_placeholder`).
- Optional, no validation; rows-driven height (~3 rows), `resize-vertical`; textareas are exempt from the control-height scale (#159 REQ-4) but keep Input-aligned typography.
- Trimmed client-side; empty → not sent / stored as `null` — matching the settings modal's save behavior.
- Persisted **atomically with creation** via the extended create input — never as a follow-up mutation.

### 4.3 Palette field (REQ-1, REQ-2, REQ-3)

- Section label: „Barevná paleta" (derive from existing `wishlist_palette_dialog_title` = „Barevná paleta seznamu" or a new shorter key — designer's call on wording, no em-dashes).
- The 10 curated palettes (`src/lib/theme/palettes.ts`): Obloha (sky, default), Máta, Broskev, Hrozen, Sakura, Oceán, Med, Malina, Matcha, Tužka — swatch dot (`PALETTE_SWATCHES` hex on `--p-brand`) + Czech label, 2-column grid, exactly the visual voice of today's `WishlistPalettePicker` (ink-bordered selected state, `aria-pressed`).
- **Controlled, not self-saving**: selection updates local dialog state only; NO network request on click. The value persists atomically at create. Default preselection: Obloha (sky) — matching the DB default, so an untouched picker changes nothing.
- REQ-2 refactor (implementation contract the design must respect): `WishlistPalettePicker` becomes a controlled component (`value` + `onchange`), with a thin auto-save wrapper preserving today's click-to-save + optimistic-revert behavior at both existing call sites (toolbar quick dialog in `WishlistModals.svelte`, settings modal „Vzhled" tab). Both usages must remain visually identical.

### 4.4 Untouched-parity (REQ-4 — acceptance criterion)

- Never expanding the accordion ⇒ creation behaves exactly as today: same payload semantics (description absent/null, palette = default sky), same single create request, no extra requests fired by merely opening/closing the dialog or the accordion.
- All new fields are optional; the accordion adds zero required interactions to the fast path.

### 4.5 Server contract (REQ-3 — context for the designer, implemented outside the mockup)

- `CreateWishlistInputSchema` / `NewWishlistInput` / `seedNewWishlist` gain optional `palette` and `description` (additive; the legacy `theme` field stays untouched; `palette` column already defaults `'sky'`).
- Acceptance: a palette chosen at creation is visible on the wishlist page immediately after the post-create redirect; a description entered at creation renders on the wishlist page.

### 4.6 Control heights (issue #159 dependency)

Per `designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` §3.5, this dialog is a **form stack at `lg` 38 px**: segmented control, inputs, date picker, footer buttons (import shortcut stays `sm`). New controls follow: the palette option rows and accordion trigger are not height-scale controls, but their metrics must harmonize with the 38 px rhythm; the textarea is exempt. If #112 ships before #159, the mockup's `lg` metrics are the target state and the dialog simply lands there when #159 sweeps.

### 4.7 Copy

- New visible copy: „Další nastavení" (trigger); optionally a muted one-line hint inside the expanded section or under the trigger (e.g. „Vše volitelné, lze upravit i později."). ALL Czech copy: never em-dashes (—); comma, colon, or spaced en-dash instead.

### 4.8 Dialog chrome (issue #159 §3.9 supersedes this mockup)

`refined.html` was refined for layout/spacing only and predates the control-heights refinement
(`designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` §3.9), which owns dialog chrome
app-wide. Five chrome details in this mockup are stale — implement per #159, using
`designs/control-heights/refined.html` as the chrome reference:

| Element              | This mockup (stale)                            | #159 §3.9 (authoritative)                                                   |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `Dialog.Title`       | hardcoded 21 px                                | `text-2xl` 22 px DynaPuff semibold                                           |
| `Dialog.Description` | `text-md` 13 px                                | `text-sm` 12 px muted                                                        |
| Form `Label`         | 13 px / weight 700 / full ink                  | 12 px / weight 600 / ~72 % ink (scoped to `Label`; no global ink flip)       |
| Segmented toggle     | joined single container, `border-left` divider | two separate ink-outline buttons with a gap; active = accent fill + sticker shadow |
| Close button         | bare positioned `×`                            | production circled X (`overlayCloseButtonClass`, #164)                       |

This mockup remains authoritative for the accordion layout, the 8 px trigger spacing, `lg` 38 px
controls (§4.6), and the palette grid.

---

## 5. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Collapsed (default) | trigger row only; dialog reads near-identical to today | dialog opens |
| Expanded | description + palette revealed with animated height (base accordion animation) | click/Enter/Space on trigger |
| Trigger hover | affordance emphasis (base accordion: underline; designer may restyle §10) | pointer over |
| Trigger focus | visible focus ring (`focus-visible` ring pattern) | keyboard focus |
| Collapsed with values | hint on the trigger row that hidden values exist (e.g. muted summary „Popis · Máta", dot, or count badge — §10) | user set values, then collapsed |
| Palette default | Obloha (sky) option carries the selected treatment | untouched |
| Palette selected | clicked option gains ink border + accent bg (today's picker voice); prior selection cleared; NO request fired | click on option |
| Description filled | plain filled textarea; grows via manual resize only | typing |
| Submitting | ALL controls disabled incl. accordion contents; trigger inert; „Vytvářím…" spinner in the primary button (today's pattern) | „Vytvořit" pressed |
| Submit error | server error line above footer (today's pattern); accordion state preserved | createWishlist fails |
| Dialog re-open | accordion collapsed, description empty, palette back to sky — full reset with the rest of the form | close → open |
| Recipient „Pro někoho jiného" | recipient field + preview appear ABOVE title as today; accordion unaffected below | segment switch |
| Narrow (~390 px) | dialog max-height with internal scroll; expanded section scrollable, footer reachable | small viewport |
| Reduced motion | height animation suppressed (`prefers-reduced-motion`) | OS setting |

---

## 6. Component Reuse Map

### Existing Components (MUST use)

| Component | Variant/Props | Usage in This Design |
| --- | --- | --- |
| `Dialog` (base) | `Content` default `sm:max-w-lg` + `max-h-[85vh] overflow-y-auto` | the dialog shell (existing) |
| `Accordion` (base, `$lib/components/base/accordion`) | `Root type="single"` + one `Item` + `Trigger` + `Content` | the „Další nastavení" disclosure (Q3 provisional) |
| `Textarea` (base) | `state="default"`, ~3 rows | description field |
| `Label` / `Field` (base / derived) | as in the existing dialog fields | section labels / description field wrapper |
| `ToggleGroup`, `Input`, `DatePicker`, `Separator`, `Button` | exactly as today (at #159 `lg` metrics) | existing dialog fields — reproduce, do not redesign |
| Lucide icons | `chevron-down`/`chevron-up` (built into accordion); optional `settings-2` | trigger affordance |

### Components to Adopt (install from shadcn-svelte)

| Component | Source | Rationale |
| --- | --- | --- |
| — none — | | `base/accordion` and `base/collapsible` are already installed |

### Components to Refactor / Design

| Component | Description | Why |
| --- | --- | --- |
| `WishlistPalettePicker` → controlled | pure picker: `value` + `onchange`, no `wishlistId`, no network | REQ-2 prerequisite for creation-time use |
| auto-save palette wrapper (blocks) | thin wrapper adding today's `setWishlistPalette` click-to-save + optimistic revert + toasts | keeps both existing call sites behaviorally identical |
| — no new visual primitives — | | disclosure + existing form components cover everything |

---

## 7. Layout Constraints

- Dialog width unchanged: `sm:max-w-lg` (512 px), mobile full-width minus 2 rem. Widening to `sm:max-w-xl` is allowed ONLY if the palette grid demonstrably needs it (§10) — never wider (the settings modal at `2xl` is the heavier surface; creation stays lighter).
- Vertical: form `flex flex-col gap-4`; accordion is one flow child, full dialog width; expansion grows the form downward inside `max-h-[85vh] overflow-y-auto` — the dialog never overflows the viewport and the footer never detaches.
- Palette grid: 2 columns (today's picker), 10 options; option rows compact (~32–36 px) so the expanded section stays scannable; swatch dot 16 px with 2 px ink ring.
- Accordion trigger: full-width row; its padding must sit on the 4 px spacing scale and visually separate the optional zone from the required fields above (the base accordion's dashed divider voice may serve as the separator). **The collapsed trigger must be vertically centered between the dashed divider above it and the solid import `Separator` below it — equal 8 px on each side (refined), deliberately tighter than the form's 16 px `gap-4` so the optional zone reads as a compact cluster. Achieve this with 8 px between the dashed divider and the trigger, and by pulling the accordion 8 px onto the `Separator` (the accordion↔separator gap is 8 px, not the form's 16 px) — do not change the global form gap.**
- Control heights per §4.6 (`lg` 38 px stack; textarea exempt; import shortcut `sm`).
- Touch targets ≥ 24 px for palette options and the trigger on mobile.

## 8. Design Tokens

From `src/app.css` (canonical source; `designs/tokens.css` is reference only):

- Fonts: `--font-body` Geist for ALL dialog text (DynaPuff never appears inside form controls).
- Type: `--text-base` 14 px at `lg` controls (#159 pairing), `--text-sm` 12 px helper/summary text, trigger label semibold per base accordion.
- Sizes: `--size-control-lg` 38 px (form stack), `--size-control-sm` 26 px (import shortcut).
- Geometry: `--radius-panel` 16 px (dialog), `--radius-btn` 7 px (controls, accordion trigger focus ring), `--border-w` 2.5 px ink borders.
- Shadows: `--shadow-sticker` (dialog), `--shadow-sticker-sm` (controls).
- Color: semantic tokens only — `bg-card`, `border-ink`, `border-ink-faint` (accordion divider), `bg-accent` (palette hover/selected fill), `--ring` (focus), `text-muted-foreground`/`text-foreground-subtle` (hints), `text-destructive` (submit error). Palette swatch dots use the literal `PALETTE_SWATCHES` hexes (they ARE the content, not theming).
- The dialog renders in the VIEWER'S app palette (`data-palette` on `<html>`); selecting a wishlist palette inside the picker must NOT re-theme the dialog or app shell (wishlist tokens are scoped to the wishlist page).

## 9. Design Constraints (Non-Negotiable)

- Collapsed by default; untouched accordion ⇒ byte-identical creation behavior and request count (REQ-4, acceptance).
- Disclosure built on the base `accordion` or `collapsible` primitive — no bespoke show/hide div with manual state.
- Palette selection in this dialog fires NO network request; persistence is atomic with create (REQ-3).
- The controlled-picker refactor must leave both existing auto-save call sites visually and behaviorally unchanged (REQ-2, acceptance).
- Existing dialog fields, import hatch, and footer: reproduce, do not redesign (only the #159 height step-up applies).
- Section order: required fields → accordion → import hatch → footer. The optional zone never interleaves with required fields.
- Expansion animates height only (motion-safe), never scroll-jumps the dialog or viewport; internal scroll per §7.
- Accessibility: trigger is a real button with `aria-expanded`/`aria-controls` (bits-ui provides), revealed controls keyboard-reachable, palette options keep `aria-pressed`, focus ring pattern consistent with the app.
- Semantic tokens only; light AND dark must both work (dark derives from tokens automatically).
- Czech copy: never em-dashes.
- HITL: the mockup must NOT include an image upload field (Q1 provisional) — reserving composition room for it is fine.

## 10. Design Freedom

- **Trigger voice**: base accordion styling as-is (semibold + underline hover) vs a restyled trigger that reads more form-like (e.g. muted label + chevron, no underline); leading icon or none; whether a one-line „vše volitelné" hint accompanies it.
- **Accordion vs Collapsible**: Q3 recommendation is Accordion; a Collapsible-based composition with custom trigger is acceptable if it demonstrably fits the form context better.
- **Collapsed-with-values hint**: muted value summary („Popis · Máta"), a small dot/badge, or nothing — pick one and show it.
- **Palette presentation**: today's 2-column label rows vs a denser swatch-first grid with labels; how the selected state reads at creation (ink ring, accent fill, check) — must stay recognizably the same family as the settings picker.
- **Section order inside the accordion**: description-then-palette (recommended, mirrors settings tabs order) or palette-first.
- **Live preview**: whether selecting a palette previews anything beyond the swatch (e.g. a small tinted preview chip inside the section). Re-theming the dialog/app is banned (§8); a scoped inline preview element is allowed.
- **Width**: stay `sm:max-w-lg` vs step to `sm:max-w-xl` if the palette grid needs air (justify in the mockup if taken).
- **Motion**: expansion easing/duration within the app's motion tokens; motion-safe only.

## 11. Visual References

- **Internal**:
    - `src/lib/components/blocks/wishlist/CreateWishlistModal.svelte` — the dialog to extend (structure, field patterns, reset/submit behavior).
    - `src/lib/components/blocks/wishlist/WishlistSettingsModal.svelte` — where these fields live post-creation today (Podrobnosti/Vzhled tabs; description + palette voices to match).
    - `src/lib/components/blocks/wishlist/WishlistPalettePicker.svelte` + `src/lib/theme/palettes.ts` — palette option anatomy, swatches, labels.
    - `src/lib/components/base/accordion/` (+ `Accordion.stories.svelte`) — the disclosure primitive's built-in voice.
    - `designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` — `lg` 38 px form-stack metrics for this dialog.
    - `designs/unified-filters/current-dashboard-my-lists.png` — backdrop chrome to reproduce.
    - `designs/redesign-2026/sky-final/anime-dashboard.html` — anime-sky design language.
    - `archive/designs/wishlist-visuals/DESIGN_BRIEF_WISHLIST_VISUALS.md` — historical (#36): the "image never in create" prior decision Q1 reopens; its theme-preset system is superseded by the 10-palette system.
- **External**: none required; the disclosure pattern is standard (shadcn accordion) — visual language stays anime-sky.

## 12. Not Included (Scope Exclusions)

- Image upload/crop UI in the creation dialog — pending HITL Q1; even if approved, the full `WishlistCropEditor` never embeds here.
- TTL/server-side orphaned-upload sweep — infra concern, applies to all upload flows equally (Q2).
- Any change to the settings modal, toolbar palette quick dialog, or their auto-save behavior (they only swap to the wrapper internally).
- The #159 height-scale component work itself (Input `size`, Select rewiring) — this dialog merely lands on that scale.
- Server schema/i18n implementation details beyond the contract in §4.5.
- Import wizard and its entry point (visual position preserved only).
- Storybook story for the controlled picker (acceptance criterion of #112, implementation-side, not a mockup artifact).
- Gift categories (#104) and any other future accordion sections.
