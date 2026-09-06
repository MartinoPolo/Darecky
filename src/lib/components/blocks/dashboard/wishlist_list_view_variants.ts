import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker rows (issue #102 REQ-16, `anime-dashboard.html` list view):
 * each row is its own coherently lifting sticker with a tilted emoji tile; archived rows dim and
 * stop lifting.
 */
export const wishlistListViewVariants = tv({
	slots: {
		root: 'stagger-pop flex flex-col gap-3.5',
		row: 'group/row relative isolate flex items-center gap-3.5 rounded-panel px-4 py-3',
		plate: '-z-[1] rounded-panel border-[2.5px] border-ink bg-card transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard)',
		bannerMini:
			'relative flex size-11 shrink-0 -rotate-3 items-center justify-center overflow-hidden rounded-[10px] border-2 border-ink',
		info: 'flex min-w-0 flex-1 flex-col gap-0.5',
		title: 'truncate font-heading text-[16px] font-semibold text-foreground',
		subtitle: 'truncate text-xs text-muted-foreground',
		trailing: 'flex shrink-0 items-center gap-3',
		statusBadge:
			'inline-flex items-center whitespace-nowrap rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-semibold',
		giftCount: 'whitespace-nowrap text-[13px] font-bold text-muted-foreground',
	},
	variants: {
		archived: {
			true: {
				row: 'opacity-70 grayscale-[0.7]',
			},
			false: {
				row: 'elevation-owner elevation-owner-raised',
			},
		},
	},
});
