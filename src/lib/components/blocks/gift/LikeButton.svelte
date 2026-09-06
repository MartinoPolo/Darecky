<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { onDestroy, tick, untrack } from 'svelte';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import * as m from '$lib/paraglide/messages.js';
	import { useLikes } from '$lib/modules/likes/likes.context.svelte.js';
	import { toggleLike } from '$lib/modules/likes/likes.remote.js';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';
	import {
		likeButtonVariants,
		type LikeButtonSize,
		type LikeButtonAppearance,
	} from './like_button_variants.js';
	import { cn } from '$lib/utils.js';

	interface LikeButtonProps {
		giftId: string;
		giftName: string;
		likeCount: number;
		size?: LikeButtonSize;
		appearance?: LikeButtonAppearance;
		showCount?: boolean;
		countOverlay?: boolean;
		class?: string;
		surfaceClass?: string;
	}

	let {
		giftId,
		giftName,
		likeCount,
		size = 'md',
		appearance = 'ghost',
		showCount = true,
		countOverlay = false,
		class: className,
		surfaceClass,
	}: LikeButtonProps = $props();

	const likesContext = useLikes();

	const liked = $derived(likesContext.isLiked(giftId));
	let displayCount = $state(untrack(() => likeCount));
	let requestPending = $state(false);
	let heartElement = $state<HTMLSpanElement>();
	let run = 0;
	const activeAnimations = new SvelteSet<Animation>();

	const styles = $derived(likeButtonVariants({ liked, size, appearance }));

	// Prop refreshes normally remain authoritative. While a toggle is in flight,
	// keep the optimistic count stable and reconcile it from that request's result.
	$effect(() => {
		const incomingCount = likeCount;
		if (!untrack(() => requestPending)) {
			displayCount = incomingCount;
		}
	});

	function cancelAcknowledgement() {
		for (const animation of activeAnimations) {
			animation.cancel();
		}
		activeAnimations.clear();
	}

	function animateAcknowledgement() {
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			return;
		}

		if (!heartElement) {
			return;
		}
		activeAnimations.add(
			heartElement.animate(
				[
					{ transform: 'scale(1)' },
					{ transform: 'scale(1.16)' },
					{ transform: 'scale(1)' },
				],
				{ duration: 160 },
			),
		);
	}

	async function handleClick(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();

		// Likes require an account (they drive notifications). Prompt anonymous
		// visitors to log in instead of firing a request that would 401.
		if (!likesContext.isAuthenticated()) {
			likesContext.requireAuth();
			return;
		}

		const currentRun = ++run;
		requestPending = true;
		cancelAcknowledgement();

		// Optimistic update
		const wasLiked = liked;
		const previousCount = displayCount;
		likesContext.optimisticToggle(giftId);
		displayCount = wasLiked ? previousCount - 1 : previousCount + 1;

		// Start persistence immediately. Acknowledgement waits for the authoritative
		// result so rejected and stale optimistic updates never play success motion.
		const persistence =
			likesContext.toggleLike === undefined
				? toggleLike({ giftId })
				: likesContext.toggleLike(giftId);

		try {
			const result = await persistence;
			if (currentRun !== run) {
				return;
			}

			displayCount = result.likeCount;
			requestPending = false;
			if (!wasLiked && result.liked) {
				await tick();
				if (currentRun === run) {
					animateAcknowledgement();
				}
			}
		} catch {
			if (currentRun !== run) {
				return;
			}
			cancelAcknowledgement();
			likesContext.revertToggle(giftId, wasLiked);
			displayCount = previousCount;
			requestPending = false;
		}
	}

	onDestroy(() => {
		run += 1;
		cancelAcknowledgement();
	});
</script>

<button
	type="button"
	class={cn(styles.root(), size === 'md' && 'min-w-10', countOverlay && 'relative', className)}
	aria-label={liked
		? m.gift_like_remove_aria({ name: giftName })
		: m.gift_like_add_aria({ name: giftName })}
	aria-pressed={liked}
	onclick={handleClick}
>
	<ElevationSurface
		class={cn(styles.surface(), countOverlay && 'justify-center gap-0', surfaceClass)}
	>
		<span bind:this={heartElement} data-like-heart class="inline-flex">
			<HeartIcon class={styles.icon()} />
		</span>
		{#if showCount && displayCount > 0}
			<span
				data-like-count
				class={cn(styles.count(), countOverlay && 'absolute right-0.5 top-0 text-[10px]')}
				>{displayCount}</span
			>
		{/if}
	</ElevationSurface>
</button>
