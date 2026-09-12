# Gift Detail Modal v2 – Design Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Base**: Variant A | **Refined**: 2026-06-03

## Refinements Applied

Variant A was chosen and refined with: Variant C link editor container, "Zobrazení:" label prefix, Variant C compact footer, Variant C enrich bar. See the design brief for full requirements. Key changes from the base variant:

- **Link editor** replaced Variant A's flat rows with Variant C's bordered container (`.link-editor` with header, hairline-separated rows, footer). Each row stacks URL over a label row styled as a clickable link (arrow icon + underlined text, green for primary / gray for secondary – matching gift card v2's link rows). The label is an editable inline input; clicking outside the text navigates to the URL. The whole `.link-label-row` feels like a card link while remaining editable.
- **Footer** switched from Variant A's full-width Save button to Variant C's right-aligned compact Zrušit + Uložit buttons with a footer note on the left ("Načtení metadat je doplněk – uloží se až tlačítkem Uložit.").
- **Enrich bar** adopted Variant C's separated `.enrich-bar` container below the link editor (bordered box with button + hint text) instead of Variant A's inline enrich adjacent to the primary link row. Per-row sparkle icons retained from Variant C for quick per-link enrichment.

## Component Map

### Codebase – Use As-Is

| Component     | Path                                  | Usage                               | Key Props/Variants                             |
| ------------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| Button        | `src/lib/components/base/button/`     | Footer Zrušit/Uložit, overwrite     | `variant="ghost"`, `variant="default"` `size="sm"` |
| Input         | `src/lib/components/base/input/`      | Name, price, URL, label fields      | standard styling                               |
| Badge         | `src/lib/components/base/badge/`      | Not used in refined (primary = stripe) | –                                            |
| Label         | `src/lib/components/base/label/`      | Field labels                        | standard                                       |
| Skeleton      | `src/lib/components/base/skeleton/`   | Enrich loading shimmer              | per-field height                               |
| Alert         | `src/lib/components/base/alert/`      | Enrich success/warning/error        | `variant="destructive"` etc.                   |
| Separator     | `src/lib/components/base/separator/`  | Hairline between link rows          | horizontal                                     |
| Tooltip       | `src/lib/components/base/tooltip/`    | Per-row enrich sparkle hover        | standard                                       |
| Dialog        | `src/lib/components/base/dialog/`     | Modal shell                         | standard                                       |
| Help-text     | `src/lib/components/base/help-text/`  | Enrich hint, cap hint               | standard                                       |
| Tabs          | `src/lib/components/base/tabs/`       | Image URL/Upload tabs               | standard                                       |
| Toggle-group  | `src/lib/components/base/toggle-group/` | Fit/Fill toggle                   | standard                                       |

### Adopt from shadcn-svelte / Bits UI

No new components needed.

### Build Custom

| Proposed Name          | Description                                                        | Why existing components don't cover it                                 |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| GiftLinkEditor         | Container with header, link rows, footer; manages add/remove/reorder | Specific composed layout not covered by a single base component        |
| GiftLinkRow            | Single row: URL input + "Zobrazení:" label input + reorder + remove  | Stacked input pair with prefix label is domain-specific               |
| GiftLinkList           | View-mode stacked clickable links with primary accent stripe        | Read-only link list with primary/secondary distinction                |
| GiftEnrichButton       | Enrich bar: sparkle button + hint + loading/success/error states    | Stateful action with inline feedback, not a generic button            |

## Implementation Notes

- The label row is styled as a clickable link: arrow icon (`↗`) + underlined editable input text. Primary row inherits `--primary` color (green), secondary rows use `--foreground-muted` (gray). On hover the entire row shifts to `--primary`. The input text is underlined by default (via `text-decoration: underline`) and loses the underline on focus to signal editing mode. Clicking the input area enters edit mode; clicking outside (or a future external-link affordance) could navigate to the URL.
- Primary link = `links[0]` indicated by left accent stripe (3px `--primary`), no separate badge. Reordering changes primary.
- Enrich bar sits below the link editor as a distinct section, clearly subordinate to the Save button in the footer. Per-row sparkle icons provide quick access to per-link enrichment without requiring the main bar.
- Footer: `justify-content: flex-end` with `margin-right: auto` on the note text pushes buttons right. Icons on Save button (floppy disk) retained from Variant C.
- Overwrite confirmation uses Variant C's summary panel listing old→new values rather than Variant A's per-field inline confirms.
- Keyboard: reorder via up/down buttons (not drag-only); all controls meet 44x44px touch target minimum; `aria-busy` on enrich loading; `aria-invalid` on validation errors.
