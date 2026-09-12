<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import BookmarkXIcon from '@lucide/svelte/icons/bookmark-x';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import WishlistSheetAction from './WishlistSheetAction.svelte';
	import WishlistSheetBody from './WishlistSheetBody.svelte';
	import WishlistSheetHeader from './WishlistSheetHeader.svelte';
	import GiftContextDesktopActions from './GiftContextDesktopActions.svelte';
	import { giftContextActions } from '$lib/modules/gifts/gift_context_actions.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftContextFinishPolicy } from './gift_context_invocation.js';

	interface Choice {
		id: string;
		label: string;
	}
	interface Props {
		sessionId: number;
		programmaticOpen: boolean;
		mobile: boolean;
		desktopAnchor?: HTMLButtonElement | null;
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
		oncomplete: (sessionId: number) => void;
		onfinish: (policy: GiftContextFinishPolicy, callback: () => void) => void;
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
		sessionId,
		programmaticOpen,
		mobile,
		desktopAnchor = null,
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
		oncomplete,
		onfinish,
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
	const nativePointerAnchor = $derived({
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
	const nestedActionSurfaceClass = 'grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem]';
	let mobileScreen = $state<'main' | 'priority' | 'category'>('main');
	let openedSessionId = $state(0);

	$effect(() => {
		if (programmaticOpen) {
			openedSessionId = sessionId;
		}
	});

	function has(action: (typeof actions)[number]) {
		return actions.includes(action);
	}
	function finish(policy: GiftContextFinishPolicy, callback: () => void) {
		onfinish(policy, callback);
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
	function handleCloseAutoFocus(event: Event) {
		// The page session owns all completed-close focus and handoff behavior.
		event.preventDefault();
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
	<Sheet.Root
		open={programmaticOpen}
		onOpenChange={handleOpenChange}
		onOpenChangeComplete={(value) => {
			if (value === false) oncomplete(openedSessionId);
		}}
	>
		<WishlistBottomSheet onCloseAutoFocus={handleCloseAutoFocus}>
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
								finish('restore-focus', () =>
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
					{#if has('edit')}<WishlistSheetAction onclick={() => finish('handoff', onedit)}
							>{@render icon('edit')}{m.gift_context_edit()}</WishlistSheetAction
						>{/if}
					{#if has('priority')}<WishlistSheetAction
							indent
							surfaceClass={nestedActionSurfaceClass}
							disabled={!priorityReady}
							onclick={() => (mobileScreen = 'priority')}
							>{priorityReady
								? m.gift_priority_label()
								: `${m.gift_priority_label()}: ${m.moderator_loading()}`}<ChevronRightIcon
								aria-hidden="true"
							/></WishlistSheetAction
						>{/if}
					{#if has('category')}<WishlistSheetAction
							indent
							surfaceClass={nestedActionSurfaceClass}
							disabled={!categoryReady}
							onclick={() => (mobileScreen = 'category')}
							>{categoryReady
								? m.gift_context_category()
								: `${m.gift_context_category()}: ${m.moderator_loading()}`}<ChevronRightIcon
								aria-hidden="true"
							/></WishlistSheetAction
						>{/if}
					{#if has('received')}<WishlistSheetAction
							onclick={() => finish('restore-focus', onreceived)}
							>{@render icon('received')}{received
								? m.gift_mark_unreceived()
								: m.gift_mark_received()}</WishlistSheetAction
						>{/if}
					{#if has('multiselect')}<WishlistSheetAction
							onclick={() => finish('handoff', onselect)}
							>{@render icon(
								'multiselect',
							)}{m.gift_context_select_multiple()}</WishlistSheetAction
						>{/if}
					{#if has('reserve') && onreserve}<WishlistSheetAction
							onclick={() => finish('handoff', onreserve)}
							>{@render icon(
								'reserve',
							)}{m.reserve_button_reserve()}</WishlistSheetAction
						>{/if}
					{#if has('cancel-reservation') && oncancelreservation}<WishlistSheetAction
							onclick={() => finish('restore-focus', oncancelreservation)}
							>{@render icon(
								'cancel-reservation',
							)}{m.reserve_button_cancel()}</WishlistSheetAction
						>{/if}
					{#if has('purchased') && onpurchased}<WishlistSheetAction
							aria-pressed={purchased}
							onclick={() => finish('restore-focus', onpurchased)}
							>{@render icon('purchased')}{purchased
								? m.gift_bought()
								: m.gift_mark_bought()}</WishlistSheetAction
						>{/if}
				{/if}
			</WishlistSheetBody>
		</WishlistBottomSheet>
	</Sheet.Root>
{:else}
	<!-- Keep both desktop content hosts mounted through their complete close lifecycle. -->
	<DropdownMenu.Root
		open={programmaticOpen}
		onOpenChange={handleOpenChange}
		onOpenChangeComplete={(value) => {
			if (value === false) oncomplete(openedSessionId);
		}}
	>
		<DropdownMenu.Content
			class="w-64"
			customAnchor={desktopAnchor}
			onCloseAutoFocus={handleCloseAutoFocus}
		>
			<GiftContextDesktopActions
				kind="dropdown"
				{actions}
				{safePrimaryUrl}
				{received}
				{purchased}
				{priorityReady}
				{categoryReady}
				{priorityLevels}
				{categories}
				{priorityLevelId}
				{categoryId}
				onfinish={finish}
				oncopy={() => void copyLink()}
				{onedit}
				{onpriority}
				{oncategory}
				{onreceived}
				{onselect}
				{onreserve}
				{oncancelreservation}
				{onpurchased}
			/>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
	<ContextMenu.Content
		class="w-64"
		customAnchor={nativePointerAnchor}
		onCloseAutoFocus={(event) => {
			// Native context invocation preserves the browser/context-menu focus contract.
			event.preventDefault();
		}}
	>
		<GiftContextDesktopActions
			kind="context"
			{actions}
			{safePrimaryUrl}
			{received}
			{purchased}
			{priorityReady}
			{categoryReady}
			{priorityLevels}
			{categories}
			{priorityLevelId}
			{categoryId}
			onfinish={finish}
			oncopy={() => void copyLink()}
			{onedit}
			{onpriority}
			{oncategory}
			{onreceived}
			{onselect}
			{onreserve}
			{oncancelreservation}
			{onpurchased}
		/>
	</ContextMenu.Content>
{/if}
