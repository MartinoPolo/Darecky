<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		class: className,
		children,
		plate = false,
	}: { class?: string; children?: Snippet; plate?: boolean } = $props();
</script>

{#if plate}
	<span
		aria-hidden="true"
		data-slot="elevation-surface"
		class={cn('elevation-surface pointer-events-none absolute inset-0', className)}
	></span>
{:else}
	<span
		data-slot="elevation-surface"
		class={cn('elevation-surface pointer-events-none', className)}
	>
		{@render children?.()}
	</span>
{/if}
