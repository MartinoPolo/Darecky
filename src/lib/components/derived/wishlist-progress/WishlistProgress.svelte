<script lang="ts">
	import type { WithoutChildrenOrChild } from '$lib/utils.js';
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { wishlistProgressVariants } from './wishlist_progress_variants.js';

	let {
		ref = $bindable(null),
		max = 100,
		value,
		...restProps
	}: WithoutChildrenOrChild<ProgressPrimitive.RootProps> = $props();

	const styles = wishlistProgressVariants();
</script>

<ProgressPrimitive.Root
	bind:ref
	data-slot="progress"
	data-presentation="dashboard-rounded-gradient"
	class={styles.root()}
	{value}
	{max}
	{...restProps}
>
	<div
		data-slot="progress-indicator"
		class={styles.indicator()}
		style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
	></div>
</ProgressPrimitive.Root>
