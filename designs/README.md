# Design references

Read `.mpx/DECISIONS.md` and the relevant component APIs, variants, and stories before using a design. `src/app.css` is the canonical token source. `tokens.css` is a legacy reference, not the stylesheet for new designs.

Mockups and briefs capture scoped design reviews, not the current whole-app specification. “Refined,” “approved,” “pending,” and issue-status tables describe the review snapshot, not today's implementation status. Missing output files do not establish a backlog item. Confirm the requested scope and current issue before resuming work.

## Reference boundaries

- `redesign-2026/sky-final/` establishes the Anime Sky visual identity. Later decisions govern privacy, controls, crops, motion, and layout; do not copy its old reserver-name or action-placement behavior.
- `app-shell/`, `auth-pages/`, `dashboard/`, `landing-page/`, `sharing-flow/`, and `wishlist-page/` retain historical structural references. Their pre-redesign styling and product copy are not current requirements: login has no magic links, the logged-in home is `/home`, sharing permits the settled per-field edits, and recipient/správce capabilities replace the old owner model.
- Earlier gift-card, detail, and crop studies do not override the current two-target crop contract, natural-photo detail, role-gated actions, or shared control geometry.
- `settings-control-review/`, `wishlist-command-review/`, `gift-geometry-review/`, and `open-issue-review/` retain scoped review artifacts and interdependent preview tooling. Treat their approval/status records as snapshots; current decisions govern global settings Save, Display/hero Settings placement, and shared mobile sheets.
- Proposals within creation or motion studies require their own approval; approval of one aspect does not approve every alternative in the folder.

Clearly superseded palette/background, toolbar, image-mode, and rejected visual explorations live under `archive/designs/`. Exclude `archive/` from routine discovery and implementation context; consult it only for explicitly requested historical research.
