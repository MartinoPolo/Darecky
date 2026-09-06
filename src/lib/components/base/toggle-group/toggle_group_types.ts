import type { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
import type { WithoutChildrenOrChild } from '$lib/utils.js';
import type { Snippet } from 'svelte';
import type { ToggleIntent, ToggleSize } from '../toggle/toggle_variants.js';

export type ToggleGroupProps = ToggleGroupPrimitive.RootProps & {
	intent?: ToggleIntent;
	size?: ToggleSize;
};

export type ToggleGroupItemProps = WithoutChildrenOrChild<ToggleGroupPrimitive.ItemProps> & {
	intent?: ToggleIntent;
	size?: ToggleSize;
	surfaceClass?: string;
	children?: Snippet;
};
