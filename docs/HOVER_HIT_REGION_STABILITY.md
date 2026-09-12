# Hover hit-region stability (issue #346)

## Observed baseline

The fault was reproduced with Chromium's real browser zoom at 100%, 125%, and 150%, at every supported depth (`soft`, `ink`, `black`). A pointer held at the lower hard-shadow edge produced more than 100 hover-state transitions in a 650 ms sample on affected controls. Slow bottom-to-top sweeps also found genuine unhovered bands between the shadow and face. Baseline metrics and representative screenshots are retained under `docs/evidence/issue-346/baseline/`.

## Invariant

A raised interaction has two explicit layers:

- `.elevation-owner` is the stationary native semantic element. It owns hover, focus, refs, attributes, state, and event handlers and is never transformed.
- Its direct `.elevation-surface` child owns border, background, shadow, and motion.
- `.elevation-owner-raised::after` is a static transparent hit strip contiguous with the owner's lower border box and covering the resting ordinary-shadow offset. It never transforms or animates.
- Complex cards use an empty, absolute, `aria-hidden` surface plate. Interactive descendants remain outside that moving plate.

Hover lifts only the surface by 2 px. Active feedback returns it to zero translation, scales it to 0.98, and uses the pressed shadow. Anchored-open triggers rest at zero translation. Disabled controls are inert. Reduced motion keeps the surface at rest. Like sticker surfaces additionally scale to 1.08.

Inverse transforms, counter-motion custom properties, JavaScript style synchronization, debounce, CSS zoom, and utility-string parsing are intentionally absent.

## Audit

The contract is applied to shared Button and raised Select triggers, Sort and Grouping, depth choices, Like sticker buttons, full-row gift links, dashboard wishlist cards/list rows, gift cards, dialog close, account menu trigger, and reorder grips. Flat form selects and ghost/link/chip presentations retain their existing flat treatment.

The focused Playwright suites verify stationary lower-edge reachability, event counts, frame samples, contiguous sweeps, nested controls, held press, activation, anchored-open behavior, and real browser zoom/depth matrices. The zoom suite uses isolated bundled Chromium contexts with the unpacked zoom extension; it does not substitute CSS zoom. Per-pixel traversal is sampled on animation frames after font/animation readiness. The separate elevation behavior tests observe the visual surface while asserting that the owner stays fixed, without pinning CSS timing or shadow recipes.

## Evidence

- Baseline: `docs/evidence/issue-346/baseline/metrics.json`
- Baseline screenshots: `docs/evidence/issue-346/baseline/*.png`
- Passing owner/surface run: `docs/evidence/issue-346/after/metrics.json`
- Passing representative screenshots: `docs/evidence/issue-346/after/*.png`

The after evidence was regenerated from the six-test green run using the same headed Chromium extension, DPR 2, 1602×1100 viewport, and real 100%/125%/150% browser zoom matrix. No Chromium profile or evidence from the rejected inverse-motion attempt is retained.
