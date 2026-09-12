<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';
	import { choiceRowVariants } from './choice_row_variants.js';

	type ChoiceRowProps = Omit<HTMLButtonAttributes, 'children'> & {
		selected: boolean;
		onSelect: () => void;
		leading?: Snippet;
		children: Snippet;
	};

	let {
		selected,
		onSelect,
		leading,
		children,
		disabled = false,
		onclick,
		class: className,
		...restProps
	}: ChoiceRowProps = $props();

	function handleClick(event: MouseEvent) {
		(onclick as ((event: MouseEvent) => void) | undefined)?.(event);
		onSelect();
	}
</script>

<button
	{...restProps}
	type="button"
	{disabled}
	aria-pressed={selected}
	data-state={selected ? 'on' : 'off'}
	onclick={handleClick}
	class={cn(choiceRowVariants({ selected }), className)}
>
	{#if leading}{@render leading()}{/if}
	<span data-slot="choice-row-label">{@render children()}</span>
</button>
