import { tv } from 'tailwind-variants';

export const wishlistBadgeVariants = tv({
	base: 'h-auto tracking-normal',
	variants: {
		presentation: {
			'card-status':
				'gap-1 rounded-full border-2 border-ink px-3 py-0.5 text-[12.5px] font-semibold leading-normal',
			'card-metadata':
				'gap-1 rounded-full border-2 border-ink bg-surface px-3 py-0.5 text-[13px] font-semibold leading-normal text-foreground',
			'reservation-count':
				'gap-1 rounded-full border-2 border-ink bg-primary px-2.5 py-0.5 text-[11px] font-bold leading-normal text-primary-foreground',
			'list-status':
				'gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-semibold leading-normal',
		},
		status: {
			draft: 'bg-card text-foreground',
			active: 'bg-primary text-primary-foreground',
			archived: 'bg-card text-muted-foreground',
			none: '',
		},
	},
	defaultVariants: {
		presentation: 'card-metadata',
		status: 'none',
	},
});

export type WishlistBadgePresentation = keyof typeof wishlistBadgeVariants.variants.presentation;
export type WishlistBadgeStatus = keyof typeof wishlistBadgeVariants.variants.status;
