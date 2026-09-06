<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { Button, type ButtonIntent } from '$lib/components/base/button/index.js';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		intent = 'ghost',
		...restProps
	}: RangeCalendarPrimitive.PrevButtonProps & {
		intent?: ButtonIntent;
	} = $props();
</script>

{#snippet Fallback()}
	<ChevronLeftIcon class={cn('size-4', className)} />
{/snippet}

<RangeCalendarPrimitive.PrevButton bind:ref class="group" {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			{intent}
			class={cn('size-(--cell-size) select-none disabled:opacity-50', className)}
			surfaceClass="bg-transparent p-0 rtl:rotate-180"
		>
			{#if children}
				{@render children?.()}
			{:else}
				{@render Fallback()}
			{/if}
		</Button>
	{/snippet}
</RangeCalendarPrimitive.PrevButton>
