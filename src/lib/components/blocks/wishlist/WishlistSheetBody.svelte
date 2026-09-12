<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		children: Snippet;
	}

	let { children, class: className, ...props }: Props = $props();
</script>

<div {...props} class={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-2', className)}>
	{@render children()}
</div>
