import type { Toggle as TogglePrimitive } from 'bits-ui';
import type { WithoutChildrenOrChild } from '$lib/utils.js';
import type { Snippet } from 'svelte';
import { BUTTON_SIZES, type ButtonIntent, type ButtonSize } from '../button/button_variants.js';
import { tv } from 'tailwind-variants';

export const togglePressedVariants = tv({
	variants: {
		intent: {
			default:
				'group-data-[state=on]:bg-accent group-data-[state=on]:text-foreground group-data-[state=on]:border-ink',
			outline:
				'group-data-[state=on]:bg-primary group-data-[state=on]:text-primary-foreground group-data-[state=on]:border-ink',
		},
	},
	defaultVariants: {
		intent: 'default',
	},
});

export type ToggleIntent = keyof typeof togglePressedVariants.variants.intent;
export type ToggleSize = ButtonSize;

export const TOGGLE_INTENT_TO_BUTTON_INTENT = {
	default: 'ghost',
	outline: 'secondary',
} as const satisfies Record<ToggleIntent, ButtonIntent>;

export const TOGGLE_INTENTS = Object.keys(togglePressedVariants.variants.intent) as ToggleIntent[];
export const TOGGLE_SIZES = [...BUTTON_SIZES] as ToggleSize[];

export type ToggleProps = WithoutChildrenOrChild<TogglePrimitive.RootProps> & {
	intent?: ToggleIntent;
	size?: ToggleSize;
	surfaceClass?: string;
	children?: Snippet;
};
