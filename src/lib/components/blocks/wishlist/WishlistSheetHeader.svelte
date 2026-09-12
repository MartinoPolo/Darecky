<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		children: Snippet;
		class?: string;
	}

	let { children, class: className }: Props = $props();
</script>

<Sheet.Header class={cn('border-border shrink-0 border-b px-4 py-3 pr-14', className)}>
	{@render children()}
</Sheet.Header>
