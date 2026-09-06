# Open-issue design review

## Scope and status

Design-only review of the open GitHub backlog. No production code, data, migrations, or deployment changes are authorized by this review. Settings and command controls are approved and their scoped design phases are finalized; gift geometry Variant C is also approved and finalized. None is a verified production fix.

## Final gift approval

The user approved focused Variant C and requested finalization. `../gift-geometry-review/refined.html` and `SUMMARY.md` now provide the authoritative handoff; the accepted layout is unchanged. The labelled enlarged-text alternative and manager secondary-action case are included in this approval. See `DESIGN_STATUS.md` and the final issue-link audit for live issue-body references and label results. All design phases are complete; production bugs and implementation checks remain open.

Execution note: a long inline shell script hit the Windows command-length boundary and failed parsing before any mutation. The issue-update workflow was moved to `finalize-design-issues.mjs` and completed with body read-back checks. Suggested command rule: persist substantial multi-step scripts to a file instead of long shell heredocs on Windows; the mutation helper now requires explicit `--apply`.

The final issue-body audit also corrects an earlier mapping error: #355 is filter-checkbox spacing, #358 is bulk-sheet title/count/close alignment, and hero Settings belongs to #359. Their refined command path was correct, but the earlier scope descriptions were not. New issue descriptions and corrected approval records use the actual issue requirements.

## Previous finalization and focused gift preview (historical)

The user explicitly approved settings A and the refined command direction, then requested duplicate cleanup and finalization. Duplicate bulk selected-count/current/mixed summaries are corrected and regression-tested. See [DESIGN_STATUS.md](./DESIGN_STATUS.md) for requirement coverage and GitHub approval records. The approved issues already had no design-needed label, so no labels were removed; #350 retains `design needed` and `HITL`.

Focused gift Variant C is now available at `../gift-geometry-review/variants/variant-c.html`. Separate List, Grid and grip sections replace the old A/B comparison. See its notes for the ordinary density question, explicit 200% text stacking alternative and manager secondary-action placement. All remain provisional until reviewed. `verify-focused-gifts.mjs` checks the new specimen rather than reusing the old stress script.

Workflow note: the background audit completed but its result handle was unavailable. Its saved JSONL output contained the final report. Suggested recovery rule: extract only the final assistant text from a saved agent transcript, rather than dumping a raw tail that can include opaque metadata.

## Previous refinement review (historical)

