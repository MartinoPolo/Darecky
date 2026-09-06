<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import PencilIcon from '@lucide/svelte/icons/pencil';
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
		showLikeCount?: boolean;
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
		showLikeCount = false,
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
	// Edit-icon hover affordance (issue #125 REQ-3): mirrors GiftCard's manager-only pencil icon.
	const canManage = $derived(canManageWishlist(role) && !contextualMode);
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
		class="gift-list-item group grid items-start gap-0 rounded-panel border-2 border-ink bg-card shadow-sticker transition-colors hover:bg-muted/50"
	>
		<!-- The 1:1 thumb fills the card's inner height in the normal horizontal layout. -->
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
			{#if canManage}
				<!-- Edit affordance (issue #125 REQ-3): decorative, the whole row is the click target. -->
				<span
					class="absolute -top-1.5 -left-1.5 hidden items-center justify-center rounded-full border-2 border-ink bg-card p-1 opacity-0 shadow-sticker transition-opacity duration-150 sm:flex group-hover:opacity-100 group-focus-within:opacity-100"
					aria-hidden="true"
				>
					<PencilIcon class="size-3" />
				</span>
			{/if}
			{#if !contextualMode && presentation.showLike && isVisitorOrModerator && visitorGift}
				<LikeButton
					giftId={gift.id}
					giftName={gift.name}
					likeCount={visitorGift.likeCount}
					size="md"
					showCount={showLikeCount}
					class={cn(
						'absolute right-1 top-1 z-20 h-10 min-h-10 min-w-10 rounded-full sm:right-2 sm:top-2',
						showLikeCount
							? 'w-10 max-sm:[&_[data-like-count]]:hidden sm:w-auto'
							: 'w-10',
					)}
					surfaceClass={cn(
						'justify-center border-2 border-ink bg-card p-0 shadow-sticker',
						showLikeCount
							? 'gap-0 max-sm:[&_[data-like-count]]:hidden sm:gap-1 sm:px-1.5'
							: 'gap-0',
					)}
				/>
			{/if}
			<GiftStateOverlay
				model={presentation.overlay}
				class={cn(
					'pt-[3.25rem]',
					canManage && isVisitorOrModerator && hasReservationAction && 'max-sm:pb-14',
				)}
			/>
			{#if !contextualMode && canManage && isVisitorOrModerator && visitorGift}
				<ReserveButton
					gift={visitorGift}
					{isArchived}
					size="xl"
					{onreserve}
					{onunreserve}
					class="absolute right-[9.5px] bottom-[9.5px] left-[6.5px] z-20 h-auto min-h-12 min-w-0 w-auto"
					surfaceClass="whitespace-normal px-2 py-2 text-sm leading-tight"
				/>
			{/if}
		</div>

		<!-- Content and primary reservation action stay beside the image at every width. The dim
	     lives here (not on the row) so the centered state overlay stays crisp. -->
		<div
			data-testid="gift-list-content"
			class={cn(
				'flex min-w-0 flex-col gap-0.5 self-stretch p-[6.5px] sm:gap-1',
				isDimmed && 'opacity-55 grayscale-50',
			)}
		>
			<div class="flex items-start gap-1.5">
				<h3
					class="line-clamp-2 min-h-8 min-w-0 flex-1 font-heading text-[13px] font-semibold leading-4 text-foreground sm:min-h-0 sm:text-base sm:leading-snug"
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
				descriptionClass="line-clamp-1 max-sm:hidden"
			/>

			{#if !contextualMode && ((canManage && !isArchived && onreceived !== undefined) || (isVisitorOrModerator && hasReservationAction) || onmore)}
				<div
					class="mt-auto flex min-w-0 flex-col gap-1.5 pt-1.5"
					data-testid="gift-list-actions"
				>
					<GiftActionRow {onmore}>
						{#if !canManage && isVisitorOrModerator && visitorGift && onmore === undefined}
							<PurchasedToggle
								gift={visitorGift}
								size="xl"
								class="w-full max-sm:hidden"
							/>
						{/if}
						{#if canManage && onreceived !== undefined}
							<GiftReceivedToggle
								giftId={gift.id}
								received={gift.received}
								{role}
								{isArchived}
								{onreceived}
								size="xl"
								compactLabel
								surfaceClass="whitespace-normal px-2 py-2 text-sm leading-tight [&_svg]:hidden"
							/>
						{:else if isVisitorOrModerator && visitorGift}
							<ReserveButton
								gift={visitorGift}
								{isArchived}
								size="xl"
								{onreserve}
								{onunreserve}
								surfaceClass="whitespace-normal px-2 py-2 text-sm leading-tight"
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
		--gift-list-content-floor: calc(var(--size-control-xl) + 0.375rem + 5.875rem);
		--gift-list-image-size: clamp(
			148px,
			min(49cqi, calc(100cqi - var(--gift-list-content-floor))),
			190px
		);
		box-sizing: content-box;
		grid-template-columns: var(--gift-list-image-size) minmax(0, 1fr);
		height: var(--gift-list-image-size);
	}

	.gift-list-image {
		width: var(--gift-list-image-size);
		height: var(--gift-list-image-size);
	}

	@media (min-width: 640px) {
		.gift-list-item {
			--gift-list-image-size: clamp(198px, 30cqi, 208px);
		}
	}

	@container gift-list (max-width: 18rem) {
		.gift-list-item {
			display: flex;
			height: auto;
			flex-direction: column;
		}

		.gift-list-image {
			width: 100%;
			height: auto;
			aspect-ratio: 1;
			border-right: 0;
			border-bottom: 2px solid var(--ink);
		}

		.gift-list-image-frame {
			border-radius: calc(var(--radius-panel) - 2px) calc(var(--radius-panel) - 2px) 0 0;
		}
	}
</style>
