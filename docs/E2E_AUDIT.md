# E2E reliability audit

**Final result: 185/185 E2E tests passed without retries in 11.4 minutes; `check:all` passed.**

Baseline: merged PR [#372](https://github.com/MartinoPolo/prejemesi/pull/372), commit `2115834`. Findings were checked against the current decision revisions, source, existing component coverage, and narrow local measurements. The full suite was deliberately deferred until cleanup was complete. This is an audit snapshot, not a standing test-count or runtime budget.

## Findings and changes

### Runtime and isolation

- **An explicit `DATABASE_URL` did not isolate the application.** The Cloudflare adapter's local Hyperdrive binding won over it. A baseline run intended for the audit database instead wrote synthetic accounts to the shared local database; no production database was used. The harness now forwards the selected loopback connection to both environment variables. A subsequent narrow run was verified to create its users in the isolated database.
- **Every narrow invocation paid startup and route warmup.** The original local command also invoked `predev` (Docker and seed-image preparation). E2E now uses `dev:agent`. An explicit, documented external-server mode permits controlled warm-server iteration; normal runs still refuse implicit server reuse.
- **Repeated local runs accumulate data.** The shared local database observed during discovery contained substantial prior E2E data. This audit used separately migrated and seeded disposable databases. Automatic run-scoped database creation/cleanup is not implemented; ordinary test-created accounts and lists still accumulate in whichever local database the caller selects.
- **Timestamp-only emails could collide.** Test identities now use UUIDs.
- **Passing retries lost useful CI evidence.** Local retries now default to zero. CI retains its retry, but JSON results and diagnostic artifacts are uploaded for successful runs too, including recovered failures. The result file records durations and individual attempts rather than just a final green/red status.

### Brittle or redundant coverage removed

| Area                                                      | Change                                                                                                                                     | Coverage retained                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `button-hover.spec.ts`, `responsive-shadow-depth.spec.ts` | Deleted overlapping CSS shadow/offset/transition probes                                                                                    | Full real-browser-zoom hover matrix; focused elevation behavior below                                                             |
| `elevation-motion.spec.ts`                                | Replaced CSS-property, easing, duration, scale and shadow recipes with bounded behavior checks                                             | Visible hover/press feedback, stationary owner, held-press hit testing, native activation, anchored menu, reduced-motion surfaces |
| `header-control-spacing.spec.ts`                          | Removed exact gap values, shadow parsing, and repeated hover matrices                                                                      | Narrow-screen essential actions, accessible target size and viewport containment                                                  |
| `home-overview.spec.ts`                                   | Removed exact equal-card-height and synthetic Embla wheel/transform assertions; replaced the timed drag recipe with Next/Previous behavior | Overview navigation, role rows, recency, onboarding, overflow navigation; wheel translation remains component-tested              |
| `wishlist-settings.spec.ts`                               | Removed fixed five-column color-preset grid test                                                                                           | Settings draft lifecycle, responsive pinned tabs/footer, numeric input behavior                                                   |
| `color-picker-draft.spec.ts`                              | Removed unrelated repeated screenshot/viewport loop                                                                                        | Cancel/Escape/outside dismissal, local acceptance, global Save and cross-page persistence                                         |
| `gift-creation.spec.ts`                                   | Removed the “rapid creations” test, which actually serialized the same flow already covered                                                | Multiple creations without reload, minimal/details/link/upload workflows                                                          |
| Wishlist view tests                                       | Removed Compact-absence requirements and hidden-localStorage action test                                                                   | Card/List switching, persistence, actions and selection; Compact decision mismatch remains below                                  |
| Gift footer and toolbar mask                              | Replaced incidental radius, inset, z-index and fade-size constants with relationships                                                      | Nested-radius formula, balanced insets, mask layering/fade, click interception and usable content                                 |
| Landing polaroids                                         | Removed exact pane-top equality                                                                                                            | Correct content, responsive visibility and no horizontal overflow                                                                 |

### False positives and synchronization repaired

- Anonymous reservation and recipient-privacy setup now require successful dialog closure and the actual cancellation control. Recipient privacy also reloads the visitor first to prove the reservation persisted. Previously, broad “reserved/reserve” text could match the still-open submit dialog.
- The manager-for-someone test now actually reserves rather than merely checking that a button exists.
- Gift creation with details now reloads/reopens and verifies the supplied description, link and price. Upload readiness uses the decoded preview rather than a particular proxy endpoint/status.
- Landing-demo likes now click once, await the relevant acknowledgement, and verify this browser's persisted state. They no longer retry a non-idempotent toggle or assume nobody else changes the shared global count.
- The stale grouping test now opens Display → Grouping and checks the real unavailable priority choice and selected ungrouped state. It previously checked the absence of an obsolete checkbox in the wrong submenu.
- Dialog geometry waits for fonts and entry-animation completion. Narrow runs exposed measurements moving during the opening animation; tolerances were not increased to hide this.
- The natural-image test now verifies the fixture's actual aspect using untransformed image dimensions. The old loose assertion admitted distortion; an initial stricter bounding-box measurement incorrectly included the intentionally tilted sticker.
- The mobile image test now measures preview tiles relative to the crop stage, not merely the image-column top. Its obsolete claim that Delete must scroll away was removed: the decision specifies a pinned footer, not the footer's CSS positioning mechanism or a Save-only footer.
- The create-modal height test no longer silently skips an optional Import control while claiming to test it. It asserts only the controls present in the chosen entry point. Preset-category coverage no longer pins the growing catalog size.
- Shared dialog opening waits for hydration and clicks once instead of retrying the interaction.

### Slow hover sampling improved without reducing the matrix

`hover-stability.helpers.ts` retains every zoom/depth combination, every per-pixel sweep position, and the stationary observation window. Fixed pre-sample sleeps became animation/font readiness; traversal now samples on animation frames rather than adding a timeout and another round trip at every pixel.

| Warm-server measurement                                   |  Before |   After |
| --------------------------------------------------------- | ------: | ------: |
| Entire hover spec, same scenarios, one worker, no retries | 174.0 s | 135.8 s |
| Bottom-to-top traversal test                              |  70.1 s |  52.2 s |
| Stationary zoom/depth matrix                              |  33.0 s |  27.1 s |

These are individual local measurements, not a statistical benchmark or a promised CI speedup. The same-spec wall-time reduction was approximately 22%.

## What the previous audit achieved

The earlier `1a5c5cf` audit split large suites, added meaningful privacy/geometry/interaction coverage, and replaced many `networkidle` waits. `a5afd6f` repaired typing and unused-fixture fallout. Follow-up commits merged in #372 fixed hydration, deferred focus, setup duplication, geometry sampling, and the stale landing performance budget.

Historical #372 CI runs still showed hydration/navigation/menu/geometry and fixture failures during that work. Those logs establish failures, not a measured flake rate for the final merged revision. The merged landing-budget correction and setup exclusion were retained, not counted as fixes made by this audit.

The previous audit's ignored `.test-audit/` artifacts provided additional evidence:

- `e2e-full-390d0dd.log`: **197 passed, one hover failure, 12.4 minutes**, using two workers.
- `e2e-full-d66ed92.log`: recorded a hidden-selection failure and stopped without terminal totals. It is not evidence of a completed successful run.
- `reports/e2e-shutdown-hang.md`: documented a Chrome temporary-profile-cleanup hang after tests finished; the controlled bundled-Chromium comparison exited normally. The present final run also exited normally, so this audit did not change the shared browser channel to address an unreproduced teardown condition.
- `EXECUTION.md` and `e2e-ci-repair-status.md`: confirm the intended narrow-first, no-masked-retries, privacy/geometry-preserving approach.

The historical 12.4-minute result is context, not a controlled speed benchmark against today's different test set and database.

The main remaining problem was **coverage expansion without consistent ownership**: some tests protected user contracts, while others duplicated component mechanics or pinned the current CSS implementation. This pass reduces the latter without removing explicit product safeguards.

## Deliberately preserved

- Recipient and reserver-name privacy, role authorization, archive and reservation workflows.
- The documented control scale and accessible target minimums. These numbers are requirements, not arbitrary CSS snapshots.
- Square **and full-height** list-image geometry; image crop/WYSIWYG consumers; relational nested corners and balanced visible-surface insets.
- Shared mobile-sheet interaction, mask, focus, scroll and acceptance evidence. Screenshots required by the sheet contract were not indiscriminately deleted.
- Real browser zoom/depth hover coverage. It remains relatively expensive because it reproduces a genuine hit-region regression.
- Request-amplification and JavaScript-load budgets explicitly documented as performance contracts. Their measurement windows are intentional, unlike sleeps used to guess interaction readiness.
- The bulk-action shared-list integration scenario. Its measured 29.6 s combines mixed state, multiple mutations, reload and copy persistence; it is long but meaningful, so it was not deleted merely for being slow.

## Verification

The final full run used the normal managed-server configuration, a **freshly migrated and seeded local database**, two workers, and `--retries=0`: **185 passed, zero failed, zero skipped, 683.5 seconds wall time**. The command exited successfully; application writes were independently confirmed in the selected isolated database. The run intentionally supplied only `DATABASE_URL`, proving the harness forwarded the Hyperdrive override.

The [sanitized per-test timing inventory](evidence/e2e-audit/final-results.json) records every test and attempt without configuration secrets, cookies, or traces.

Slowest retained scenarios in that run:

| Scenario                                               | Duration |
| ------------------------------------------------------ | -------: |
| Hover pixel-by-pixel traversal                         |   57.1 s |
| Stationary hover zoom/depth matrix                     |   30.8 s |
| Bulk shared-list mutation/mixed-state/copy journey     |   27.5 s |
| Moderator/reserver/visitor overlay and receipt journey |   24.1 s |
| Focused gift hover consumers                           |   23.1 s |
| Route warmup                                           |   21.8 s |

Before that final run:

- Narrow changed workflow batch: **20 passed**, no retries.
- Remaining settings/navigation/action batch: **39 passed**, no retries.
- Canonical hover suite: **5 passed** before and after sampling changes.
- Reservation, likes, modal and elevation risk checks: **21 passed** across repeated executions, no retries.
- A further **nine elevation executions** passed after review restored an explicit visible hover/press-feedback assertion.
- Environment-helper tests, scoped lint and Svelte typechecking passed.
- Full `pnpm check:all` passed. Its first attempt exposed ignored local diagnostic scripts being picked up by ESLint; narrowly excluding the generated audit directories repaired that tooling blocker without excluding application or test source.

The initial suite listed **198 tests in 57 files**; after cleanup it lists **185 tests in 55 files**, including setup. Counts describe the audit snapshot only.

## Remaining risks and follow-up ownership

1. **Compact is a product/decision discrepancy.** `DECISIONS.md` still describes three visible modes, while `GiftViewSwitcher` exposes Card/List and treats Compact as legacy. This audit removed tests that entrenched its absence; it did not silently rewrite the product decision or restore a product feature.
2. **Database lifecycle remains caller-owned.** Use a disposable database and the documented preparation procedure. UUIDs prevent identity collisions but do not clean up old data or isolate all seeded-persona mutations. The audit-created local databases `prejemesi_e2e_audit` and `prejemesi_e2e_audit_final` remain: the execution safety guard blocked their cleanup. No attempt was made to bypass that guard or remove unrelated database rows.
3. **Some specialized suites are still broad or implementation-coupled.** Bulk-action mutation matrices, motion-keyframe probes, crop-editor workflows, and shared-sheet parity deserve separate coverage-ownership work rather than blind deletion. Sheet acceptance is distributed across several specs, not a single auditable inventory of every role/state entry point.
4. **No general flake-rate claim.** Narrow repetitions and one final full run cannot prove the suite is flake-free. Retained CI JSON/retry artifacts provide a basis for tracking this over subsequent runs.
5. **The landing aggregate counter needs isolated service-level ownership** if exact aggregate deltas are to be regression-tested. Shared concurrent E2E is not a sound place for an isolated `before + 1` expectation.

Raw local audit reports and measurements are under `.mpx/logs/e2e-audit/` (ignored). Normal execution guidance and test-authoring rules are in [TESTING.md](TESTING.md).
