import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker wishlist card (issue #102 REQ-16, `anime-dashboard.html`):
 * ink border, hard offset shadow, coherent lift, banner with the title on a small
 * rotated label sticker and the status chip pinned top-right. Archived cards dim,
 * desaturate, and stop lifting.
 */
export const wishlistCardVariants = tv({
	slots: {
		root: 'group/card relative isolate flex h-full cursor-pointer flex-col rounded-panel bg-card',
		plate: 'elevation-ordinary pointer-events-none absolute inset-0 z-[1] rounded-panel border-[2.5px] border-ink bg-transparent transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard)',
		banner: 'relative flex h-32 shrink-0 flex-col items-start justify-end overflow-hidden rounded-t-[calc(var(--radius-panel)-2.5px)] border-b-[2.5px] border-ink p-3.5',
		/** Notebook dot pattern over the tint fallback (hidden when a real photo fills the banner). */
		bannerPattern:
			'pointer-events-none absolute inset-0 bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px]',
		bannerTitle:
			'relative z-[1] max-w-full -rotate-1 truncate rounded-[10px] border-2 border-ink bg-card px-3 py-1 font-heading text-[17px] font-semibold text-foreground shadow-sticker-sm',
		statusBadge: 'absolute top-3 right-3 z-[1]',
		body: 'flex flex-1 flex-col gap-2.5 px-4 pt-3.5 pb-4',
		metaRow: 'flex flex-wrap items-center gap-1.5',
		metaText: 'truncate text-[13px] text-muted-foreground',
		ownerRow: 'flex items-center gap-2 text-sm text-muted-foreground',
		progressWrap: 'flex flex-col gap-1.5',
		progressLabelRow:
			'flex items-center justify-between text-[13px] font-bold text-muted-foreground',
		progressValue: 'font-extrabold text-primary',
		availableCount: 'text-[13px] font-semibold text-muted-foreground',
		divider: 'my-0.5',
		actions: 'flex flex-wrap items-center gap-1.5',
		actionsEnd: 'ml-auto flex items-center gap-1.5',
	},
	variants: {
		archived: {
			true: {
				root: 'opacity-70 grayscale-[0.7] bg-[color-mix(in_oklab,var(--card)_82%,var(--surface))]',
			},
			false: { root: 'elevation-owner elevation-owner-raised' },
		},
	},
	defaultVariants: {
		archived: false,
	},
});
