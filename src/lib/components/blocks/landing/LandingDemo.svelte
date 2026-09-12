<script lang="ts">
	import { browser } from '$app/environment';
	import { asset } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import LandingDemoPane from './LandingDemoPane.svelte';
	import {
		setLandingDemoGiftContexts,
		type LandingDemoLikeControls,
	} from './landing_demo_contexts.js';
	import {
		createLandingDemoGifts,
		createLandingDemoPairGift,
		createLandingDemoWishlistHeaderProps,
		reserveDemoGift,
		toRecipientView,
		type LandingDemoLikeCounts,
	} from './landing_demo_fixtures.js';
	import {
		landingDemoGiftIdsForSlug,
		landingDemoGiftSlugForId,
	} from '$lib/modules/landing/landing_demo_gift_slugs.js';
	import {
		getLandingDemoLikes,
		toggleLandingDemoLike,
	} from '$lib/modules/landing/landing_demo_likes.remote.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import {
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		type Palette,
	} from '$lib/theme/palettes.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	/** Which side of the invariant the narrow layout is currently showing. */
	const DEMO_VIEWPOINTS = { gifter: 'gifter', recipient: 'recipient' } as const;

	type DemoViewpoint = (typeof DEMO_VIEWPOINTS)[keyof typeof DEMO_VIEWPOINTS];

	/** A birthday wishlist gets its own warm identity, scoped to this subtree only. */
	const DEMO_DEFAULT_PALETTE: Palette = 'honey';

	/** Shown once per session, so the explainer never nags a visitor who keeps liking. */
	const LIKE_POPUP_SEEN_KEY = 'landing-demo-like-popup-seen';
	const LIKE_POPUP_DURATION_MS = 7_000;

	let demoPalette = $state<Palette>(DEMO_DEFAULT_PALETTE);

	let mobileViewpoint = $state<DemoViewpoint>(DEMO_VIEWPOINTS.gifter);
	// Bits UI's single ToggleGroup writes '' through its bound value on a re-click of the
	// active item; binding a writable $derived lets onValueChange undo that (see GiftViewSwitcher).
	let selectedViewpoint = $derived(mobileViewpoint);

	// Reservations are the one source of truth for the whole demo. Plain local state: they
	// never leave the component, never reach the network, and a reload starts the visitor
	// over. Likes are the deliberate exception below — a real, shared counter.
	const reservedGiftIds = new SvelteSet<string>();

	// Loaded after hydration only, so the server-rendered landing page still needs no
	// database. The count updates when the client-side query lands.
	const likesQuery = $derived(browser ? getLandingDemoLikes() : null);
	const likeCounts = $derived<LandingDemoLikeCounts>(likesQuery?.current?.counts ?? {});
	const likedGiftIds = $derived(
		(likesQuery?.current?.likedSlugs ?? []).flatMap(landingDemoGiftIdsForSlug),
	);

	// Gift row whose like explainer is currently open. The pair card's id matches no pane row,
	// so a like there burns the once-per-session flag without painting a stray bubble.
	let likePopupGiftId = $state<string | null>(null);
	let likePopupTimer: ReturnType<typeof setTimeout> | null = null;

	function showLikePopup(giftId: string) {
		if (sessionStorage.getItem(LIKE_POPUP_SEEN_KEY) !== null) {
			return;
		}
		sessionStorage.setItem(LIKE_POPUP_SEEN_KEY, '1');
		likePopupGiftId = giftId;
		if (likePopupTimer !== null) {
			clearTimeout(likePopupTimer);
		}
		likePopupTimer = setTimeout(() => {
			likePopupGiftId = null;
		}, LIKE_POPUP_DURATION_MS);
	}

	const likeControls: LandingDemoLikeControls = {
		getLikedGiftIds: () => likedGiftIds,
		toggleLike: async (giftId) => {
			const giftSlug = landingDemoGiftSlugForId(giftId);
			if (giftSlug === null) {
				throw new Error(`Not a landing demo gift: ${giftId}`);
			}
			const result = await toggleLandingDemoLike({ giftSlug });
			if (result.liked) {
				showLikePopup(giftId);
			}
			return result;
		},
	};

	const wishlistHeaderProps = $derived(createLandingDemoWishlistHeaderProps());
	const demoGifts = $derived(createLandingDemoGifts(likeCounts));
	const gifterGifts = $derived(
		demoGifts.map((gift) =>
			reservedGiftIds.has(gift.id) ? reserveDemoGift(gift, true) : gift,
		),
	);
	const recipientGifts = $derived(demoGifts.map(toRecipientView));

	// The hook above the toggle is a frozen snapshot of one gift, reserved by someone else.
	// `isArchived` is what the product renders for a gift nobody can act on any more, which
	// is exactly the pair's job: show the reservation signal, offer no control.
	const pairGift = $derived(createLandingDemoPairGift(likeCounts));
	const pairGifterGift = $derived(reserveDemoGift(pairGift, false));
	const pairRecipientGift = $derived(toRecipientView(pairGift));

	// Context setup sits after the $derived block (against the usual script ordering)
	// because its closures capture pairGifterGift, which must be declared first.
	setLandingDemoGiftContexts(
		() => [pairGifterGift],
		() => WISHLIST_ROLES.visitor,
		likeControls,
	);

	function handleReserve(gift: GiftForVisitor) {
		reservedGiftIds.add(gift.id);
	}

	function handleUnreserve(gift: GiftForVisitor) {
		reservedGiftIds.delete(gift.id);
	}
