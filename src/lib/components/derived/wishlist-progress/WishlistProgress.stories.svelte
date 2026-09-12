<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { WishlistProgress } from './index.js';
	const { Story } = defineMeta({
		title: 'Derived/WishlistProgress',
		component: WishlistProgress,
	});
</script>

<Story name="Dashboard rounded gradient">
	{#snippet template()}
		<div class="w-72">
			<WishlistProgress value={6} max={10} aria-label="Rezervováno 6 z 10" />
		</div>
	{/snippet}
</Story>
