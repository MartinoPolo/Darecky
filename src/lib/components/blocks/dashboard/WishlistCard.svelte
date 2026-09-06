<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { wishlistCardVariants, STATUS_CHIP_CLASSES } from './wishlist_card_variants.js';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard_types.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { getInitials } from '$lib/utils/initials.js';
	import type { Snippet } from 'svelte';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';

	interface WishlistCardProps {
		wishlist: Wishlist;
		/** Recipient display name (who the list is for), shown for moderated/followed cards */
		recipientDisplayName?: string;
		/** Total gift count for owner cards (owner invariant: count only, no reservation data) */
		giftCount?: number;
		/** Reservation progress for moderator cards */
		reservationProgress?: { reserved: number; total: number };
		/** Available gifts count for followed cards */
		availableGifts?: number;
		/** Own reservation count for followed cards */
		myReservations?: number;
		/** Extra content rendered below the meta row */
		extraContent?: Snippet;
		/** Action buttons */
		actions?: Snippet;
		class?: string;
	}

	let {
		wishlist: wishlistData,
		recipientDisplayName,
		giftCount,
		reservationProgress,
		availableGifts,
		myReservations,
		extraContent,
		actions,
		class: className,
	}: WishlistCardProps = $props();

	const isArchived = $derived(wishlistData.status === 'archived');
	const themeEmoji = $derived(getWishlistEmoji(wishlistData.theme));
	const cardSrc = $derived(wishlistImageUrl(wishlistData.imageKey));
	const cardFrame = $derived(wishlistSlotToFrameProps(wishlistData.imageSlots, 'card'));
	const variants = $derived(wishlistCardVariants({ archived: isArchived }));
	const statusLabel = $derived(WISHLIST_STATUS_LABELS[wishlistData.status]());
	const statusChipClass = $derived(STATUS_CHIP_CLASSES[wishlistData.status]);

	function formatDate(date: Date | null): string {
		if (date === null) {
			return '';
		}
		return new Intl.DateTimeFormat(getLocale(), {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric',
		}).format(new Date(date));
	}
</script>

<a
	href={localizeInternalHref(resolve('/(app)/w/[id]', { id: wishlistData.shortId }))}
	class={cn(variants.root(), className)}
	aria-label={wishlistData.title}
	data-testid="wishlist-card"
>
	<ElevationSurface plate class={variants.plate()} />
	<!-- Banner: taped-notebook tint with dot pattern (photo replaces both when assigned) -->
	<div class={variants.banner()} aria-hidden="true">
		<div class="absolute inset-0">
			<WishlistSlotImage
				class="size-full rounded-none"
				src={cardSrc}
				frame={cardFrame}
				{themeEmoji}
				alt={wishlistData.title}
				variant="card"
			/>
		</div>
		{#if cardSrc === null}
			<div class={variants.bannerPattern()}></div>
		{/if}
		<div class={variants.bannerTitle()}>{wishlistData.title}</div>
		<div
			class={cn(variants.statusBadge(), statusChipClass)}
			aria-label={m.wishlist_status_aria({ status: statusLabel })}
		>
			{statusLabel}
		</div>
	</div>

	<!-- Body -->
	<div class={variants.body()}>
		{#if recipientDisplayName}
			<div class={variants.ownerRow()}>
				<div class={variants.ownerAvatar()}>
					{getInitials(recipientDisplayName)}
				</div>
				<span>{m.wishlist_recipient_chip({ name: recipientDisplayName })}</span>
			</div>
		{/if}

		{#if reservationProgress}
			<div class={variants.progressWrap()}>
				<div class={variants.progressLabelRow()}>
					<span>{m.wishlist_reservation_progress()}</span>
					<span class={variants.progressValue()}>
						{m.wishlist_reserved_ratio({
							reserved: reservationProgress.reserved,
							total: reservationProgress.total,
						})}
					</span>
				</div>
				<div class={variants.progressTrack()}>
					<div
						class={variants.progressFill()}
						style:width="{reservationProgress.total > 0
							? (reservationProgress.reserved / reservationProgress.total) * 100
							: 0}%"
					></div>
				</div>
			</div>
		{/if}

		{#if availableGifts !== undefined}
			<div class={variants.metaRow()}>
				<span class={variants.availableCount()}>
					<GiftIcon class="inline size-3.5 align-middle" />
					{m.wishlist_available_gifts({ count: availableGifts })}
				</span>
				{#if myReservations !== undefined && myReservations > 0}
					<span class={variants.reservationChip()}>
						<CheckIcon class="size-3" />
						{m.wishlist_my_reservations({ count: myReservations })}
					</span>
				{:else if myReservations !== undefined}
					<span class="text-xs text-muted-foreground/60"
						>{m.wishlist_no_my_reservations()}</span
					>
				{/if}
			</div>
		{/if}

		<!-- Owner card: gift count + optional event date (owner invariant – no reservations) -->
		{#if giftCount !== undefined}
			<div class={variants.metaRow()}>
				<span class={variants.metaChip()}>
					<GiftIcon class="size-3.5" />
					{giftCount === 1
						? m.wishlist_gift_count_one()
						: m.wishlist_gift_count_other({ count: giftCount })}
				</span>
				{#if wishlistData.eventDate}
					<span class={variants.metaChip()}>🗓 {formatDate(wishlistData.eventDate)}</span>
				{/if}
			</div>
		{/if}

		<!-- Owner card: created + last-updated timestamps (own lists only) -->
		{#if giftCount !== undefined && !reservationProgress && wishlistData.createdAt}
			<div class={variants.metaRow()}>
				<span class={variants.metaText()}>
					{m.wishlist_created_at({ date: formatDate(wishlistData.createdAt) })}
				</span>
				{#if wishlistData.updatedAt}
					<span class={variants.metaText()}>
						{m.wishlist_updated_at({ date: formatDate(wishlistData.updatedAt) })}
					</span>
				{/if}
			</div>
		{/if}

		{#if reservationProgress || (giftCount === undefined && wishlistData.createdAt)}
			<div class={variants.metaRow()}>
				<span class={variants.metaText()}>
					{#if reservationProgress}
						{m.wishlist_total_gifts({ count: reservationProgress.total })}
					{:else}
						{m.wishlist_created_at({ date: formatDate(wishlistData.createdAt) })}
					{/if}
				</span>
			</div>
		{/if}

		{#if extraContent}
			{@render extraContent()}
		{/if}

		{#if actions}
			<div class={variants.divider()}></div>
			<div class={variants.actions()}>
				{@render actions()}
			</div>
		{/if}
	</div>
</a>
