<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	interface Props extends HTMLLabelAttributes {
		children: Snippet;
		disabledStyle?: boolean;
	}

	let { children, disabledStyle = false, class: className, ...props }: Props = $props();
</script>

<label
	{...props}
	class={cn(
		'flex min-h-12 items-center gap-3 rounded-btn px-3 py-2 font-[650] hover:bg-accent',
		disabledStyle && 'cursor-not-allowed opacity-50',
		className,
	)}
>
	{@render children()}
</label>
