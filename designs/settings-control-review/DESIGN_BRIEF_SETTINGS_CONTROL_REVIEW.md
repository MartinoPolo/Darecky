# Settings Control Review — Design Brief

> **Status**: Approved (refined Variant A). The user explicitly finalized the scoped controls and lifecycle; design phase complete for #348 and #349.
> **Refined mockup**: `designs/settings-control-review/refined.html`
> **Summary**: `designs/settings-control-review/SUMMARY.md`
> **Refinements**: Preserve accepted picker/palette behavior; explicitly separate review controls from surrounding context.

**Sources:** #348 and #349; `.mpx/DECISIONS.md` staged settings/global-save decision. Supplemental preview, no unresolved product question.

## 1. Purpose

Make color editing explicit and palette choices compact. Key value: users understand what is only a picker draft, what is accepted into settings, and what is saved.

## 2. Surrounding Context

**Approval boundary:** Review Categories → color picker and Appearance → compact palette choices. The user accepted the demonstrated draft/save/loading behavior. The existing staged lifecycle is preserved, not newly designed. Simplified tab navigation, modal composition, category enable toggles, app header, hero and background gifts are context only; their appearance must not be copied as an approved redesign. Show parent chrome at reduced opacity and explain this boundary in the prototype review panel.

Render full wishlist app viewport with a centered settings modal, dimmed backdrop and realistic underlying notebook hero/cards. On phones use a bounded responsive settings surface with pinned tabs and footer, scrolling body. Show actual tab order Details → Categories → Appearance → Image/Crops → Import/Export → Danger. Focus review on Categories and Appearance; other tabs may be clearly noninteractive context rather than fake functional workflows. Desktop 1440×900, phone 390×844 and 320px. Review-only reset/theme/failure controls sit outside app chrome.

## 3. Requirements

- Appearance palette options have constant compact content widths, centered as a responsive group, not stretched to modal columns. Preserve every palette and selected-state labels/swatches: Obloha, Máta, Broskev, Hrozen, Sakura, Oceán, Med, Malina, Matcha, Tužka. Selection only edits the parent settings draft.
- Categories show realistic enabled category rows with label and color trigger. Clicking opens compact ColorPicker with preset swatches, hex field, arbitrary/native color action, explicit „Zrušit“ and „Uložit“. Swatch and hex input edit only picker-local draft. Normalize casing for unchanged comparison. Invalid hex shows inline help and disabled Save.
- Picker Save is disabled when unchanged, enabled only for valid changes; returning to opening color disables it again. Save accepts into parent settings draft, not persistence. Cancel/Escape/outside discard picker changes. Reopen starts from accepted parent draft. Close returns focus to color trigger.
- Keep parent global „Uložit změny“ footer visible. Save persists all dirty settings only in demo memory, then closes only on complete success. Demo error retains draft and modal. Tab switches preserve edits. Any parent exit with dirty changes offers Save and continue, Discard, Continue editing; pending disables duplicate submission. Picker cancellation must not cancel the whole settings modal.
- Show explanatory context under the picker: „Barva se uloží až s nastavením seznamu.“ Do not claim live persistence. A clearly separated prototype status displays saved vs settings draft vs picker draft for verification, without leaking this debug UI into the app design.

## 4. States

| State                | Treatment                                                    | Trigger                       |
| -------------------- | ------------------------------------------------------------ | ----------------------------- |
| Settings unchanged   | Global Save disabled                                         | Open/reset                    |
| Palette selected     | Clear ink boundary and pressed state, compact label          | Palette click                 |
| Picker unchanged     | Local Save disabled                                          | Open                          |
| Picker dirty         | Preview draft, local Save enabled                            | Valid swatch/hex/native input |
| Picker invalid       | Inline error, Save disabled                                  | Invalid hex                   |
| Picker reverted      | Save disabled                                                | Restore opening color         |
| Picker cancelled     | Parent color unchanged                                       | Cancel/Escape/outside         |
| Settings dirty       | Global Save enabled, draft survives tabs                     | Accept color/palette          |
| Pending              | Disable repeated Save, announce progress                     | Global Save                   |
| Failure              | Safe inline/toast error, preserve all drafts                 | Failure fixture               |
| Exit guard           | Save/Discard/Continue editing                                | Dirty modal exit              |
| Focus/hover/disabled | Stable outline and adequate targets, distinct disabled state | Input/state                   |
| Loading/empty        | Skeleton/category-empty guidance                             | Documented specimen           |

## 5. Component Reuse Map

`blocks/wishlist/WishlistSettingsModal.svelte` and `WishlistSettingsSaveButton.svelte` own parent lifecycle; `WishlistCategorySettings.svelte` owns category drafts. `WishlistPalettePicker.svelte`: `value`, `onchange`, `disabled`; existing themes in `src/lib/theme/palettes.ts`. `derived/color-picker/ColorPicker.svelte`: `value`, `label`, `disabled`, `onValueChange`, base Popover, Input, and Button. Base Button uses `intent=primary|outline|ghost`, `size=md|lg`; do not introduce `variant` prop. Reuse base Dialog for modal/exit guard, existing tabs semantics. No new dependencies/primitives; change composition/draft UX only in prototype.

## 6. Layout Constraints

Palette choices approximately 120–140px wide, responsive wrap centered, no horizontal overflow. Picker around 256px wide but constrained by viewport; target choices usable on touch. Desktop settings dialog uses existing proportions and pinned full-width tab row, no stretched vertical tablet tabs. Parent tabs may scroll horizontally as already approved. Footer must not collide with picker actions or obscure final content. Test 320/390/768/1440 widths and enlarged text.

## 7. Design Tokens

Canonical `src/app.css` DynaPuff Variable headings, Geist Variable body; ink border, hard offset shadows, panel/button radii and semantic tokens. In `refined.html`, link `../tokens.css` then `../open-issue-review/assets/app.css` (orchestrator supplies compiled canonical CSS) so obsolete mockup fonts/control sizes cannot win. Component CSS only; palette values must match `src/lib/theme/palettes.ts` / canonical CSS. No unrelated custom wishlist-theme system.

## 8. Non-Negotiable Constraints

No production requests or real persistence. Picker Save must never bypass global Save. No implicit accept on dismissal. Existing curated palettes retained. Formal Czech and full accessible names, focus restoration, Escape handling and responsive safety. Distinguish native color dialog acceptance from picker Save. Do not install or change base primitives.

## 9. Design Freedom

Exact compact widths, gap rhythm, footer hierarchy, helpful draft explanation and balanced swatch arrangement. Existing lifecycle is fixed, not a choice to re-grill.

## 10. Visual References

Current source components above, `designs/redesign-2026/sky-final/anime-sky-final.html`, `.mpx/DECISIONS.md` staged settings. Reporter screenshots in Obsidian: Pasted image 20260905140742.png and 20260905141124.png.

## 11. Not Included

Production changes, global settings rewrite, category deletion semantics, database migrations, palette persistence repair or new palette choices. No new mandatory design/HITL gate for these already settled issues.
