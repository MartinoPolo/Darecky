<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';
	import { Button } from '$lib/components/base/button/index.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { useGifts } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationPurchased } from '$lib/modules/reservations/reservations.remote.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface PurchasedToggleProps {
		gift: GiftForVisitor;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		/** Extra classes on the underlying Button (issue #165: the gift detail
		 *  modal's photo overlay gives the pill a sticker shadow + rotation). */
		class?: string;
	}

	let { gift, size = 'sm', class: className }: PurchasedToggleProps = $props();

	const giftsContext = useGifts();

	// Optional, gifter-private self-tracking – only for authenticated reservers holding a reservation.
	const canTrack = $derived(
		giftsContext.isAuthenticated.current && gift.myReservationId !== null,
	);

	// Optimistic override wins until the fresh gift data rides back on the command's
	// single-flight refresh (issue #108); list surfaces re-fetch when next opened.
	let optimistic = $state<boolean | null>(null);
	const purchased = $derived(optimistic ?? gift.myReservationPurchasedAt !== null);
	let isSaving = $state(false);

	async function handleToggle(event: MouseEvent) {
		event.stopPropagation();
		if (gift.myReservationId === null || isSaving) {
			return;
		}
		const next = !purchased;
		optimistic = next;
		isSaving = true;
		try {
			await setReservationPurchased({ reservationId: gift.myReservationId, purchased: next });
			toastSuccess(next ? m.toast_marked_bought() : m.toast_unmarked_bought());
		} catch {
			optimistic = !next;
			toastError(m.toast_bought_error());
		} finally {
			isSaving = false;
		}
	}
</script>

{#if canTrack}
	<Button
		{size}
		intent={purchased ? 'primary' : 'outline'}
		disabled={isSaving}
		aria-pressed={purchased}
		aria-label={purchased ? m.gift_bought() : m.gift_mark_bought()}
		onclick={handleToggle}
		class={className}
	>
		{#if purchased}
			<CheckIcon data-icon="inline-start" />
			{m.gift_bought()}
		{:else}
			<ShoppingBagIcon data-icon="inline-start" />
			{m.gift_mark_bought()}
		{/if}
	</Button>
{/if}
