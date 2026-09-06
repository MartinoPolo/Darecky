<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import GiftStateOverlay from '$lib/components/blocks/gift/GiftStateOverlay.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import {
		canLikeGift,
		canManageWishlist,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { hasExplicitFrameFill } from '$lib/components/derived/image-frame/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import { cn } from '$lib/utils.js';
	import { giftCardVariants } from './gift_card_variants.js';
	import GiftDescription from './GiftDescription.svelte';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';

	interface GiftCardProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		contextualMode?: boolean;
		allowArchivedLike?: boolean;
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
		allowArchivedLike = false,
		onreserve,
		onunreserve,
		onreceived,
		onmore,
	}: GiftCardProps = $props();

	const narrowViewportState = useNarrowViewportState();
	const displayState = $derived(
		deriveGiftDisplayState(
			gift,
			role,
			hideReservationState,
			{
				canLike:
					canLikeGift(role) &&
					!hideReservationState &&
					!contextualMode &&
					(!isArchived || allowArchivedLike),
				isArchived: isArchived && !allowArchivedLike,
			},
			contextualMode,
		),
	);
	const { isVisitorOrModerator, visitorGift, isFullyReserved } = $derived(displayState);
	const presentation = $derived(displayState.presentation);
	// Edit-icon hover affordance (issue #125 REQ-3): editing roles see a pencil icon appear
	// on card hover/focus; visitors rely on the shared cursor-pointer + hover lift only.
	const canManage = $derived(canManageWishlist(role) && !contextualMode);

	const isDimmed = $derived(presentation.isDimmed);
	const hasDesktopAction = $derived(
		presentation.showLike ||
			(canManage && !isArchived && onreceived !== undefined) ||
			(isVisitorOrModerator &&
				visitorGift != null &&
				(visitorGift.myReservationId != null || (!isArchived && !isFullyReserved))),
	);

	const styles = $derived(giftCardVariants({ dimmed: isDimmed }));

	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const explicitImageFrameFill = $derived.by(() => {
		const fillColor = gift.imageMeta?.bgColor;
		return hasExplicitFrameFill(fillColor) ? fillColor : null;
	});
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
	const hasModeratorReserverLine = $derived(
		role === 'moderator' && reserverLine !== null && reserverLine.trim() !== '',
	);
	const hasDescriptionContent = $derived(
		(gift.description ?? '').trim() !== '' || gift.descriptionAppends.length > 0,
	);
</script>

