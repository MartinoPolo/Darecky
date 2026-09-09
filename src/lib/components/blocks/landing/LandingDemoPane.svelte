<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import {
		setLandingDemoGiftContexts,
		type LandingDemoLikeControls,
	} from './landing_demo_contexts.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	interface LandingDemoPaneProps {
		role: WishlistRole;
		gifts: GiftByRole[];
		label: string;
		hint: string;
		/** Shared like counter wiring — the demo's one live remote surface. */
		likeControls: LandingDemoLikeControls;
		/** Ids the demo visitor has reserved — drives the recipient pane's narration only. */
		reservedGiftIds: ReadonlySet<string>;
		/** Gift row that currently carries the one-per-session like explainer, if any. */
		likePopupGiftId?: string | null;
		testId: string;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		class?: string;
	}

	let {
		role,
		gifts,
		label,
		hint,
		likeControls,
		reservedGiftIds,
		likePopupGiftId = null,
		testId,
		onreserve,
		onunreserve,
		class: className,
	}: LandingDemoPaneProps = $props();

	// Read through closures rather than handing the prop objects over directly: the context
	// is created once at init, and a captured prop reference would freeze at its first value
	// (svelte's state_referenced_locally warning fires on the direct form).
	setLandingDemoGiftContexts(
		() => gifts,
		() => role,
		{
			getLikedGiftIds: () => likeControls.getLikedGiftIds(),
			toggleLike: (giftId) => likeControls.toggleLike(giftId),
		},
	);

	const isRecipientPane = $derived(role === WISHLIST_ROLES.recipient);
</script>

<div
	class={cn(
		'flex min-w-0 flex-col gap-3 rounded-panel border-[2.5px] border-ink bg-card p-4 shadow-sticker',
		className,
	)}
	data-testid={testId}
>
	<!-- The polaroid photos live outside the pane (LandingDemo.svelte), so the header is just
	     the label block again. -->
	<div class="flex min-w-0 flex-col gap-1">
		<h3 class="font-heading text-[19px] font-semibold">{label}</h3>
		<p class="text-(length:--text-base) leading-relaxed text-muted-foreground">{hint}</p>
	</div>

	<div class="flex min-w-0 flex-col gap-3">
		{#each gifts as gift (gift.id)}
			{@const isNarrated = isRecipientPane && reservedGiftIds.has(gift.id)}
			<!-- Horizontal padding is constant so the mobile narration tint can never shift the
			     row; the desktop split view resets the tint because the recipient pane must stay
			     pixel-identical while the gifter pane changes (issue #218 REQ-6). -->
			<div
				class={cn(
					'relative -mx-2 rounded-lg px-2 transition-colors duration-300',
					isNarrated && 'bg-tint lg:bg-transparent',
				)}
				data-testid="landing-demo-gift-{gift.id}"
			>
				{#if gift.id === likePopupGiftId}
					<!-- Keep the explainer over the content column rather than the thumbnail: the
					     like control can grow when its live count appears. The 34% boundary mirrors
					     the list row's largest fluid thumbnail share, while the right inset aligns
					     the bubble with the card inside this wrapper's negative margin. -->
					<p
						class="absolute -top-2 right-2 z-20 w-[calc(66%-1rem)] max-w-96 rounded-lg border-2 border-ink bg-note px-3 py-2 text-(length:--text-sm) leading-snug text-note-ink shadow-sticker"
						role="status"
						data-testid="landing-demo-like-popup"
					>
						{m.landing_demo_like_popup()}
					</p>
				{/if}
				<GiftListItem {gift} {role} {onreserve} {onunreserve} />
				{#if isNarrated}
					<p
						class="my-3 rounded-lg border-2 border-ink bg-note px-3 py-2 text-(length:--text-base) font-semibold text-note-ink lg:hidden"
						data-testid="landing-demo-invariant-caption"
					>
						{m.landing_demo_invariant_caption()}
					</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
