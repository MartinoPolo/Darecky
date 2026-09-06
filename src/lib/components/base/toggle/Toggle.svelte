<script lang="ts">
	import { Toggle as TogglePrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { Button } from '../button/index.js';
	import {
		togglePressedVariants,
		TOGGLE_INTENT_TO_BUTTON_INTENT,
		type ToggleProps,
	} from './toggle_variants.js';

	let {
		class: className,
		surfaceClass,
		intent = 'default',
		size = 'md',
		ref = $bindable(null),
		children,
		...restProps
	}: ToggleProps = $props();
</script>

<TogglePrimitive.Root bind:ref class="group" {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			intent={TOGGLE_INTENT_TO_BUTTON_INTENT[intent]}
			{size}
			class={className}
			surfaceClass={cn(togglePressedVariants({ intent }), surfaceClass)}
			data-slot="toggle"
		>
			{@render children?.()}
		</Button>
	{/snippet}
</TogglePrimitive.Root>
