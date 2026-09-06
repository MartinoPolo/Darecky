<script lang="ts">
	import { tick } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';

	interface Props {
		giftId: string;
		received: boolean;
		role: WishlistRole;
		isArchived?: boolean;
		size?: 'md' | 'sm';
		class?: string;
		surfaceClass?: string;
		onreceived?: (giftId: string, received: boolean) => void | Promise<void>;
	}

	let {
		giftId,
		received,
		role,
		isArchived = false,
		size = 'md',
		class: className,
		surfaceClass,
		onreceived,
	}: Props = $props();

	const visible = $derived(canManageWishlist(role) && !isArchived && onreceived !== undefined);
	let pending = $state(false);
	let action: HTMLButtonElement | HTMLAnchorElement | null = $state(null);

	async function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (onreceived === undefined || pending) {
			return;
		}
		pending = true;
		try {
			await onreceived(giftId, !received);
		} finally {
			pending = false;
			await tick();
			if (action !== null && action.isConnected) {
				action.focus({ preventScroll: true });
			}
		}
	}
</script>

{#if visible}
	<Button
		bind:ref={action}
		{size}
		intent="primary"
		class={className}
		{surfaceClass}
		onclick={handleClick}
		disabled={pending}
		data-testid="gift-received-toggle"
		data-gift-received-action={giftId}
	>
		<CheckIcon data-icon="inline-start" />
		{received ? m.gift_mark_unreceived() : m.gift_mark_received()}
	</Button>
{/if}
