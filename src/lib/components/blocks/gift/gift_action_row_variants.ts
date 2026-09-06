import { tv } from 'tailwind-variants';

export const giftActionRowVariants = tv({
	slots: {
		row: 'gift-action-row grid min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-1.5',
		primary: 'gift-action-slot flex min-w-0 flex-col gap-1.5',
		secondary: 'gift-action-slot col-span-full row-start-1 flex min-w-0 flex-col gap-1.5',
		more: 'h-auto min-h-(--gift-action-control-size) w-(--gift-action-control-size) self-stretch',
	},
	variants: {
		withMore: {
			true: {
				row: 'grid-cols-[minmax(0,1fr)_var(--gift-action-control-size)]',
			},
			false: {},
		},
		withSecondary: {
			true: {
				primary: 'row-start-2 sm:col-start-2 sm:row-start-1',
				secondary: 'sm:col-span-1 sm:col-start-1 sm:row-start-1',
				more: 'row-start-2 sm:row-start-1',
			},
			false: {},
		},
	},
	compoundVariants: [
		{
			withMore: true,
			withSecondary: true,
			class: {
				row: 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--gift-action-control-size)]',
			},
		},
		{
			withMore: false,
			withSecondary: true,
			class: { row: 'sm:grid-cols-2' },
		},
	],
	defaultVariants: {
		withMore: false,
		withSecondary: false,
	},
});
