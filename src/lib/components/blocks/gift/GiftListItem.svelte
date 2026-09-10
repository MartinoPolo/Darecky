<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftStateOverlay from '$lib/components/blocks/gift/GiftStateOverlay.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		extractGiftDomain,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import {
		canLikeGift,
		canManageWishlist,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { cn } from '$lib/utils.js';
	import GiftDescription from './GiftDescription.svelte';
	import GiftActionRow from './GiftActionRow.svelte';

	interface GiftListItemProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		contextualMode?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onreceived?: (giftId: string, received: boolean) => void;
		onmore?: () => void;
	}

	let {
		gift,
		role,
		isArchived = false,
		hideReservationState = role === 'recipient',
		contextualMode = false,
		onreserve,
		onunreserve,
		onreceived,
		onmore,
	}: GiftListItemProps = $props();

	const displayState = $derived(
		deriveGiftDisplayState(
			gift,
			role,
			hideReservationState,
			{
				canLike: canLikeGift(role) && !hideReservationState && !contextualMode,
				isArchived,
			},
			contextualMode,
		),
	);
	const { isVisitorOrModerator, visitorGift, isFullyReserved } = $derived(displayState);
	const presentation = $derived(displayState.presentation);
	const hasReservationAction = $derived(
		visitorGift !== null &&
			(visitorGift.myReservationId !== null || (!isArchived && !isFullyReserved)),
	);
	const canManage = $derived(canManageWishlist(role) && !contextualMode);
	const hasReceivedPrimary = $derived(canManage && !isArchived && onreceived !== undefined);
	const hasMultipleActions = $derived(
		hasReceivedPrimary && isVisitorOrModerator && hasReservationAction,
	);
	const isDimmed = $derived(presentation.isDimmed);
	const primaryLink = $derived(getPrimaryGiftLink(gift.links));
	const domain = $derived(extractGiftDomain(gift.links));
	const safeGiftUrl = $derived(normalizeGiftUrl(primaryLink?.url ?? null));
	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div class="gift-list-query-container w-full">
	<div
		data-testid="gift-list-item"
		class={cn(
			'gift-list-item group relative grid items-start gap-0 rounded-panel border-2 border-ink bg-card shadow-sticker transition-colors hover:bg-muted/50',
			hasReceivedPrimary &&
				reserverLine !== null &&
				reserverLine !== '' &&
				'gift-list-item-manager-dense',
			hasMultipleActions && 'gift-list-item-multiple-actions',
		)}
	>
		{#if !contextualMode && presentation.showLike && isVisitorOrModerator && visitorGift}
			<LikeButton
				giftId={gift.id}
				giftName={gift.name}
				likeCount={visitorGift.likeCount}
				size="md"
				class="absolute top-[6.5px] right-[6.5px] z-20"
			/>
		{/if}

		<!-- The normal horizontal layout keeps the thumb 1:1 while taller content can grow the card. -->
		<div
			data-testid="gift-list-image"
			class="gift-list-image relative aspect-square self-start border-r-2 border-ink"
		>
			<GiftImage
				class="gift-list-image-frame size-full rounded-l-[calc(var(--radius-panel)-2px)] rounded-r-none max-sm:[&_img]:p-0"
				imageUrl={imageSrc}
				imageMeta={gift.imageMeta}
				target="thumb"
				alt={gift.name}
				variant="listThumb"
			/>
			{#if isDimmed}
				<div
					data-testid="gift-reserved-veil"
					class="absolute inset-0 rounded-l-[calc(var(--radius-panel)-2px)] rounded-r-none bg-reserved-veil"
					aria-hidden="true"
				></div>
			{/if}
			<GiftStateOverlay
				model={presentation.overlay}
				class={contextualMode ? 'pt-[3.25rem]' : undefined}
			/>
		</div>

		<!-- Content always stays beside the compact list thumbnail. The dim lives here so the
	     centered state overlay stays crisp. -->
		<div
			data-testid="gift-list-content"
			class={cn(
				'flex min-w-0 flex-col gap-0.5 self-stretch p-[6.5px] sm:gap-1',
				isDimmed && 'opacity-55 grayscale-50',
			)}
		>
			<div
				class={cn(
					'flex items-start gap-1.5',
					!contextualMode && presentation.showLike && visitorGift && 'pr-11',
				)}
			>
				<h3
					class="gift-list-title line-clamp-2 min-w-0 flex-1 font-heading text-[13px] font-semibold leading-4 text-foreground sm:text-base sm:leading-snug"
				>
					{gift.name}
				</h3>
				<span class="shrink-0">
					<GiftPieceCount quantity={gift.quantity} role="recipient" hideWhenOne />
				</span>
			</div>

			<div class="flex flex-wrap items-center gap-1.5 text-sm">
				{#if gift.price !== null}
					<span class="font-bold text-primary">{priceDisplay}</span>
				{:else}
					<span class="text-muted-foreground">{priceDisplay}</span>
				{/if}

				{#if priorityInfo}
					<Badge
						tone="neutral"
						badgeStyle="subtle"
						class={cn('text-[11px] max-sm:hidden', priorityInfo.colorClass)}
					>
						{priorityInfo.label()}
					</Badge>
				{/if}
			</div>

			<div>
				{#if domain}
					<a
						href={safeGiftUrl ?? '#'}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex min-w-0 items-center gap-1 truncate text-xs text-primary"
						onclick={(e: MouseEvent) => e.stopPropagation()}
					>
						<ExternalLinkIcon class="size-3 shrink-0" />
						<span class="truncate">{domain}</span>
						{#if gift.links.length > 1}
							<span class="shrink-0 text-muted-foreground"
								>{m.gift_link_overflow({ count: gift.links.length - 1 })}</span
							>
						{/if}
					</a>
				{:else}
					<span class="text-xs text-muted-foreground">{m.gift_link_none()}</span>
				{/if}
			</div>

			{#if role === 'moderator' && reserverLine !== null && reserverLine !== ''}
				<p class="truncate text-[11px] font-semibold text-muted-foreground">
					{reserverLine}
				</p>
			{/if}

			<GiftDescription
				description={gift.description}
				descriptionAppends={gift.descriptionAppends}
				showAppends={false}
				class="gift-list-description"
				descriptionClass="line-clamp-1"
			/>

			{#if !contextualMode && (hasReceivedPrimary || (isVisitorOrModerator && hasReservationAction) || onmore)}
				<div
					class="mt-auto flex min-w-0 flex-col gap-1.5 pt-1.5"
					data-testid="gift-list-actions"
				>
					{#snippet secondaryReservationAction()}
						{#if visitorGift}
							<ReserveButton
								gift={visitorGift}
								{isArchived}
								size="md"
								{onreserve}
								{onunreserve}
							/>
						{/if}
					{/snippet}
					<GiftActionRow
						{onmore}
						secondary={hasMultipleActions ? secondaryReservationAction : undefined}
						controlSizing="intrinsic"
					>
						{#if !canManage && isVisitorOrModerator && visitorGift && onmore === undefined}
							<PurchasedToggle
								gift={visitorGift}
								size="md"
								class="w-full max-sm:hidden"
							/>
						{/if}
						{#if hasReceivedPrimary}
							<GiftReceivedToggle
								giftId={gift.id}
								received={gift.received}
								{role}
								{isArchived}
								{onreceived}
								size="md"
								compactLabel
							/>
						{:else if isVisitorOrModerator && visitorGift}
							<ReserveButton
								gift={visitorGift}
								{isArchived}
								size="md"
								{onreserve}
								{onunreserve}
							/>
						{/if}
					</GiftActionRow>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.gift-list-query-container {
		container: gift-list / inline-size;
	}

	.gift-list-item {
		--gift-list-content-floor: 9.25rem;
		--gift-list-image-size: clamp(
			9rem,
			min(34cqi, calc(100cqi - var(--gift-list-content-floor) - 0.25rem)),
			13rem
		);

		box-sizing: border-box;
		grid-template-columns: var(--gift-list-image-size) minmax(0, 1fr);
		min-height: calc(var(--gift-list-image-size) + 0.25rem);
	}

	.gift-list-item-manager-dense {
		--gift-list-image-size: clamp(
			9rem,
			calc(100cqi - var(--gift-list-content-floor) - 0.25rem),
			13rem
		);
	}

	.gift-list-image {
		width: var(--gift-list-image-size);
		height: var(--gift-list-image-size);
	}

	@container gift-list (width <= 24rem) {
		.gift-list-title {
			-webkit-line-clamp: 1;
			line-clamp: 1;
			min-height: 0;
		}

		:global(.gift-list-description) {
			display: none;
		}
	}

	@container gift-list (width < 40rem) {
		.gift-list-item,
		.gift-list-item-manager-dense {
			--gift-list-image-size: clamp(6.5rem, 32cqi, 8rem);
		}
	}
</style>
