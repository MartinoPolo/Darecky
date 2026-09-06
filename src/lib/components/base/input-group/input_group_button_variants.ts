import { tv } from 'tailwind-variants';

export const inputGroupButtonVariants = tv({
	slots: {
		owner: 'inline-flex items-center text-sm',
		surface: 'flex items-center shadow-none',
	},
	variants: {
		size: {
			xs: {
				owner: 'h-6 rounded-[calc(var(--radius)-5px)]',
				surface: "gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
			},
			sm: {
				owner: 'h-(--size-control-sm)',
				surface: 'gap-1.5 px-2 text-(length:--text-sm)',
			},
			'icon-xs': {
				owner: 'size-6 rounded-[calc(var(--radius)-5px)]',
				surface: 'p-0 has-[>svg]:p-0',
			},
			'icon-sm': {
				owner: 'size-8',
				surface: 'p-0 has-[>svg]:p-0',
			},
		},
	},
	defaultVariants: {
		size: 'xs',
	},
});

export type InputGroupButtonSize = keyof typeof inputGroupButtonVariants.variants.size;
