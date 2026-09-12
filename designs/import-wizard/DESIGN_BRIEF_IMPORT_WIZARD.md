# Design Brief – CSV / Google Sheets Import Wizard

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/import-wizard/refined.html`
> **Summary**: `designs/import-wizard/SUMMARY.md`
> **Refinements**: icon source-method tabs (File / Table / Google, no numbers); clarified internal scrolling with sticky heads + token-themed scrollbars; expanded append dedup step with long, asymmetric lists (16 imported vs 26 existing); removed the in-grid "Reprezentativní náhled" preview label so the grid top-aligns with the existing-items panel.

**Component:** `ImportWizard` (`src/lib/components/blocks/import/`)
**Date:** 2026-06-03
**Status:** Design phase

---

## 1. Purpose

The Import Wizard turns a CSV / TSV file, a pasted spreadsheet range, or a Google Sheets share link into real gifts on a wishlist. It is a 3-step flow – **Zdroj → Kontrola → Potvrzení** (Source → Review → Confirm) – that lets the user:

1. Supply tabular data three ways (file upload, paste cells, paste a Sheets link) without leaving the app.
2. **Review and select/deselect exactly which rows become gifts** before anything is committed – nothing is created until the final step.
3. **Spot duplicates** against what already exists in the app (append flow) so the same gift is not added twice.
4. Confirm the operation and watch it commit, ending with a link straight to the wishlist.

The wizard collapses column-mapping and per-row editing into a single Review step on purpose, to keep the flow at exactly **three steps**.

This brief covers the wizard **shell** + the **Source** step + the **Confirm** step + **how Review embeds the Gift Draft Grid**. It does **not** specify the draft-grid internals (separate brief at `designs/gift-draft-grid/`).

> **Surprise-protection note:** Import is an owner/moderator authoring surface. It never displays reservation state. The append flow compares against existing gift _names/links only_ – never reservation data – so the core invariant holds without special handling.

---

## 2. Surrounding Context

The wizard is a modal flow (`base/dialog` on desktop, `base/sheet` full-screen on mobile) overlaying whichever page launched it. It has **two entry points**, and the entry point pre-sets the destination so the user is never asked "new or existing?" inside the wizard:

| Entry point                  | Where it lives                                                                                                   | Destination pre-set                           | Trigger UI                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **New wishlist from import** | `CreateWishlistModal` (an "Importovat" option) **and** a lower-intensity button beside the navbar "Vytvořit" CTA | A **new** wishlist (title editable in Review) | `base/button` `intent="outline"` with Lucide **FileUp** icon; **icon-only** below the `md` breakpoint (mirrors how the navbar "Vytvořit" CTA is `hidden md:inline-flex`) |
| **Append to existing**       | `WishlistDetailToolbar`, next to the "Přidat přání" (Add gift) action                                            | **This** wishlist (the one being viewed)      | `base/button` `intent="outline"` with Lucide **FileUp** icon, in the owner/moderator action cluster                                                                      |

Both triggers are gated to owner/moderator on a non-archived wishlist (same gate as "Přidat přání"). Closing the wizard (X, Escape, backdrop, or "Zrušit") returns to the unchanged launching page; nothing is persisted until Confirm commits.

The wizard header shows the 3 step labels as a progress indicator (`base/progress` or a stepped tab strip). There is **no URL change** on open – consistent with the project's modal-over-page pattern (DECISIONS.md: gift detail / sharing as overlays).

---

## 3. Content Requirements

### 3.1 Shell (all steps)

| Element                | Source       | Notes                                                                                          |
| ---------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Step indicator         | wizard state | `1 Zdroj` · `2 Kontrola` · `3 Potvrzení`; current step emphasized, completed steps marked done |
| Title                  | static       | "Importovat dárky"                                                                             |
| Back control           | wizard state | `intent="ghost"`, label "Zpět"; hidden on step 1                                               |
| Next / primary control | wizard state | Label changes per step (see States table); `intent="primary"`                                  |
| Cancel / close         | wizard state | X button (≥44×44px) + "Zrušit"; both confirm-free unless a commit is in progress               |

### 3.2 Step 1 – Zdroj (Source)

A segmented control (`base/tabs` or `base/toggle-group`) selects one of **three** input methods. Each method shows its own helper text.

| Method        | Label                     | Control                                                                     | Helper text (Czech)                                                                                 | Behavior                                                                                                                               |
| ------------- | ------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ① File        | "Nahrát soubor"           | Drag-and-drop zone modeled on `derived/image-upload` (drop / click-to-pick) | "Přetáhněte soubor .csv nebo .tsv, nebo klikněte pro výběr."                                        | Accepts `.csv` / `.tsv`; delimiter auto-detected by PapaParse; filename captured for the new-list title pre-fill                       |
| ② Paste cells | "Vložit buňky"            | Smart `base/textarea`                                                       | "Zkopírujte rozsah buněk z Excelu nebo Tabulek Google a vložte je sem (Ctrl+V)."                    | Paste handler reads **both** `text/plain` (TSV) **and** `text/html` clipboard so columns + hyperlinks survive; falls back to TSV parse |
| ③ Sheets link | "Odkaz na Tabulky Google" | `base/input` (URL) + "Načíst" button                                        | "Vložte odkaz na sdílenou nebo publikovanou tabulku Google. Tabulka musí být přístupná přes odkaz." | Server fetches `export?format=csv`; private sheet or a Google **Docs** link → friendly inline error (see States)                       |

Shared across all three:

| Element             | Notes                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| Limits notice       | Small helper: "Max 200 řádků / 1 MB." Over-limit → friendly error, no commit |
| Inline error slot   | `base/alert` `tone="danger"` for parse / private-sheet / over-limit failures |
| Source-ready signal | "Pokračovat" stays disabled until a source parses to ≥1 row                  |

### 3.3 Step 2 – Kontrola (Review)

Review = **column-mapping controls on top** + the embedded **Gift Draft Grid** below. The grid internals (row editing, selection checkboxes, validation chips) are defined in `designs/gift-draft-grid/` and are **not redesigned here**; this brief only specifies the controls layered above it and the data the grid receives.

| Element                                     | Role-gate       | Notes                                                                                                                                                                                     |
| ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title field** (new-list flow only)        | owner           | Editable `base/input` above the grid, pre-filled from filename. Strips extension + redundant "sdílená tabulka" tail, e.g. `Dárky Rosie sdílená tabulka - Dárky Rosie.csv` → "Dárky Rosie" |
| **Smart-detected header row**               | –               | Shows which row was treated as the header; preamble/footer rows auto-skipped, with a hint ("Přeskočeno N řádků")                                                                          |
| **Per-column role dropdowns**               | –               | One `base/select` per detected column. Options: `Název` / `Poznámka` / `Odkaz` / `Cena` / `Stav` / `Ignorovat`. Smart-detected defaults pre-selected; `Název` is required to advance      |
| **Embedded Gift Draft Grid**                | –               | One editable row per parsed data row, each with a select/deselect checkbox; receives the column→role mapping and the parsed rows as props                                                 |
| **Existing-items panel** (append flow only) | owner/moderator | The destination list's current gifts shown alongside for comparison; never shows reservation data                                                                                         |
| **Duplicate badge** (append flow only)      | owner/moderator | Incoming rows matching an existing gift by **normalized name OR link host+path** get a `base/badge` `tone="warning"` "možný duplikát"; the user decides whether to keep or deselect       |
| Selection summary                           | –               | Live count: "Vybráno 21 z 24 řádků"                                                                                                                                                       |

### 3.4 Step 3 – Potvrzení (Confirm)

| Element                   | Notes                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary line              | New: "Vytvořit seznam **Dárky Rosie** s 21 dárky." · Append: "Přidat 8 dárků do **{název seznamu}**." Counts reflect only **selected valid** rows |
| Duplicate caveat (append) | If any kept rows are flagged: "2 z nich jsou možné duplikáty." `base/alert` `tone="warning"`                                                      |
| Commit button             | `intent="primary"`: "Vytvořit seznam" / "Přidat dárky"                                                                                            |
| Commit progress           | `base/progress` (determinate if row count known) + status text "Importuji…"                                                                       |
| Success state             | Check icon + "Hotovo – přidáno 21 dárků." + primary link "Otevřít seznam →" (navigates to `/w/<short-id>`)                                        |

---

## 4. States Table

| State                           | Trigger                                             | Visual change                                                                                                                                |
| ------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Step 1 – empty**              | Wizard opens                                        | Source tabs shown, active method's input + helper; "Pokračovat" disabled                                                                     |
| **Parsing**                     | File dropped / cells pasted / link fetched          | Inline spinner in the active method; inputs locked; "Pokračovat" disabled                                                                    |
| **Parse error**                 | Malformed / unreadable data                         | `base/alert` `tone="danger"`: "Soubor se nepodařilo načíst. Zkontrolujte formát (CSV/TSV)." Source remains editable                          |
| **Empty after parse**           | Parsed but 0 usable rows                            | `base/alert` `tone="warning"`: "Nenašli jsme žádné řádky k importu." "Pokračovat" stays disabled                                             |
| **Private-sheet error**         | Sheets link is private, or a Docs (not Sheets) link | Friendly `tone="danger"` alert: "Tabulka není veřejně přístupná. Nastavte sdílení na 'Kdokoli s odkazem' nebo vložte publikovaný CSV odkaz." |
| **Over-limit error**            | >200 rows or >1 MB                                  | `tone="danger"` alert: "Příliš velký soubor – max 200 řádků / 1 MB." No advance                                                              |
| **Step 2 – review**             | Valid source parsed → Next                          | Mapping controls + embedded draft grid; "Pokračovat" enabled only while ≥1 valid row is selected and `Název` is mapped                       |
| **No selection**                | All rows deselected in grid                         | "Pokračovat" disabled; hint "Vyberte alespoň jeden řádek."                                                                                   |
| **Duplicates present** (append) | Incoming row matches existing gift                  | "možný duplikát" badges on matched rows; existing-items panel highlights the match                                                           |
| **Step 3 – confirm**            | Review valid → Next                                 | Summary line + commit button; back still available                                                                                           |
| **Committing**                  | Commit pressed                                      | Button shows spinner + disabled; `base/progress` advances; wizard not closable                                                               |
| **Success**                     | Commit resolves                                     | Success panel with count + "Otevřít seznam →" link; step indicator fully complete                                                            |
| **Commit error**                | Server rejects commit                               | `tone="danger"` alert with retry; selections preserved; wizard stays open                                                                    |
| **Cancel / close**              | X, Escape, backdrop, or "Zrušit"                    | Wizard unmounts (confirm-free unless committing); launching page unchanged                                                                   |

---

## 5. Component Reuse Map

| Component                  | Source tier                                                  | Notes                                                                                                                               |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Wizard shell (desktop)     | `base/dialog`                                                | Modal container; owns focus trap + scroll lock                                                                                      |
| Wizard shell (mobile)      | `base/sheet`                                                 | Full-screen degrade below `md`                                                                                                      |
| Step indicator             | `base/progress` **or** `base/tabs` (display-only)            | 3-step header; no manual z-index                                                                                                    |
| Source method switch       | `base/tabs` / `base/toggle-group`                            | Three input methods (2–5 options → toggle-group is idiomatic)                                                                       |
| File drop zone             | `derived/image-upload` (pattern)                             | Reuse its drag/drop + click-to-pick interaction model, retargeted to `.csv`/`.tsv` (a sibling `derived/file-drop` may be extracted) |
| Paste textarea             | `base/textarea`                                              | Custom `paste` handler reads `text/plain` + `text/html`                                                                             |
| Sheets-link input          | `base/input` + `base/button`                                 | URL field + "Načíst"                                                                                                                |
| Column role dropdowns      | `base/select`                                                | One per column; `Select.Item` inside `Select.Group`                                                                                 |
| Title field                | `base/input` + `base/label`                                  | New-list flow only                                                                                                                  |
| Inline errors              | `base/alert` (`tone`)                                        | danger / warning per state                                                                                                          |
| Duplicate badge            | `base/badge` (`tone="warning"`)                              | "možný duplikát"                                                                                                                    |
| Selection / summary counts | text + `base/badge`                                          | Live "Vybráno N z M"                                                                                                                |
| Commit progress            | `base/progress`                                              | Determinate when row count known                                                                                                    |
| Buttons                    | `base/button` (`intent`)                                     | primary (Next/Commit) · ghost (Back) · outline (entry triggers)                                                                     |
| Confirm-step success link  | `base/button` `intent="link"` / `href`                       | Navigates via `resolve('/(app)/w/[id]', …)`                                                                                         |
| **Gift Draft Grid**        | `blocks/gift-draft-grid` _(separate brief)_                  | Embedded in Review; internals out of scope here                                                                                     |
| Existing-items panel       | `blocks/import/` + `derived/wishlist-preview` (or list rows) | Append flow only                                                                                                                    |

```
blocks/import/
  ImportWizard.svelte            – orchestrator: open state, role gate, step machine, destination
  ImportSourceStep.svelte        – 3-method source picker + parse handling
  ImportSourceFileDrop.svelte    – .csv/.tsv drop zone (image-upload pattern)
  ImportSourcePaste.svelte       – smart textarea (text/plain + text/html)
  ImportSourceSheetLink.svelte   – URL input + server CSV fetch + private-sheet error
  ImportReviewStep.svelte        – column-mapping controls + draft-grid embed + dedup
  ImportColumnMapping.svelte     – per-column role dropdowns + header/skip hints
  ImportExistingItemsPanel.svelte– append-flow duplicate comparison (no reservation data)
  ImportConfirmStep.svelte       – summary, commit, progress, success
