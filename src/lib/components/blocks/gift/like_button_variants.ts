import { tv } from 'tailwind-variants';

/**
 * Anime-sky like control (issue #102 REQ-14 + round-2 delta): ghost ink chip
 * with the colored heart; hover tints it with the like blush and lifts it as one surface.
 * `md` matches the mockup card footer and the gift detail modal's action bar
 * (matches `ReserveButton`'s `md` there so the two stay height-aligned), `sm`
 * the compact rows. `ghost` is the borderless card/list chip; `sticker` is the
 * ink-bordered hard-shadow pill used in the detail modal's action bar.
 */
export const likeButtonVariants = tv({
	slots: {
		root: 'group/like inline-flex cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		surface:
			'elevation-surface inline-flex size-full items-center justify-center gap-1 rounded-[inherit] border-0 bg-transparent font-bold text-foreground shadow-none transition-[background-color,translate,scale] duration-(--duration-normal) ease-(--ease-standard) group-hover/like:bg-like-tint',
		icon: 'text-heart [filter:drop-shadow(0_1px_1px_var(--card))_drop-shadow(0_-1px_1px_var(--card))] transition-all duration-200',
		count: 'whitespace-nowrap tabular-nums [filter:drop-shadow(0_1px_1px_var(--card))_drop-shadow(0_-1px_1px_var(--card))]',
	},
	variants: {
		liked: {
			true: {
				icon: 'fill-heart',
			},
			false: {
				icon: 'fill-card',
			},
		},
		size: {
			sm: {
				surface: 'px-1.5 py-0.5 text-[13px]',
				icon: 'size-3.5',
				count: 'text-[12px]',
			},
			md: {
				root: 'min-h-10 min-w-10',
				surface: 'px-1 py-1 text-sm',
				icon: 'size-5',
				count: 'text-[13px]',
			},
			lg: {
				root: 'min-h-[52px] min-w-[52px]',
				surface: 'gap-2 px-4 text-base',
				icon: 'size-5',
				count: 'text-sm',
			},
		},
		appearance: {
			ghost: {},
			sticker: {
				root: 'elevation-owner elevation-owner-raised elevation-owner-like relative rounded-[7px]',
				surface: 'border-2 border-ink bg-card shadow-sticker',
			},
		},
	},
	defaultVariants: {
		liked: false,
		size: 'md',
		appearance: 'ghost',
	},
});

export type LikeButtonSize = keyof typeof likeButtonVariants.variants.size;
export type LikeButtonAppearance = keyof typeof likeButtonVariants.variants.appearance;
