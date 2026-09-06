<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { wishlistListViewVariants } from './wishlist_list_view_variants.js';
	import { STATUS_CHIP_CLASSES } from './wishlist_card_variants.js';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard_types.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';

	interface WishlistListItem {
		wishlist: Wishlist;
		recipientDisplayName?: string;
		giftCount?: number;
		reservedCount?: number;
	}

	interface WishlistListViewProps {
		items: WishlistListItem[];
		class?: string;
	}

	let { items, class: className }: WishlistListViewProps = $props();

	const variants = wishlistListViewVariants();
</script>

<div class={cn(variants.root(), className)}>
	{#each items as item (item.wishlist.id)}
		{@const themeEmoji = getWishlistEmoji(item.wishlist.theme)}
		{@const isArchived = item.wishlist.status === 'archived'}
		{@const rowVariants = wishlistListViewVariants({ archived: isArchived })}
		{@const thumbSrc = wishlistImageUrl(item.wishlist.imageKey)}
		{@const thumbFrame = wishlistSlotToFrameProps(item.wishlist.imageSlots, 'thumbnail')}
		<a
			href={localizeInternalHref(resolve('/(app)/w/[id]', { id: item.wishlist.shortId }))}
			class={rowVariants.row()}
			aria-label={item.wishlist.title}
		>
			<ElevationSurface plate class={rowVariants.plate()} />
			<div class={rowVariants.bannerMini()}>
				<div class="absolute inset-0">
					<WishlistSlotImage
						src={thumbSrc}
						frame={thumbFrame}
						{themeEmoji}
						alt={item.wishlist.title}
						variant="thumbnail"
					/>
				</div>
			</div>

			<div class={rowVariants.info()}>
				<span class={rowVariants.title()}>{item.wishlist.title}</span>
				{#if item.recipientDisplayName}
					<span class={rowVariants.subtitle()}>
						{m.wishlist_recipient_chip({ name: item.recipientDisplayName })}
						{#if item.reservedCount !== undefined && item.giftCount !== undefined}
							· {m.wishlist_list_reserved_count({
								reserved: item.reservedCount,
								total: item.giftCount,
							})}
						{/if}
					</span>
				{/if}
			</div>

			<div class={rowVariants.trailing()}>
				{#if item.giftCount !== undefined}
					<span class={rowVariants.giftCount()}>
						<GiftIcon class="mr-1 inline size-3 align-middle" />
						{item.giftCount}
					</span>
				{/if}
				<div
					class={cn(rowVariants.statusBadge(), STATUS_CHIP_CLASSES[item.wishlist.status])}
				>
					{WISHLIST_STATUS_LABELS[item.wishlist.status]()}
				</div>
			</div>
		</a>
	{/each}
</div>