```

> Parsing is handled by **PapaParse** (delimiter auto-detect) in a small util module, not a component.

---

## 6. Layout Constraints

- **Desktop width:** Review step is the widest – target **min(1100px, 92vw)** so the embedded grid + (append) existing-items panel fit; Source and Confirm steps may sit in a narrower **640–720px** centered column. The shell can grow per-step rather than locking one width.
- **Height:** content-driven up to **90vh**; the **draft grid scrolls internally** (sticky mapping header + sticky footer with Back/Next), the shell chrome does not scroll away.
- **Footer action bar:** Back (left) / Next-or-Commit (right) pinned to the wizard footer, always visible above the scroll region.
- **Source tabs:** equal-width on desktop; stack/scroll horizontally if cramped.
- **Append existing-items panel:** side-by-side with the grid ≥ `lg`; collapses **below** the grid (or into a `base/collapsible`) under `lg`.
- **Close button:** top-right, ≥44×44px touch target.
- **Backdrop:** `oklch(0 0 0 / 0.5)` + optional `backdrop-filter: blur(4px)`; respects `prefers-reduced-motion`.
- **Z-index:** `--z-modal: 50` (handled by Dialog/Sheet – no manual override).
- **Mobile (< `md`):** wizard degrades to **full-screen `base/sheet`**; one step visible at a time; source tabs may become a stacked list; mapping dropdowns stack above a horizontally scrollable grid.

---

## 7. Design Tokens Used

Canonical source is `src/app.css`; `designs/tokens.css` is reference only.

- **Primary (sage green):** `--primary: oklch(52.7% 0.154 150.069deg)` + `--primary-foreground` – Next/Commit CTAs
- **Surfaces:** `--background`, `--card`, `--surface-2`, `--surface-3`, `--muted` (panel backgrounds, mapping bar, drop zone)
- **Text:** `--foreground`, `--muted-foreground`, `--foreground-subtle` (helper text, skip hints)
- **Borders:** `--border`, `--border-strong` (drop zone, grid, panel dividers via `base/separator`)
- **Status:** `--status-danger` / `--destructive` (parse, private-sheet, over-limit, commit errors), `--status-warning` (empty-after-parse, "možný duplikát", duplicate caveat), `--status-success` (commit success)
- **Typography:** Figtree Variable (body, ~15px/1.5) + Noto Sans Variable (headings, semibold); sizes `--text-xs` … `--text-2xl`; step title `--text-xl`
- **Spacing:** 4px grid – modal padding `--space-6`, section gap `--space-5`, control gap `--space-3`
- **Radii:** `--radius` (0.625rem) for inputs/cards; `--radius-full` for pills/badges
- **Shadow:** `--shadow-xl` (modal lift)
- **Motion:** `--duration-normal` (150ms) + `--ease-standard` for step transitions; `--duration-fast` (100ms) for control feedback
- **Z-index:** `--z-modal: 50`, `--z-overlay: 40`

---

## 8. Design Constraints

1. **Nothing commits before Confirm.** Steps 1–2 are fully reversible; gifts are created only by the commit button on step 3.
2. **Gate forward navigation.** "Pokračovat" is disabled until: (step 1) a source parses to ≥1 row; (step 2) `Název` is mapped **and** ≥1 valid row is selected.
3. **Owner/moderator only, non-archived.** Same gate as "Přidat přání"; archived wishlists expose no import entry point.
4. **No reservation data, ever.** The append existing-items panel and duplicate matching use name/link only – never counts, gifters, or reservation state.
5. **Friendly, recoverable errors.** Parse / private-sheet / over-limit / commit errors are inline (`base/alert`), keep the user's input, and never dump raw parser output.
6. **Hard limits enforced pre-commit:** 200 rows / 1 MB, checked at parse time.
7. **Filename → title is a suggestion, not a lock.** The pre-filled title is freely editable.
8. **Map + edit live in one step.** Do not split column-mapping and row-editing into separate steps – the flow must stay 3 steps.
9. **Accessibility:** focus trapped in the wizard; Escape closes (unless committing); step indicator and live counts use `aria-live`; all controls keyboard-reachable; WCAG AA contrast (4.5:1).
10. **No Google OAuth / Picker.** Sheets access is link-only via server-side `export?format=csv`.

---

## 9. Design Freedom

- Step-indicator treatment: numbered stepper, segmented progress bar, or labeled tab strip.
- Source-method switch styling: top tabs vs. a left rail vs. stacked cards on mobile.
- Whether the three source methods share one panel that swaps content, or each renders its own card.
- Drop-zone visual richness (icon-only vs. icon + example-format hint vs. illustrated).
- Column-mapping layout: dropdowns in a sticky bar above the grid, or inline in each grid column header (as long as grid internals stay owned by the grid brief).
- Append duplicate presentation: side panel, inline badge only, or a "N možných duplikátů" filter chip – provided no reservation data leaks.
- Confirm-step layout: centered summary card vs. full-width banner; success state inline vs. replacing the step body.
- Transition style between steps (slide, fade, or crossfade), honoring reduced-motion.
- Whether the existing-items panel uses `derived/wishlist-preview`-style cards or compact list rows.

---

## 10. Visual References

- `designs/gift-detail-modal/DESIGN_BRIEF_GIFT_DETAIL_MODAL.md` – structural model for this brief
- `designs/sharing-flow/DESIGN_BRIEF_SHARING_FLOW.md` – multi-step wizard shell + table-driven Reuse Map precedent
- `designs/gift-draft-grid/` – the embedded Review grid (its internals are defined there, not here)
- Current visual fidelity, palette, and component requirements come from `src/app.css` and current components. `archive/designs/style-exploration/direction-b-sage.html` is historical provenance only.
- `designs/tokens.css` – structural token vocabulary (reference)
- `src/app.css` – **canonical** production tokens (use these)
- `src/lib/components/blocks/wishlist/CreateWishlistModal.svelte`, `WishlistDetailToolbar.svelte`, `blocks/navbar/Navbar.svelte` – live entry-point hosts
- `src/lib/components/derived/image-upload/ImageUpload.svelte` – drop-zone interaction pattern
- App primary = sage green `oklch(52.7% 0.154 150.069deg)`

---

## 11. Not Included

- **Gift Draft Grid internals** – row editing, per-cell validation, selection mechanics, link-chips (owned by `designs/gift-draft-grid/`).
- **Gift Card v2** – the wishlist gift card redesign.
- **Single-gift modal** – `GiftDetailModal` (separate brief).
- **Metadata enrichment internals** – link → image/price/title auto-fill (Phase 2; may post-process imported gifts later, but its UI is out of scope).
- **Name-based product search** – best-effort name → product lookup (Phase 3).
- **Google OAuth / Picker / Drive API** – explicitly excluded; link-only access.
- **Bulk-entry dialog** – the non-import shared-draft-grid entry surface (sibling feature, separate brief).
- **Post-import edit-lock / sharing behavior** – governed by the wishlist lifecycle, not the wizard.
