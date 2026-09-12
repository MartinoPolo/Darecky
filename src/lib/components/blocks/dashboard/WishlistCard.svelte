<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { wishlistCardVariants } from './wishlist_card_variants.js';
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
	import { Separator } from '$lib/components/base/separator/index.js';
	import { Avatar } from '$lib/components/derived/avatar/index.js';
	import { WishlistBadge } from '$lib/components/derived/wishlist-badge/index.js';
	import { WishlistProgress } from '$lib/components/derived/wishlist-progress/index.js';

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
		<WishlistBadge
			class={variants.statusBadge()}
			presentation="card-status"
			status={wishlistData.status}
			aria-label={m.wishlist_status_aria({ status: statusLabel })}
		>
			{statusLabel}
		</WishlistBadge>
	</div>

	<!-- Body -->
	<div class={variants.body()}>
		{#if recipientDisplayName}
			<div class={variants.ownerRow()}>
				<Avatar
					appearance="recipient"
					src={null}
					alt=""
					initials={getInitials(recipientDisplayName)}
				/>
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
				<WishlistProgress
					value={reservationProgress.total === 0 ? 0 : reservationProgress.reserved}
					max={Math.max(reservationProgress.total, 1)}
					aria-label={m.wishlist_reservation_progress()}
					aria-valuetext={m.wishlist_reserved_ratio({
						reserved: reservationProgress.reserved,
						total: reservationProgress.total,
					})}
				/>
			</div>
		{/if}

		{#if availableGifts !== undefined}
			<div class={variants.metaRow()}>
				<span class={variants.availableCount()}>
					<GiftIcon class="inline size-3.5 align-middle" />
					{m.wishlist_available_gifts({ count: availableGifts })}
				</span>
				{#if myReservations !== undefined && myReservations > 0}
					<WishlistBadge presentation="reservation-count">
						{#snippet icon()}<CheckIcon class="size-3" data-icon />{/snippet}
						{m.wishlist_my_reservations({ count: myReservations })}
					</WishlistBadge>
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
				<WishlistBadge presentation="card-metadata">
					{#snippet icon()}<GiftIcon class="size-3.5" data-icon />{/snippet}
					{giftCount === 1
						? m.wishlist_gift_count_one()
						: m.wishlist_gift_count_other({ count: giftCount })}
				</WishlistBadge>
				{#if wishlistData.eventDate}
					<WishlistBadge presentation="card-metadata">
						🗓 {formatDate(wishlistData.eventDate)}
					</WishlistBadge>
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
			<Separator class={variants.divider()} />
			<div class={variants.actions()}>
				{@render actions()}
			</div>
		{/if}
	</div>
</a>
