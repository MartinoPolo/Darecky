# Approved design handoff

Open `index.html` directly in a browser after checking out this branch. No development server, database, seed command or machine-specific image cache is required. Canonical compiled CSS, fonts and the referenced specimen photos are bundled under `assets/`.

## Authoritative artifacts

- `designs/settings-control-review/refined.html` — approved settings Variant A.
- `designs/wishlist-command-review/refined.html` — approved command Variant A, including duplicate-text cleanup.
- `designs/gift-geometry-review/refined.html` — approved gift Variant C.
- Each folder's brief and `SUMMARY.md` define approval scope and implementation handoff.
- `DESIGN_STATUS.md` and `issue-design-links.json` map the issue descriptions to these repository-relative files.

Historical variants and review notes preserve the decision trail, not additional approval gates. None of these HTML artifacts is production source or proof of production persistence.

## Verification

From the repository root, with its pnpm dependencies installed:

```bash
pnpm run typecheck
node designs/open-issue-review/verify-refinements.mjs
node designs/open-issue-review/verify-focused-gifts.mjs
node designs/open-issue-review/verify-previews.mjs
```

These browser checks use the project's installed Playwright directly; no MCP or server is involved. Standalone design JavaScript uses normal ESLint rules without the Svelte application's type-aware project configuration; it is not part of that TypeScript project. Production TypeScript/Svelte checks are unchanged. Screenshots and result JSON are reproducible outputs and are intentionally ignored. Before committing Svelte changes, use the project's `typecheck` script, which runs `svelte-check`.

Rebuild the bundled canonical stylesheet with `node designs/open-issue-review/build-styles.mjs`. The build preserves the vendored specimen photos. Its source is `src/app.css`, not the legacy design token reference.

For an optional portable copy, set `MPX_AI_GENERATED`, run `export-previews.mjs`, then `verify-export.mjs` from this folder's repository-root paths. The export destination pointer and GitHub before-edit snapshots are local artifacts, not repository content. Exports also preserve local screenshots when present.

`finalize-design-issues.mjs` is an audit/mutation helper, not a routine verification command. It requires explicit `--apply`; review its issue mapping before using it against GitHub. Completed mutations are recorded in `issue-design-links.json`.

## Publication

The design handoff is published on `design/open-issue-review` for a draft PR into `dev`. Issue bodies retain repository-relative paths and identify the published branch. Do not delete the remote PR branch until it is merged or deliberately abandoned. No implementation issue should auto-close from this design-only PR.
