<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { Button } from '../button/index.js';
	import {
		togglePressedVariants,
		TOGGLE_INTENT_TO_BUTTON_INTENT,
	} from '../toggle/toggle_variants.js';
	import type { ToggleGroupItemProps } from './toggle_group_types.js';
	import { useToggleGroup } from './toggle_group.context.svelte.js';

	let {
		class: className,
		surfaceClass,
		intent,
		size,
		children,
		ref = $bindable(null),
		...restProps
	}: ToggleGroupItemProps = $props();

	const groupContext = useToggleGroup();

	const resolvedIntent = $derived(intent ?? groupContext.intent);
	const resolvedSize = $derived(size ?? groupContext.size);
</script>

<ToggleGroupPrimitive.Item bind:ref class="group" {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			intent={TOGGLE_INTENT_TO_BUTTON_INTENT[resolvedIntent]}
			size={resolvedSize}
			class={className}
			surfaceClass={cn(togglePressedVariants({ intent: resolvedIntent }), surfaceClass)}
			data-slot="toggle-group-item"
		>
			{@render children?.()}
		</Button>
	{/snippet}
</ToggleGroupPrimitive.Item>
