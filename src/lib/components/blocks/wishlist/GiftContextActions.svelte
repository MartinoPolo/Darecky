<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import BookmarkXIcon from '@lucide/svelte/icons/bookmark-x';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import WishlistSheetAction from './WishlistSheetAction.svelte';
	import WishlistSheetBody from './WishlistSheetBody.svelte';
	import WishlistSheetHeader from './WishlistSheetHeader.svelte';
	import { giftContextActions } from '$lib/modules/gifts/gift_context_actions.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Choice {
		id: string;
		label: string;
	}
	interface Props {
		open: boolean;
		mobile: boolean;
		anchorPoint?: { x: number; y: number };
		name: string;
		role: WishlistRole;
		primaryUrl: string | null;
		readOnly: boolean;
		received: boolean;
		canReserve?: boolean;
		ownsReservation?: boolean;
		canTrackPurchased?: boolean;
		purchased?: boolean;
		priorityReady?: boolean;
		categoryReady?: boolean;
		priorityLevels: Choice[];
		categories: Choice[];
		priorityLevelId: string | null;
		categoryId: string | null;
		onclose: () => void;
		onedit: () => void;
		onpriority: (id: string | null) => void;
		oncategory: (id: string | null) => void;
		onreceived: () => void;
		onselect: () => void;
		onreserve?: () => void;
		oncancelreservation?: () => void;
		onpurchased?: () => void;
		oncopysuccess?: () => void;
		oncopyerror?: () => void;
	}
	let {
		open,
		mobile,
		anchorPoint = { x: 0, y: 0 },
		name,
		role,
		primaryUrl,
		readOnly,
		received,
		canReserve = false,
		ownsReservation = false,
		canTrackPurchased = false,
		purchased = false,
		priorityReady = false,
		categoryReady = false,
		priorityLevels,
		categories,
		priorityLevelId,
		categoryId,
		onclose,
		onedit,
		onpriority,
		oncategory,
		onreceived,
		onselect,
		onreserve,
		oncancelreservation,
		onpurchased,
		oncopysuccess,
		oncopyerror,
	}: Props = $props();
	const safePrimaryUrl = $derived(normalizeGiftUrl(primaryUrl));
	const desktopAnchor = $derived({
		getBoundingClientRect: () =>
			DOMRect.fromRect({ x: anchorPoint.x, y: anchorPoint.y, width: 0, height: 0 }),
	});
	const actions = $derived(
		giftContextActions({
			role,
			primaryUrl: safePrimaryUrl,
			readOnly,
			canEdit: true,
			canReserve,
			ownsReservation,
			canTrackPurchased,
		}),
	);
	let mobileScreen = $state<'main' | 'priority' | 'category'>('main');

	function has(action: (typeof actions)[number]) {
		return actions.includes(action);
	}
	function finish(callback: () => void) {
		callback();
		onclose();
	}
	async function copyLink() {
		if (safePrimaryUrl === null) {
			return;
		}
		try {
			await navigator.clipboard.writeText(safePrimaryUrl);
			oncopysuccess?.();
		} catch {
			oncopyerror?.();
		}
		onclose();
	}
	function handleOpenChange(value: boolean) {
		if (!value) {
			mobileScreen = 'main';
			onclose();
		}
	}
</script>

