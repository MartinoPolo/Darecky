import { tv } from 'tailwind-variants';

export const giftActionRowVariants = tv({
	slots: {
		row: 'grid min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-1.5',
		primary: 'flex min-w-0 flex-col gap-1.5',
		more: 'h-auto min-h-(--size-control-xl) w-(--size-control-xl) self-stretch',
	},
	variants: {
		withMore: {
			true: {
				row: 'grid-cols-[minmax(0,1fr)_var(--size-control-xl)]',
			},
			false: {},
		},
	},
	defaultVariants: {
		withMore: false,
	},
});
