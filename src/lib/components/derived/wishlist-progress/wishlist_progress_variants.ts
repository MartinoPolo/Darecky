import { tv } from 'tailwind-variants';

export const wishlistProgressVariants = tv({
	slots: {
		root: 'relative flex h-3.5 w-full items-center overflow-hidden rounded-full border-2 border-ink bg-surface',
		indicator:
			'size-full flex-1 rounded-full bg-gradient-to-r from-brand to-brand-deep transition-[transform] duration-slow ease-out',
	},
});
