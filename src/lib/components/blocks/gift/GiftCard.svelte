<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
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
	import GiftActionRow from './GiftActionRow.svelte';
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
	const hasReservationAction = $derived(
		visitorGift !== null &&
			(visitorGift.myReservationId !== null || (!isArchived && !isFullyReserved)),
	);
	// Edit-icon hover affordance (issue #125 REQ-3): editing roles see a pencil icon appear
	// on card hover/focus; visitors rely on the shared cursor-pointer + hover lift only.
	const canManage = $derived(canManageWishlist(role) && !contextualMode);
	const hasReceivedPrimary = $derived(canManage && !isArchived && onreceived !== undefined);

	const isDimmed = $derived(presentation.isDimmed);
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
			class={cn(
				narrowViewportState.current && presentation.showLike && 'pt-12 pr-12',
				narrowViewportState.current &&
					hasReceivedPrimary &&
					isVisitorOrModerator &&
					hasReservationAction &&
					'pb-14',
			)}
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

		{#if hasReceivedPrimary && isVisitorOrModerator && visitorGift}
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

	{#if !contextualMode && (hasReceivedPrimary || (isVisitorOrModerator && hasReservationAction) || onmore)}
		<div class={styles.footer()} data-testid="gift-card-footer">
			{#if !narrowViewportState.current && presentation.showLike && visitorGift}
				<LikeButton
					giftId={gift.id}
					giftName={gift.name}
					likeCount={visitorGift.likeCount}
					size="md"
					class="h-10 shrink-0 self-start"
				/>
			{/if}
			<div data-testid="gift-card-reservation-actions" class={styles.reservationActions()}>
				<GiftActionRow {onmore}>
					{#if !canManage && isVisitorOrModerator && visitorGift && onmore === undefined}
						<PurchasedToggle
							gift={visitorGift}
							size="xl"
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
		</div>
	{/if}
</div>
