<script lang="ts">
	import { onDestroy } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';

	interface ReserveButtonProps {
		gift: GiftForVisitor;
		isArchived?: boolean;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/** Extra classes on the underlying Button (issue #211: stacking this button
		 *  with PurchasedToggle at equal width needs a `w-full` from the caller). */
		class?: string;
		surfaceClass?: string;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let {
		gift,
		isArchived = false,
		size = 'sm',
		class: className,
		surfaceClass,
		onreserve,
		onunreserve,
	}: ReserveButtonProps = $props();

	const hasMyReservation = $derived(gift.myReservationId !== null);
	const isFullyReserved = $derived(gift.isFullyReserved);
	let previousHasMyReservation: boolean | undefined;
	let showReservationAcknowledgement = $state(false);
	let acknowledgementRun = $state(0);
	let buttonElement = $state<HTMLButtonElement | null>(null);
	let contentElement = $state<HTMLSpanElement | null>(null);
	let activeAnimation: Animation | null = null;

	$effect.pre(() => {
		const currentHasMyReservation = gift.myReservationId !== null;
		if (previousHasMyReservation === undefined) {
			previousHasMyReservation = currentHasMyReservation;
			return;
		}
		if (!previousHasMyReservation && currentHasMyReservation) {
			showReservationAcknowledgement = true;
			acknowledgementRun += 1;
		} else if (!currentHasMyReservation) {
			showReservationAcknowledgement = false;
		}
		previousHasMyReservation = currentHasMyReservation;
	});

	$effect(() => {
		const run = acknowledgementRun;
		const shouldAnimate = showReservationAcknowledgement;
		const element = contentElement;

		activeAnimation?.cancel();
		activeAnimation = null;
		if (run === 0 || !shouldAnimate || element === null) {
			return;
		}
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			showReservationAcknowledgement = false;
			return;
		}

		activeAnimation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
		void activeAnimation.finished
			?.then(() => {
				if (acknowledgementRun === run && gift.myReservationId !== null) {
					showReservationAcknowledgement = false;
				}
			})
			.catch(() => undefined);
	});

	onDestroy(() => activeAnimation?.cancel());

	function handleReserveClick(event: MouseEvent) {
		event.stopPropagation();
		if (!isFullyReserved && !isArchived) {
			onreserve?.(gift);
		}
	}

	function handleUnreserveClick(event: MouseEvent) {
		event.stopPropagation();
		onunreserve?.(gift);
	}
</script>

{#if hasMyReservation || (!isArchived && !isFullyReserved)}
	<!-- Own reservations remain cancellable on archived lists. Keeping one Button instance lets
	     the successful authoritative prop transition morph in place without layout travel. -->
	<Button
		bind:ref={buttonElement}
		{size}
		intent={hasMyReservation ? 'danger' : 'primary'}
		aria-label={hasMyReservation
			? m.reserve_button_cancel_aria({ name: gift.name })
			: m.reserve_button_reserve_aria({ name: gift.name })}
		onclick={hasMyReservation ? handleUnreserveClick : handleReserveClick}
		data-testid="reserve-button"
		surfaceClass={cn(
			surfaceClass,
			'duration-[160ms]',
			showReservationAcknowledgement &&
				'border-ink bg-status-success text-white group-hover:bg-[color-mix(in_oklab,var(--status-success)_86%,white)]',
		)}
		class={className}
	>
		<span
			bind:this={contentElement}
			data-testid="reservation-button-content"
			class="inline-flex items-center justify-center gap-1.5"
		>
			{#if showReservationAcknowledgement}
				<CheckIcon data-icon aria-hidden="true" />
				{m.reserve_button_reserved()}
			{:else if hasMyReservation}
				{m.reserve_button_cancel()}
			{:else}
				{m.reserve_button_reserve()}
			{/if}
		</span>
	</Button>
{/if}
