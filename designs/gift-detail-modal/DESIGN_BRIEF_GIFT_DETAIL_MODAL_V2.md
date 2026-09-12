# Design Brief – Gift Detail Modal v2 (Multi-link + Enrichment)

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

> **Status**: Refined (Variant A + C cherry-picks)
> **Refined mockup**: `designs/gift-detail-modal/refined-v2.html`
> **Summary**: `designs/gift-detail-modal/SUMMARY-v2.md`
> **Refinements**: C link editor container, "Zobrazení:" label prefix, C compact footer, C enrich bar

> **Layers on:** `designs/gift-detail-modal/DESIGN_BRIEF_GIFT_DETAIL_MODAL.md` (v1).
> This brief documents **only the deltas** v2 adds to the modal's **edit mode**. Everything not mentioned here is **unchanged from v1** – read v1 first. Where v1 and v2 conflict (e.g. the single-URL field), v2 wins.

**Component:** `GiftDetailModal` / `GiftDetailForm` (`src/lib/components/blocks/gift/`)
**Date:** 2026-06-03
**Status:** Refined – v2 deltas

---

## 1. Purpose (what v2 adds)

v2 extends **edit mode only** (owner-on-draft and moderator – the role gates are unchanged from v1 §8) with two capabilities:

1. **Multi-link editor.** Replace the single `url` input with a small list editor: add / remove / reorder up to **10** links; each link is a URL input + optional **label** (placeholder = the link's domain, e.g. `alza.cz`). The **first** link (`links[0]`) is the **primary** link and is marked as such. In view/display mode, all links render stacked (clickable, external-link icon + domain), primary first.
2. **✨ "Načíst metadata" enrich button (Phase 2).** A button that fetches **image / price / title** from a link (later phase: by name) and pre-fills the matching form fields. It is **per-item / progressive** and **non-destructive** (confirm before overwriting filled fields). Some sites return nothing, so the UI must degrade gracefully.

Non-goals for v2: no change to the modal frame, the view-mode reservation/like/receive surfaces, or any role/invariant rule. **The owner still never sees reservation state.**

---

## 2. Surrounding Context

Unchanged from v1 §2 (center modal over `/w/<short-id>`, no route change, 2-column `45%/55%` grid).

Two integration points to respect:

- **Data model change.** The gift's single `url: string | null` is replaced by `links: { url: string; label?: string }[]` (jsonb, max 10, `links[0]` = primary). This is the model both the editor and the view-mode link list read/write. (The DB/transport migration is out of scope for this brief – design against the target shape.)
- **Image field reuse.** The image field keeps the existing v1 flow: URL-tab / Upload-tab + fit-mode toggle + crop canvas (`GiftImageCropCanvas`). Enrichment does **not** introduce a new image picker – it only **pre-fills `imageUrl`** (as if typed into the URL tab), after which the existing crop/fit flow takes over (see §8).

---

## 3. Content Requirements

### 3a. Multi-link editor (edit mode) – replaces the v1 single "URL" field

| Element                | Source               | Notes                                                                                                         |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Link row × N           | `links[i]`           | Stacked rows; row order = link order                                                                          |
| URL input              | `links[i].url`       | Same `Input` styling as v1; domain auto-derived for the label placeholder                                     |
| Label input (optional) | `links[i].label`     | Placeholder = derived domain (e.g. `alza.cz`); empty label ⇒ domain is used as the display label in view mode |
| Primary marker         | `i === 0`            | First row is primary; labelled "Hlavní odkaz" (badge or star). Reordering a row to the top makes it primary   |
| Reorder affordance     | –                    | Move row up/down (and/or drag); changes which link is `links[0]`                                              |
| Remove row             | –                    | Per-row delete (`x` / `trash-2`)                                                                              |
| Add link               | –                    | "Přidat odkaz" appends an empty row; disabled at 10 (see §4)                                                  |
| Cap counter            | `links.length`       | e.g. "3 / 10" when near/at the cap                                                                            |
| Empty state            | `links.length === 0` | "Bez odkazu" placeholder + a single "Přidat odkaz" affordance                                                 |

Per-row validation copy (Czech): invalid URL → "Neplatná adresa"; duplicate URL → "Tento odkaz už je v seznamu"; cap reached → disable add, hint "Maximálně 10 odkazů". Reuse v1's normalize rule (bare domains get `https://` prepended) for display/validation.

### 3b. View / display mode – link list

| Element           | Source               | Notes                                                                                    |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| Stacked link list | `links[]`            | Each: external-link icon + display label (label or domain) + new-tab open. Primary first |
| Primary emphasis  | `links[0]`           | Visually first / slightly emphasized; secondary links lighter                            |
| Empty state       | `links.length === 0` | "Bez odkazu" (muted), no link row                                                        |

> v1's single "Koupit na alza.cz ↗" affordance becomes the **primary entry** of this stacked list. Everything else in view mode is unchanged.

### 3c. Enrich button + result (edit mode, Phase 2)

| Element                     | Source                      | Notes                                                                             |
| --------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| "✨ Načíst metadata" button | action                      | Sparkles icon + label; secondary/ghost intent so it never competes with Save      |
| Target fields               | image / price / title(name) | Fields the fetch can fill                                                         |
| Per-field skeleton          | during loading              | `Skeleton` over the fields being filled                                           |
| Success highlight           | after fill                  | Subtle, transient highlight on changed fields                                     |
| Inline error                | on failure                  | "Metadata se nepodařilo načíst" + **Zkusit znovu** retry; fields untouched        |
| Partial note                | on partial                  | Fill what came back; note which fields stayed empty (e.g. "Cena nebyla nalezena") |
| Overwrite confirm           | when target filled          | Small confirm before replacing existing values (see §9)                           |

**Source of the fetch = the primary link** (`links[0]`) by default; placement options in §6. Name-based enrichment is **later** (Phase 3, §11).

---

## 4. States Table (deltas only)

| State                          | Trigger                        | Visual change                                                                       |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------- |
| **Links – empty**              | `links.length === 0` in edit   | "Bez odkazu" + lone "Přidat odkaz" affordance                                       |
| **Links – one**                | `links.length === 1`           | Single row, marked primary; reorder controls inert/hidden                           |
| **Links – many**               | `links.length > 1`             | Stacked rows; primary marker on row 0; reorder enabled                              |
| **Adding a link**              | "Přidat odkaz" clicked         | New empty row appended + focused; counter increments                                |
| **Reordering**                 | Move up/down or drag           | Rows reflow; row now at top becomes primary (marker moves)                          |
| **At cap (10)**                | `links.length === 10`          | "Přidat odkaz" disabled; counter "10 / 10"; hint "Maximálně 10 odkazů"              |
| **Invalid / duplicate URL**    | Bad or repeated URL            | Row marked `aria-invalid`; inline "Neplatná adresa" / "Tento odkaz už je v seznamu" |
| **Enrich – idle**              | Default edit mode              | "✨ Načíst metadata" enabled when ≥1 link has a URL; disabled with hint if none     |
| **Enrich – loading**           | Button clicked                 | Spinner on the button (disabled); `Skeleton` over target fields                     |
| **Enrich – success**           | All fields returned            | Fields populated; transient highlight; button returns to idle                       |
| **Enrich – partial**           | Some fields returned           | Returned fields filled + highlighted; missing-field note; no error tone             |
| **Enrich – failed**            | Nothing returned / fetch error | Inline error + **Zkusit znovu**; all fields unchanged                               |
| **Enrich – overwrite-confirm** | Target field already filled    | Inline confirm ("Přepsat?" Přepsat / Ponechat) before overwriting                   |

All v1 edit-mode states (§4 v1: Editing, Received, Archived, edit-lock) are unchanged and still apply.

---

## 5. Component Reuse Map

```
blocks/gift/
  GiftDetailForm.svelte            – EDIT: swaps single URL Input for the link editor;
                                     hosts the enrich button + result states
  GiftLinkEditor.svelte    (new)   – add/remove/reorder rows, cap, validation, primary marker
  GiftLinkRow.svelte       (new)   – one row: URL Input + label Input + reorder + remove
  GiftLinkList.svelte      (new)   – VIEW: stacked clickable links, primary-first, empty state
  GiftEnrichButton.svelte  (new)   – ✨ button + idle/loading/success/partial/failed +
                                     overwrite-confirm (UI only; transport injected via prop/callback)

base/   (reuse, do not edit)
  button/ (intent="ghost"|"secondary"|"outline"), input/, label/, badge/,
  separator/, skeleton/ (per-field loading), spinner/ (button loading),
  tooltip/, alert/ (inline enrich error), help-text/

Icons (Lucide only): sparkles (enrich), external-link (view links),
  plus (add), x / trash-2 (remove), grip-vertical / arrow-up / arrow-down (reorder),
  star (primary marker), loader → Spinner (loading).
```

Reuse v1's `gift_detail_modal_variants.ts` slot vocabulary (`formField`, `formRow`, `imageTab*`); add slots for link rows / reorder handle / enrich states rather than ad-hoc classes.

---

## 6. Layout Constraints

Inherits v1 §6 (900px content, `45%/55%` grid, `max-h-[90dvh]`, scrollable right column, mobile collapse). Deltas:

- **Link editor** lives where v1's single URL field was, in the right (form) column. Rows are full-width and stack vertically; the URL input dominates, the label input is narrower (URL : label ≈ 2 : 1, or label below URL on `<480px`).
- **Reorder + remove controls** are compact (≤ row height); keep within the right column gutter so rows don't shift horizontally on hover.
- **Touch targets** ≥ 44×44px for add / remove / reorder / enrich (consistent with v1's close-button rule).
- **Enrich button placement (propose):** primary = a compact action **adjacent to the primary link row** (acts on `links[0]`); acceptable alt = the **form header** near the title. It must be visually subordinate to the Save button in `formActions` (footer). Choosing exact placement is a §9 freedom.
- **Skeletons** occupy the exact footprint of their target fields (image stage, price input, name input) to avoid layout shift during loading.

---

## 7. Design Tokens Used

Inherits v1 §7. Additional / emphasized:

- `--muted` / `--accent` + `Skeleton` – per-field loading shimmer.
- `--status-success` – transient success highlight on enriched fields.
- `--status-danger` / `--destructive` – inline enrich-failure tone; row validation error text.
- `--primary` – primary-link marker accent; sparkles tint (used sparingly so it doesn't read as the CTA).
- `--muted-foreground` – secondary links, domain placeholders, "Bez odkazu", cap counter.
- `--radius-md` / `--radius-lg` – link rows, enrich-result chrome.
- Motion: v1 `--duration-normal` + `--ease-out` for the success-highlight fade and row add/remove; respect `prefers-reduced-motion` (no reorder slide animation).

No new color tokens – semantic tokens only (per project styling rules).

---

## 8. Design Constraints

1. **All v1 invariants hold unchanged.** Owner never sees reservation data; edit button for owner only in Draft (edit-lock after sharing – the link editor and enrich button sit **inside** the v1 `disabled` fieldset and must lock with it); reserved gifts stay non-force-removable.
2. **`links[0]` is always primary.** The "first = primary" rule is the single source of truth – no separate "is-primary" toggle per row. Reordering is how primary changes. Removing row 0 promotes the next row.
3. **Cap = 10, enforced in the UI.** Add disabled at 10; never render an 11th row.
4. **Enrichment is non-destructive by default.** Never silently overwrite a filled field – empty fields fill freely; filled fields require explicit confirm (§9). Name/title fill must respect v1's required-name validation.
5. **Enrichment degrades gracefully.** Failure/partial must never block saving or clear existing data; the field stays editable by hand. No spinner may trap focus or disable the whole form – only the enrich button + its target fields show busy state.
6. **Image enrichment routes through the existing crop flow.** A fetched image URL is written to `imageUrl` exactly as the URL tab would, then the existing fit-mode/crop canvas applies. Do **not** bypass or duplicate `GiftImageCropCanvas`; a freshly enriched image defaults to the same fit behavior as a manually pasted URL.
7. **Accessibility.** Reorder operable by keyboard (not drag-only); each link row has an accessible name (label or domain); enrich loading announced via `aria-busy`/live region; WCAG AA contrast (v1 §8).
8. **Transport-agnostic UI.** The enrich component owns only UX/state; the actual fetch is injected (callback/prop). No provider/endpoint logic in the modal (see §11).

---

## 9. Design Freedom

- **Overwrite behavior (propose & justify).** Recommended default: **fill only empty fields**; for fields that are already filled, surface an inline **"Přepsat?"** affordance (Přepsat / Ponechat) per field, or a single summary confirm listing what would change. Alternative: a global "Přepsat vyplněná pole" toggle on the enrich control. Pick one and note the rationale.
- **Enrich placement** – adjacent to the primary link row vs. form header (§6); whichever keeps it clearly subordinate to Save.
- **Reorder mechanism** – drag handle (`grip-vertical`), up/down buttons, or both (keyboard path required regardless).
- **Primary marker style** – badge ("Hlavní"), leading star, or accent stripe on row 0.
- **Success highlight treatment** – background tint, left accent, or brief outline; duration/easing within v1 motion tokens.
- **Label/URL row composition** – side-by-side vs. stacked; how the domain placeholder is derived and shown.
- **Partial-result messaging** – per-field "nenalezeno" hints vs. one summary line.
- **View-mode link density** – list vs. compact chips for secondary links (primary stays prominent).

---

## 10. Visual References

- v1 brief + `designs/gift-detail-modal/refined.html` – the modal frame, 2-column layout, field styling these deltas slot into.
- v1 single-URL affordance ("Koupit na alza.cz ↗") – the visual seed for the view-mode **primary** link.
- Existing image field (URL/upload tabs + fit toggle + `GiftImageCropCanvas`) in `GiftDetailForm.svelte` – the flow enrichment pre-fills into.
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-b-sage.html` is historical provenance only.
- `designs/tokens.css` + `src/app.css` – structural + semantic tokens.

---

## 11. Not Included in This Modal

- **All v1 content already covered** – reserve / unreserve / like / mark-received flows and their role gating (v1 §3–§4); not re-specified here.
- **Gift Card v2** – link/enrichment changes to the card surface are a separate brief.
- **Import wizard / draft grid** – bulk add and the draft-management surface are out of scope.
- **Enrichment provider / transport / scraping** – endpoint, parsing, caching, rate limits, reliability strategy are an **architecture** concern; only the modal's enrich **UX** belongs here.
- **Name-search enrichment specifics** – fetch-by-name is **Phase 3 (later)**; mentioned only so the button's scope can grow. No UI specified now beyond the existing button.
- **Comments / price-tracking / social sharing** – still deferred per v1 §11.