- Settings Variant A is refined and accepted for picker Save/Cancel, compact palette choices and the demonstrated staged lifecycle. Simplified tabs, modal layout and surrounding app styling are context only. Artifacts: `../settings-control-review/refined.html`, `SUMMARY.md` and the updated brief.
- Command Variant A is refined with persistent desktop roots and side-opening submenus, icon-only More/Settings, matching select-all geometry, and top-left compact grips with larger hit areas. The mobile sheet flow, hero positions and gift selection geometry are retained. The corrected desktop preview was subsequently approved in the finalization pass above. Artifacts: `../wishlist-command-review/refined.html`, `SUMMARY.md` and the updated brief.
- Historical gift A/B are not approval candidates. They differ only in mobile List browse actions and contain rejected image/control geometry. The next review should use isolated specimens. See `../gift-geometry-review/REVIEW_FEEDBACK.md` and the updated brief; no gift `refined.html` or summary was produced.
- Human choices: compact drag visual inside a larger actionable area; full-height square List image with description clamped first, then title. Keep price, quantity, store-link entry and eligible actions available. Grid Like overlays the image without reducing it. Handles remain top-left.
- Clarified #362 REQ-2 directly: the earlier right/bottom wording describes inset within the top-left corner, not relocation. Source baseline differs by breakpoint: desktop 20px, mobile 40px; command prototype targets are 32px and 60px respectively, with smaller visible children.
- GitHub refinement records: [settings #348](https://github.com/MartinoPolo/prejemesi/issues/348#issuecomment-5554152186), [palettes #349](https://github.com/MartinoPolo/prejemesi/issues/349#issuecomment-5554152291), [commands #359](https://github.com/MartinoPolo/prejemesi/issues/359#issuecomment-5554152379), [bulk #353](https://github.com/MartinoPolo/prejemesi/issues/353#issuecomment-5554152502), [grip #362](https://github.com/MartinoPolo/prejemesi/issues/362#issuecomment-5554152765), [still-blocked gift #350](https://github.com/MartinoPolo/prejemesi/issues/350#issuecomment-5554152878). No design labels were removed and no issues were closed.

## Refinement verification

`node designs/open-issue-review/verify-refinements.mjs` passes at 320/390/768/1440px: picker invalid/dirty/cancel/accept, parent draft boundary, failure retention and successful save; desktop cascading menus and selected filter refresh; keyboard submenu/root focus return; mobile Display/bulk hierarchy; mixed selection and top-left grip/toolbar containment. Screenshots and `refinement-results.json` record evidence. Visual inspection caught a reorder toolbar overflow that the prior page-only check missed; the refined toolbar now keeps only its relevant view/Done controls and the script checks containment inside the toolbar itself.

`export-previews.mjs` exports the review under `$MPX_AI_GENERATED/prejemesi/`; `export-location.json` points to the latest package. `verify-export.mjs` confirms local index links and page resources/images load from that portable package. Historical gift pages are checked for loading only, not design validity. The replacement has its own `verify-focused-gifts.mjs` enlarged-text checks. The old stress script is not approval evidence, and the new stacking alternative remains subject to human review.

No source or Svelte files changed, so no production typecheck was required and no commit was attempted. `pnpm.cmd` is absent in this session; the discovered `pnpm`/`pnpm.exe` works. Suggested portable command rule: prefer `pnpm.cmd` when available, otherwise resolve the installed pnpm executable. Mockups are ignored by `.prettierignore`; explicit refinement formatting used `pnpm exec prettier --ignore-path .gitignore --write` on the owned files only.

## Initial triage (historical)

All open issue bodies and comments were reviewed. Initial triage found AFK labels rather than design/HITL gates. Issue #350 explicitly requires a design preview; no other issue contained an unanswered product decision. Its geometry received an A/B human approval gate initially; the latest review above supersedes that comparison with a focused replacement-preview requirement. On GitHub, #350 now carries `design needed` and `HITL`, with `AFK` removed; the latest review also records refinements and clarifies #362 without changing other issue labels. Review comment: https://github.com/MartinoPolo/prejemesi/issues/350#issuecomment-5553250439.

## Issue inventory

| Issue                                                       | Disposition                         | Evidence / next step                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [#346](https://github.com/MartinoPolo/prejemesi/issues/346) | Implementation/reproduction         | Stable pointer hit region; test hover boundaries and zoom, not a mockup choice.                                       |
| [#347](https://github.com/MartinoPolo/prejemesi/issues/347) | Implementation/reproduction         | Authoritative order on each reorder session; static design cannot verify persistence.                                 |
| [#348](https://github.com/MartinoPolo/prejemesi/issues/348) | Supplemental settings preview       | Picker-local draft and explicit Save/Cancel are settled.                                                              |
| [#349](https://github.com/MartinoPolo/prejemesi/issues/349) | Supplemental settings preview       | Compact centered palette group already specified.                                                                     |
| [#350](https://github.com/MartinoPolo/prejemesi/issues/350) | Design + human approval gate        | Explicit preview requirement; compare mobile List action placement.                                                   |
| [#351](https://github.com/MartinoPolo/prejemesi/issues/351) | Implementation/audit                | Audit actual copy sources, preserve user-authored labels; no assumed screenshot defect.                               |
| [#352](https://github.com/MartinoPolo/prejemesi/issues/352) | Implementation/reproduction         | Verify all bulk mutations and persisted results, separate from command-surface design.                                |
| [#353](https://github.com/MartinoPolo/prejemesi/issues/353) | Supplemental command preview        | One desktop Actions menu and mobile in-sheet hierarchy are settled.                                                   |
| [#354](https://github.com/MartinoPolo/prejemesi/issues/354) | Coordinated gift preview            | Continuous selection perimeter, distinct keyboard focus.                                                              |
| [#355](https://github.com/MartinoPolo/prejemesi/issues/355) | Supplemental command preview        | Compact filter rows without reducing accessible targets.                                                              |
| [#356](https://github.com/MartinoPolo/prejemesi/issues/356) | Coordinated gift preview            | Red high / green low textual badges outside priority grouping.                                                        |
| [#357](https://github.com/MartinoPolo/prejemesi/issues/357) | Coordinated gift preview            | Ghost heart with count BESIDE is already approved; do not reopen inside-heart option.                                 |
| [#358](https://github.com/MartinoPolo/prejemesi/issues/358) | Supplemental command preview        | Title/count left, close right, balanced header clearance.                                                             |
| [#359](https://github.com/MartinoPolo/prejemesi/issues/359) | Supplemental command preview        | Display beside layout, Settings in hero; latest comment preserves PR #366 mask.                                       |
| [#360](https://github.com/MartinoPolo/prejemesi/issues/360) | Coordinated gift preview            | Desktop List becomes bordered cards, retains horizontal layout/content.                                               |
| [#361](https://github.com/MartinoPolo/prejemesi/issues/361) | Contextual command preview          | Enabled Grid/List during reorder is settled; real draft preservation still needs tests.                               |
| [#362](https://github.com/MartinoPolo/prejemesi/issues/362) | Coordinated gift preview            | Larger handles, researched nested geometry; auto-loaded rule and actual drag verification remain implementation work. |
| [#363](https://github.com/MartinoPolo/prejemesi/issues/363) | Implementation with preview context | Priority default only without saved preference, all roles, no forced reset.                                           |
| [#364](https://github.com/MartinoPolo/prejemesi/issues/364) | Implementation/reproduction         | Positioning oscillation is distinct from hover flicker; static screenshot cannot prove repair.                        |
| [#365](https://github.com/MartinoPolo/prejemesi/issues/365) | Settled small styling change        | Straighten notices only; latest comment excludes the accepted mask/background/fade.                                   |

## Design deliverables

- `../gift-geometry-review/DESIGN_BRIEF_GIFT_GEOMETRY_REVIEW.md`: A full-width mobile List footer versus B beside-thumbnail actions.
- `../wishlist-command-review/DESIGN_BRIEF_WISHLIST_COMMAND_REVIEW.md`: approved command hierarchy illustrated interactively.
- `../settings-control-review/DESIGN_BRIEF_SETTINGS_CONTROL_REVIEW.md`: compact palettes and explicitly staged picker interaction.
- `index.html`: local review entry point, added when previews are ready.

## Research and workflow notes

Nested geometry source: [W3C CSS Backgrounds § Corner Shaping](https://www.w3.org/TR/css-backgrounds-3/#corner-shaping) explicitly defines the padding-edge radius as outer radius minus corresponding border thickness. [Cloud Four: The Math Behind Nesting Rounded Corners](https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/) gives the equation `outerRadius - gap = innerRadius` and the nested-container visual application. Its full article was fetched; CSS-Tricks blocked fetching, so it was not used as the evidentiary source. The brief accounts for border thickness and physical inset; a shared radius everywhere is not claimed to be correct.

`designs/tokens.css` still contains pre-redesign reference fonts/sizes. Mockups retain its required stylesheet link but load a generated stylesheet built from canonical `src/app.css` afterward. Existing reference files are not rewritten.

No assigned `.worktree-ports.json` was created by this repository's worktree setup. Browser verification uses `file:///` and raw Playwright, not a server or guessed port. The background-agent result registry lost completed agent IDs; completed research was recovered from its recorded output files. Suggested harness rule: retain completed background-agent results until explicitly collected, and expose a durable summary path. No harness configuration was changed.

## Initial user decisions (superseded where noted above)

- Review related design groups: coordinated gift cards/actions, toolbar and bulk command surfaces, and picker/settings controls where useful. Pure behavioral regressions remain implementation work.
- Compare both narrow List layouts: full-width footer below the image/content, and actions beside the thumbnail. Neither layout is approved yet.
- Prefer shorter visible action wording, with complete accessible action names. Do not shorten cancellation to an ambiguous generic action.

## Non-negotiable constraints

- Preserve recipient surprise protection: no reservation state, Like counts, or reserver identities in recipient surfaces.
- Reserver identities are manager-only, never visible to ordinary visitors.
- Preserve current capabilities and post-share restrictions.
- Reuse the canonical Anime Sky design language and current component sizes from `src/app.css`, not the older fonts/control dimensions in `designs/tokens.css`.
- Keep Czech diacritics and formal address. Short labels are proposed copy, not silently accepted changes to domain behavior.
- Separate design approval from behavioral verification. Static interaction demos do not prove mutations, persistence, drag behavior, or production accessibility.