{#snippet icon(
	action:
		| 'open'
		| 'copy'
		| 'edit'
		| 'received'
		| 'multiselect'
		| 'reserve'
		| 'cancel-reservation'
		| 'purchased',
)}
	{#if action === 'open'}<ExternalLinkIcon />{:else if action === 'copy'}<CopyIcon
		/>{:else if action === 'edit'}<PencilIcon />{:else if action === 'received'}<CheckIcon
		/>{:else if action === 'reserve'}<BookmarkIcon
		/>{:else if action === 'cancel-reservation'}<BookmarkXIcon
		/>{:else if action === 'purchased'}<ShoppingBagIcon />{:else}<ListChecksIcon />{/if}
{/snippet}

{#if mobile}
	<Sheet.Root {open} onOpenChange={handleOpenChange}>
		<WishlistBottomSheet>
			<WishlistSheetHeader>
				<Sheet.Title
					>{mobileScreen === 'main'
						? name
						: mobileScreen === 'priority'
							? m.gift_priority_label()
							: m.gift_context_category()}</Sheet.Title
				>
				<Sheet.Description>{m.gift_context_actions_description()}</Sheet.Description>
			</WishlistSheetHeader>
			<WishlistSheetBody class="flex flex-col" data-mobile-screen={mobileScreen}>
				{#if mobileScreen !== 'main'}
					<WishlistSheetAction onclick={() => (mobileScreen = 'main')}
						><ChevronLeftIcon />{m.gift_context_back()}</WishlistSheetAction
					>
					{#each [{ id: null, label: mobileScreen === 'priority' ? m.gift_priority_none() : m.gift_category_uncategorized() }, ...(mobileScreen === 'priority' ? priorityLevels : categories)] as choice (choice.id)}
						<WishlistSheetAction
							onclick={() =>
								finish(() =>
									mobileScreen === 'priority'
										? onpriority(choice.id)
										: oncategory(choice.id),
								)}
						>
							<span class="flex size-5 shrink-0 items-center justify-center"
								>{#if (mobileScreen === 'priority' ? priorityLevelId : categoryId) === choice.id}<CheckIcon
										class="size-4"
									/>{/if}</span
							>{choice.label}
						</WishlistSheetAction>
					{/each}
				{:else}
					{#if has('open')}<WishlistSheetAction
							href={safePrimaryUrl!}
							target="_blank"
							rel="external noopener noreferrer"
							onclick={onclose}
							>{@render icon('open')}{m.gift_context_open_link()}</WishlistSheetAction
						>{/if}
					{#if has('copy')}<WishlistSheetAction onclick={copyLink}
							>{@render icon('copy')}{m.gift_context_copy_link()}</WishlistSheetAction
						>{/if}
					{#if has('edit')}<WishlistSheetAction onclick={() => finish(onedit)}
							>{@render icon('edit')}{m.gift_context_edit()}</WishlistSheetAction
						>{/if}
					{#if has('priority')}<WishlistSheetAction
							indent
							disabled={!priorityReady}
							onclick={() => (mobileScreen = 'priority')}
							>{priorityReady
								? m.gift_priority_label()
								: `${m.gift_priority_label()}: ${m.moderator_loading()}`}</WishlistSheetAction
						>{/if}
					{#if has('category')}<WishlistSheetAction
							indent
							disabled={!categoryReady}
							onclick={() => (mobileScreen = 'category')}
							>{categoryReady
								? m.gift_context_category()
								: `${m.gift_context_category()}: ${m.moderator_loading()}`}</WishlistSheetAction
						>{/if}
					{#if has('received')}<WishlistSheetAction onclick={() => finish(onreceived)}
							>{@render icon('received')}{received
								? m.gift_mark_unreceived()
								: m.gift_mark_received()}</WishlistSheetAction
						>{/if}
					{#if has('multiselect')}<WishlistSheetAction onclick={() => finish(onselect)}
							>{@render icon(
								'multiselect',
							)}{m.gift_context_select_multiple()}</WishlistSheetAction
						>{/if}
					{#if has('reserve') && onreserve}<WishlistSheetAction
							onclick={() => finish(onreserve)}
							>{@render icon(
								'reserve',
							)}{m.reserve_button_reserve()}</WishlistSheetAction
						>{/if}
					{#if has('cancel-reservation') && oncancelreservation}<WishlistSheetAction
							onclick={() => finish(oncancelreservation)}
							>{@render icon(
								'cancel-reservation',
							)}{m.reserve_button_cancel()}</WishlistSheetAction
						>{/if}
					{#if has('purchased') && onpurchased}<WishlistSheetAction
							aria-pressed={purchased}
							onclick={() => finish(onpurchased)}
							>{@render icon('purchased')}{purchased
								? m.gift_bought()
								: m.gift_mark_bought()}</WishlistSheetAction
						>{/if}
				{/if}
			</WishlistSheetBody>
		</WishlistBottomSheet>
	</Sheet.Root>
{:else}
	<!-- Keep the Bits primitive mounted while closed. Context menus position from the triggering
	     pointer event; conditionally creating Content after that event loses its virtual anchor. -->
	<ContextMenu.Content class="w-64" customAnchor={desktopAnchor}>
		{#if has('open')}<ContextMenu.Item
				onSelect={() =>
					finish(() => window.open(safePrimaryUrl!, '_blank', 'noopener,noreferrer'))}
				><ExternalLinkIcon />{m.gift_context_open_link()}</ContextMenu.Item
			>{/if}
		{#if has('copy')}<ContextMenu.Item onSelect={() => void copyLink()}
				><CopyIcon />{m.gift_context_copy_link()}</ContextMenu.Item
			>{/if}
		{#if (has('open') || has('copy')) && has('edit')}<ContextMenu.Separator />{/if}
		{#if has('edit')}<ContextMenu.Item onSelect={() => finish(onedit)}
				><PencilIcon />{m.gift_context_edit()}</ContextMenu.Item
			>{/if}
		{#if has('priority')}
			<ContextMenu.Sub
				><ContextMenu.SubTrigger disabled={!priorityReady}
					>{priorityReady
						? m.gift_priority_label()
						: `${m.gift_priority_label()}: ${m.moderator_loading()}`}</ContextMenu.SubTrigger
				><ContextMenu.SubContent>
					<ContextMenu.RadioGroup
						value={priorityLevelId ?? ''}
						onValueChange={(id) => finish(() => onpriority(id === '' ? null : id))}
					>
						<ContextMenu.RadioItem value=""
							>{m.gift_priority_none()}</ContextMenu.RadioItem
						>
						{#each priorityLevels as choice (choice.id)}<ContextMenu.RadioItem
								value={choice.id}>{choice.label}</ContextMenu.RadioItem
							>{/each}
					</ContextMenu.RadioGroup>
				</ContextMenu.SubContent></ContextMenu.Sub
			>
		{/if}
		{#if has('category')}
			<ContextMenu.Sub
				><ContextMenu.SubTrigger disabled={!categoryReady}
					>{categoryReady
						? m.gift_context_category()
						: `${m.gift_context_category()}: ${m.moderator_loading()}`}</ContextMenu.SubTrigger
				><ContextMenu.SubContent>
					<ContextMenu.RadioGroup
						value={categoryId ?? ''}
						onValueChange={(id) => finish(() => oncategory(id === '' ? null : id))}
					>
						<ContextMenu.RadioItem value=""
							>{m.gift_category_uncategorized()}</ContextMenu.RadioItem
						>
						{#each categories as choice (choice.id)}<ContextMenu.RadioItem
								value={choice.id}>{choice.label}</ContextMenu.RadioItem
							>{/each}
					</ContextMenu.RadioGroup>
				</ContextMenu.SubContent></ContextMenu.Sub
			>
		{/if}
		{#if has('received')}<ContextMenu.Item onSelect={() => finish(onreceived)}
				><CheckIcon />{received
					? m.gift_mark_unreceived()
					: m.gift_mark_received()}</ContextMenu.Item
			>{/if}
		{#if has('multiselect')}<ContextMenu.Separator /><ContextMenu.Item
				onSelect={() => finish(onselect)}
				><ListChecksIcon />{m.gift_context_select_multiple()}</ContextMenu.Item
			>{/if}
		{#if has('reserve') && onreserve}<ContextMenu.Item onSelect={() => finish(onreserve)}
				><BookmarkIcon />{m.reserve_button_reserve()}</ContextMenu.Item
			>{/if}
		{#if has('cancel-reservation') && oncancelreservation}<ContextMenu.Item
				onSelect={() => finish(oncancelreservation)}
				><BookmarkXIcon />{m.reserve_button_cancel()}</ContextMenu.Item
			>{/if}
		{#if has('purchased') && onpurchased}<ContextMenu.Item onSelect={() => finish(onpurchased)}
				><ShoppingBagIcon />{purchased
					? m.gift_bought()
					: m.gift_mark_bought()}</ContextMenu.Item
			>{/if}
	</ContextMenu.Content>
{/if}
