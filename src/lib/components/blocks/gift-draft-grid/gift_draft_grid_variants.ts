import { tv } from 'tailwind-variants';
import { ROW_STATUS, type RowStatus } from '$lib/modules/gifts/draft_grid.js';

/**
 * Whole-card status tint for a draft row. Tints are mixed in **oklab** (not
 * oklch) so mixing a hued status color with the near-achromatic surface keeps
 * its hue instead of collapsing toward red. See `--status-dup` in `app.css`.
 */
export const draftRowStatusVariants = tv({
	base: '',
	variants: {
		status: {
			[ROW_STATUS.ready]:
				'border-[color-mix(in_oklab,var(--status-success)_55%,var(--border))] bg-[color-mix(in_oklab,var(--status-success)_16%,var(--surface))] hover:border-[color-mix(in_oklab,var(--status-success)_72%,var(--border))]',
			[ROW_STATUS.duplicate]:
				'border-[color-mix(in_oklab,var(--status-dup)_62%,var(--border))] bg-[color-mix(in_oklab,var(--status-dup)_20%,var(--surface))] hover:border-[color-mix(in_oklab,var(--status-dup)_80%,var(--border))]',
			[ROW_STATUS.error]:
				'border-[color-mix(in_oklab,var(--status-danger)_60%,var(--border))] bg-[color-mix(in_oklab,var(--status-danger)_15%,var(--surface))] hover:border-[color-mix(in_oklab,var(--status-danger)_78%,var(--border))]',
			[ROW_STATUS.neutral]: '',
		} satisfies Record<RowStatus, string>,
	},
	defaultVariants: { status: ROW_STATUS.neutral },
});

/**
 * Shared desktop column template – header and every row use the same track sizes.
 * The priority track (heart toggle) sits before the trailing enrich + remove
 * actions, which share one `auto` track so they sit tightly together; the link
 * column gets the extra room freed from a slimmer price track.
 */
export const DRAFT_GRID_COLUMNS =
	'md:grid md:grid-cols-[44px_1.5fr_1.15fr_1.7fr_112px_132px_96px_72px_56px_auto] md:items-start md:gap-3';

/** Column template without the priority track — used when priority is unavailable. */
export const DRAFT_GRID_COLUMNS_NO_PRIORITY =
	'md:grid md:grid-cols-[44px_1.5fr_1.15fr_1.7fr_112px_132px_96px_72px_auto] md:items-start md:gap-3';

/** Column / field-label typography – shared by the desktop header and mobile cell labels. */
export const DRAFT_COL_LABEL_CLASS =
	'text-xs font-bold tracking-wide text-muted-foreground uppercase';

/** Hover treatment for destructive icon buttons (remove row / remove link). */
export const DRAFT_DESTRUCTIVE_HOVER_CLASS =
	'group-hover:bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] group-hover:text-destructive';