</script>

<section
	class="bg-stripes scroll-mt-16"
	id="ukazka"
	aria-label={m.landing_demo_section_label()}
	data-testid="landing-demo"
>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-24">
		<div class="mx-auto flex max-w-[640px] flex-col items-center text-center">
			<span class="section-eyebrow">
				<span aria-hidden="true">🎮</span>
				{m.landing_demo_eyebrow()}
			</span>
			<h2 class="section-headline demo-headline">{m.landing_demo_headline()}</h2>
			<p class="mb-4 text-(length:--text-lg) leading-relaxed text-muted-foreground">
				{m.landing_demo_intro()}
			</p>
			<span class="demo-ribbon mb-12" data-testid="landing-demo-badge">
				<span aria-hidden="true">✂️</span>
				{m.landing_demo_badge()}
			</span>
		</div>

		<!-- Scoped palette: the demo wishlist carries its own color identity exactly like a real
		     one, without leaking into the landing shell around it. -->
		<div class="flex min-w-0 flex-col gap-8" data-palette={demoPalette}>
			<!-- Inside the palette wrapper on purpose: picking a color retints the switcher
			     itself along with the demo. Local state only — a reload resets it, exactly like
			     the demo reservations. -->
			<div
				class="flex flex-wrap items-center justify-end gap-1.5"
				role="group"
				aria-label={m.landing_demo_palette_label()}
				data-testid="landing-demo-palette-switcher"
			>
				<span class="text-(length:--text-sm) font-semibold text-muted-foreground">
					{m.landing_demo_palette_label()}
				</span>
				{#each PALETTES as palette (palette)}
					<button
						type="button"
						class={cn(
							'size-6 cursor-pointer rounded-full border-2 border-ink transition-transform',
							palette === demoPalette && 'scale-110 ring-2 ring-ink ring-offset-2',
						)}
						style:background-color={PALETTE_SWATCHES[palette]}
						aria-pressed={palette === demoPalette}
						aria-label={PALETTE_LABELS[palette]}
						title={PALETTE_LABELS[palette]}
						onclick={() => (demoPalette = palette)}
					></button>
				{/each}
			</div>

			<!-- The wishlist both panes below belong to, rendered by the real header component
			     with the visitor role so every manager control stays hidden. -->
			<div data-testid="landing-demo-wishlist-header">
				<!-- h2: the landing hero already owns the page's single h1. -->
				<WishlistHeader {...wishlistHeaderProps} headingLevel={2} />
			</div>

			<!-- Mobile hook: the same gift twice, side by side. Labels occupy the first row so
			     both cards still share the gift card's 7-band row subgrid and line up. -->
			<div class="lg:hidden">
				<h3 class="font-heading mb-3 text-center text-[19px] font-semibold">
					{m.landing_demo_pair_title()}
				</h3>
				<div class="grid grid-cols-2 gap-x-3 gap-y-0" data-testid="landing-demo-pair">
					<span class="pair-label mb-2">{m.landing_demo_gifter_label()}</span>
					<span class="pair-label mb-2">{m.landing_demo_recipient_label()}</span>
					<div
						class="row-span-7 grid grid-rows-subgrid gap-y-0"
						data-testid="landing-demo-pair-gifter"
					>
						<!-- Archived suppresses demo reservation controls while its Like remains interactive. -->
						<GiftCard
							gift={pairGifterGift}
							role={WISHLIST_ROLES.visitor}
							isArchived={true}
							allowArchivedLike={true}
						/>
					</div>
					<div
						class="row-span-7 grid grid-rows-subgrid gap-y-0"
						data-testid="landing-demo-pair-recipient"
					>
						<GiftCard gift={pairRecipientGift} role={WISHLIST_ROLES.recipient} />
					</div>
				</div>
				<p
					class="mt-3 text-center text-(length:--text-base) leading-relaxed text-muted-foreground"
				>
					{m.landing_demo_pair_caption()}
				</p>
			</div>

			<!-- Role switch: one pane at a time on narrow screens. -->
			<div class="flex flex-col items-center gap-2 lg:hidden">
				<span class="text-(length:--text-base) font-semibold">
					{m.landing_demo_role_label()}
				</span>
				<ToggleGroup.Root
					type="single"
					bind:value={selectedViewpoint}
					onValueChange={(newValue) => {
						if (newValue === '') {
							selectedViewpoint = mobileViewpoint;
							return;
						}
						mobileViewpoint = newValue as DemoViewpoint;
					}}
					aria-label={m.landing_demo_role_toggle_aria()}
					data-testid="landing-demo-role-toggle"
				>
					<ToggleGroup.Item
						value={DEMO_VIEWPOINTS.gifter}
						data-testid="landing-demo-role-gifter"
					>
						{m.landing_demo_role_gifter()}
					</ToggleGroup.Item>
					<ToggleGroup.Item
						value={DEMO_VIEWPOINTS.recipient}
						data-testid="landing-demo-role-recipient"
					>
						{m.landing_demo_role_recipient()}
					</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>

			<!-- Desktop: both panes at once, driven by the same local state. -->
			<div class="grid min-w-0 gap-6 lg:grid-cols-2">
				<!-- Each pane is flanked by a physical photo of the person whose viewpoint it
				     shows: absolutely positioned outside the card on wide screens, stacked above
				     it in normal flow when the role toggle owns the layout. -->
				<div
					class={cn(
						'relative flex min-w-0 flex-col',
						mobileViewpoint !== DEMO_VIEWPOINTS.gifter && 'hidden lg:block',
					)}
				>
					<figure
						class="demo-polaroid demo-polaroid-gifter mr-auto"
						data-testid="landing-demo-polaroid-gifter"
					>
						<div class="demo-polaroid-img">
							<img
								src={asset('/demo/v1/pane-gifter.webp')}
								alt={m.landing_demo_gifter_photo_alt()}
								loading="lazy"
							/>
						</div>
						<figcaption>{m.landing_demo_gifter_photo_caption()}</figcaption>
					</figure>
					<LandingDemoPane
						role={WISHLIST_ROLES.visitor}
						gifts={gifterGifts}
						label={m.landing_demo_gifter_label()}
						hint={m.landing_demo_gifter_hint()}
						{likeControls}
						{reservedGiftIds}
						{likePopupGiftId}
						testId="landing-demo-pane-gifter"
						onreserve={handleReserve}
						onunreserve={handleUnreserve}
						class="h-full lg:pt-28"
					/>
				</div>
				<div
					class={cn(
						'relative flex min-w-0 flex-col',
						mobileViewpoint !== DEMO_VIEWPOINTS.recipient && 'hidden lg:block',
					)}
				>
					<figure
						class="demo-polaroid demo-polaroid-recipient ml-auto"
						data-testid="landing-demo-polaroid-recipient"
					>
						<div class="demo-polaroid-img">
							<img
								src={asset('/demo/v1/pane-recipient.webp')}
								alt={m.landing_demo_recipient_photo_alt()}
								loading="lazy"
							/>
						</div>
						<figcaption>{m.landing_demo_recipient_photo_caption()}</figcaption>
					</figure>
					<LandingDemoPane
						role={WISHLIST_ROLES.recipient}
						gifts={recipientGifts}
						label={m.landing_demo_recipient_label()}
						hint={m.landing_demo_recipient_hint()}
						{likeControls}
						{reservedGiftIds}
						testId="landing-demo-pane-recipient"
						class="h-full lg:pt-28"
					/>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	/* `.section-headline` is unlayered global CSS, so its 48px bottom margin (sized for
	   sections whose headline is the last element of the heading block) outranks any
	   Tailwind margin utility. This section continues with an intro paragraph. */
	.demo-headline {
		margin-bottom: var(--space-4);
	}

	/* Torn-off coupon marking the whole block as a mock-up (REQ-7) */
	.demo-ribbon {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		border: 2px dashed var(--ink);
		border-radius: 999px;
		background: var(--note-tint);
		color: var(--note-ink);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		transform: rotate(-1.5deg);
	}

	/* Taped polaroid print, mirroring the wishlist hero's: a physical photo, so its frame and
	   caption ink are fixed and do NOT follow the palette or dark mode. */
	.demo-polaroid {
		position: relative;
		z-index: 10;
		width: 148px;

		/* The pane card tucks under the print's bottom edge — laid on top, not stacked. */
		margin-bottom: -0.5rem;
		padding: 8px 8px 0;
		background: #fffdf6;
		border: 2px solid #4a443a;
		border-radius: 3px;
		box-shadow: var(--elevation-lifted-strong);
	}

	.demo-polaroid::before {
		content: '';
		position: absolute;
		top: -12px;
		left: 50%;
		z-index: 1;
		width: 72px;
		height: 20px;
		transform: translateX(-50%) rotate(-4deg);
		background: var(--tape-bg);
		border: 1.5px solid var(--tape-border);
	}

	.demo-polaroid-gifter {
		transform: rotate(-5deg);
	}

	.demo-polaroid-recipient {
		transform: rotate(4deg);
	}

	.demo-polaroid-img {
		position: relative;

		/* Square photo: matches the 1:1 thumbnail slot the crop editor shows (#116 D4). */
		aspect-ratio: 1 / 1;
		overflow: hidden;
		border: 2px solid rgb(0 0 0 / 14%);
	}

	.demo-polaroid-img img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.demo-polaroid figcaption {
		padding: 6px 4px 8px;
		font-family: var(--font-head);
		font-size: 13.5px;
		text-align: center;
		color: #6c6353;
	}

	/* Split view: each print hangs off its pane's outer edge. The section's 32px side
	   padding must absorb the outward overhang PLUS the ~7px the rotation adds to the
	   print's bounding box — 1.25rem + 7px fits, 2rem scrolled the page sideways at
	   exactly 1024px. */
	@media (width >= 1024px) {
		.demo-polaroid {
			position: absolute;
			top: -6rem;
			width: 172px;
			margin-bottom: 0;
			padding: 9px 9px 0;
		}

		.demo-polaroid-gifter {
			left: -1.25rem;
		}

		.demo-polaroid-recipient {
			right: -1.25rem;
		}
	}

	@media (width >= 1280px) {
		.demo-polaroid-gifter {
			left: -3rem;
		}

		.demo-polaroid-recipient {
			right: -3rem;
		}
	}

	.pair-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 700;
		text-align: center;
	}
</style>