<div class={styles.card()}>
	<ElevationSurface plate class={styles.plate()} />
	<!-- Image area: dotted mat behind the photo; letterboxed photos keep the mat visible -->
	<div
		class={cn(styles.imageArea(), explicitImageFrameFill !== null && 'bg-[var(--frame-fill)]')}
		data-testid="gift-card-image-frame"
		style:--frame-fill={explicitImageFrameFill ?? undefined}
	>
		{#if explicitImageFrameFill === null}
			<div
				class={styles.imagePattern()}
				data-testid="gift-card-image-pattern"
				aria-hidden="true"
			></div>
		{/if}

		<GiftImage
			class="size-full rounded-none bg-transparent max-sm:[&_img]:p-0"
			imageUrl={imageSrc}
			imageMeta={gift.imageMeta}
			target="square"
			alt={gift.name}
			variant="card"
		/>

		{#if isDimmed}
			<div class={styles.imageVeil()} aria-hidden="true"></div>
		{/if}

		{#if gift.category != null && !contextualMode}
			<div class="max-sm:hidden"><GiftCategoryBadge category={gift.category} /></div>
		{/if}

		{#if canManage}
			<!-- Edit affordance (issue #125 REQ-3): hidden until the card is hovered/focused;
			     purely decorative, the whole card is already the click target via
			     WishlistGiftDraggableWrapper. -->
			<span
				class={cn(styles.editIcon(), 'max-sm:hidden')}
				data-testid="gift-card-edit-icon"
				aria-hidden="true"
			>
				<PencilIcon class="size-3.5" />
			</span>
		{/if}

		<GiftStateOverlay
			model={presentation.overlay}
			class={narrowViewportState.current && presentation.showLike ? 'pt-12' : undefined}
		/>
		{#if !contextualMode && narrowViewportState.current && presentation.showLike && visitorGift}
			<LikeButton
				giftId={gift.id}
				giftName={gift.name}
				likeCount={visitorGift.likeCount}
				size="md"
				countOverlay
				class="absolute top-1 right-1 z-20 size-10 rounded-full"
				surfaceClass="border-2 border-ink bg-card p-0 shadow-sticker"
			/>
		{/if}
	</div>

	<!-- Body -->
	<div class={styles.body()}>
		<!-- Name + piece count. Edited-after-share info surfaces only as a muted line
		     in the gift detail modal (issue #185), not on the card. -->
		<div class={styles.nameRow()}>
			<h3 class={styles.name()}>{gift.name}</h3>
			<span class="max-sm:hidden">
				<GiftPieceCount quantity={gift.quantity} role="recipient" hideWhenOne />
			</span>
		</div>

		{#if gift.price !== null}
			<span class={styles.price()}>{priceDisplay}</span>
		{:else}
			<span class={styles.priceEmpty()}>{priceDisplay}</span>
		{/if}

		<!-- Priority eyebrow -->
		{#if priorityInfo}
			<div class={styles.priorityEyebrow()}>
				<Badge tone="neutral" badgeStyle="subtle" class={priorityInfo.colorClass}>
					<span class="inline-flex items-baseline gap-1">
						<span class="text-[10px] uppercase opacity-60"
							>{m.gift_priority_eyebrow()}</span
						>
						<span class="opacity-40">&middot;</span>
						{priorityInfo.label()}
					</span>
				</Badge>
			</div>
		{/if}

		<!-- Links -->
		<div class={styles.linkList()}>
			<GiftLinkList links={gift.links} maxVisible={3} />
		</div>

		{#if hasModeratorReserverLine || hasDescriptionContent}
			<div
				class="row-start-5 mt-0.5 flex flex-col gap-1 sm:mt-3"
				data-testid="gift-card-description-stack"
			>
				{#if hasModeratorReserverLine}
					<p class="truncate text-xs font-semibold text-muted-foreground">
						{reserverLine}
					</p>
				{/if}
				<GiftDescription
					description={gift.description}
					descriptionAppends={gift.descriptionAppends}
					maxVisibleAppends={1}
					class="max-sm:hidden"
				/>
			</div>
		{/if}
	</div>

	{#if !contextualMode && ((canManage && !isArchived && onreceived !== undefined) || (isVisitorOrModerator && visitorGift) || onmore)}
		<div
			class={cn(styles.footer(), !hasDesktopAction && 'sm:hidden')}
			data-testid="gift-card-footer"
		>
			{#if !narrowViewportState.current && presentation.showLike && visitorGift}
				<LikeButton
					giftId={gift.id}
					giftName={gift.name}
					likeCount={visitorGift.likeCount}
					size="md"
					class="h-10 shrink-0 self-start"
				/>
			{/if}
			<div
				data-testid="gift-card-reservation-actions"
				class={cn(
					styles.reservationActions(),
					onmore && 'max-sm:grid-cols-[minmax(0,1fr)_40px]',
				)}
			>
				{#if canManage && onreceived !== undefined}
					<GiftReceivedToggle
						giftId={gift.id}
						received={gift.received}
						{role}
						{isArchived}
						{onreceived}
						class="min-h-10 min-w-0 w-full shrink max-sm:min-h-11"
						surfaceClass="gap-0 whitespace-normal px-1 text-xs leading-tight [&_svg]:hidden sm:gap-1.5 sm:px-3 sm:text-(length:--text-md) sm:leading-none sm:[&_svg]:block"
					/>
				{/if}
				{#if isVisitorOrModerator && visitorGift}
					<PurchasedToggle gift={visitorGift} class="w-full max-sm:hidden" />
					<ReserveButton
						gift={visitorGift}
						{isArchived}
						size="md"
						{onreserve}
						{onunreserve}
						class={cn('min-h-10 w-full', canManage && 'max-sm:hidden')}
						surfaceClass="gap-0 whitespace-normal px-1 text-xs leading-tight [&_svg]:hidden sm:gap-1.5 sm:px-3 sm:text-(length:--text-md) sm:leading-none sm:[&_svg]:block"
					/>
				{/if}
				{#if onmore}
					<Button
						intent="outline"
						class="h-auto min-h-10 w-10 shrink-0 self-stretch sm:hidden"
						surfaceClass="p-0"
						aria-label={m.gift_more_actions()}
						data-testid="gift-more-actions"
						onclick={(event) => {
							event.stopPropagation();
							onmore();
						}}><EllipsisIcon /></Button
					>
				{/if}
			</div>
		</div>
	{/if}
</div>
