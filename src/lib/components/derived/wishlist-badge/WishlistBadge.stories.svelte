<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { WishlistBadge } from './index.js';
	import GiftIcon from '@lucide/svelte/icons/gift';

	const { Story } = defineMeta({ title: 'Derived/WishlistBadge', component: WishlistBadge });
</script>

<Story name="Dashboard presentations">
	{#snippet template()}
		<div class="flex flex-wrap items-center gap-3">
			<WishlistBadge presentation="card-status" status="draft">Koncept</WishlistBadge>
			<WishlistBadge presentation="card-status" status="active">Sdílený</WishlistBadge>
			<WishlistBadge presentation="card-status" status="archived">Archivovaný</WishlistBadge>
			<WishlistBadge presentation="card-metadata">
				{#snippet icon()}<GiftIcon class="size-3.5" data-icon />{/snippet}
				12 dárků
			</WishlistBadge>
			<WishlistBadge presentation="reservation-count">2 rezervované</WishlistBadge>
			<WishlistBadge presentation="list-status" status="active">Sdílený</WishlistBadge>
		</div>
	{/snippet}
</Story>
