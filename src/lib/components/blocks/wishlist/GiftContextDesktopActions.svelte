<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import BookmarkXIcon from '@lucide/svelte/icons/bookmark-x';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
	import type { GiftContextFinishPolicy } from './gift_context_invocation.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Choice {
		id: string;
		label: string;
	}
	interface Props {
		kind: 'context' | 'dropdown';
		actions: GiftContextAction[];
		safePrimaryUrl: string | null;
		received: boolean;
		purchased: boolean;
		priorityReady: boolean;
		categoryReady: boolean;
		priorityLevels: Choice[];
		categories: Choice[];
		priorityLevelId: string | null;
		categoryId: string | null;
		onfinish: (policy: GiftContextFinishPolicy, callback: () => void) => void;
		oncopy: () => void;
		onedit: () => void;
		onpriority: (id: string | null) => void;
		oncategory: (id: string | null) => void;
		onreceived: () => void;
		onselect: () => void;
		onreserve?: () => void;
		oncancelreservation?: () => void;
		onpurchased?: () => void;
	}
	let {
		kind,
		actions,
		safePrimaryUrl,
		received,
		purchased,
		priorityReady,
		categoryReady,
		priorityLevels,
		categories,
		priorityLevelId,
		categoryId,
		onfinish,
		oncopy,
		onedit,
		onpriority,
		oncategory,
		onreceived,
		onselect,
		onreserve,
		oncancelreservation,
		onpurchased,
	}: Props = $props();
	const has = (action: GiftContextAction) => actions.includes(action);
	const Item = $derived(kind === 'dropdown' ? DropdownMenu.Item : ContextMenu.Item);
	const Separator = $derived(
		kind === 'dropdown' ? DropdownMenu.Separator : ContextMenu.Separator,
	);
	const Sub = $derived(kind === 'dropdown' ? DropdownMenu.Sub : ContextMenu.Sub);
	const SubTrigger = $derived(
		kind === 'dropdown' ? DropdownMenu.SubTrigger : ContextMenu.SubTrigger,
	);
	const SubContent = $derived(
		kind === 'dropdown' ? DropdownMenu.SubContent : ContextMenu.SubContent,
	);
	const RadioGroup = $derived(
		kind === 'dropdown' ? DropdownMenu.RadioGroup : ContextMenu.RadioGroup,
	);
	const RadioItem = $derived(
		kind === 'dropdown' ? DropdownMenu.RadioItem : ContextMenu.RadioItem,
	);
</script>

{#if has('open')}<Item
		onSelect={() =>
			onfinish('restore-focus', () =>
				window.open(safePrimaryUrl!, '_blank', 'noopener,noreferrer'),
			)}><ExternalLinkIcon />{m.gift_context_open_link()}</Item
	>{/if}
{#if has('copy')}<Item onSelect={oncopy}><CopyIcon />{m.gift_context_copy_link()}</Item>{/if}
{#if (has('open') || has('copy')) && has('edit')}<Separator />{/if}
{#if has('edit')}<Item onSelect={() => onfinish('handoff', onedit)}
		><PencilIcon />{m.gift_context_edit()}</Item
	>{/if}
{#if has('priority')}
	<Sub
		><SubTrigger disabled={!priorityReady}
			>{priorityReady
				? m.gift_priority_label()
				: `${m.gift_priority_label()}: ${m.moderator_loading()}`}</SubTrigger
		>
		<SubContent
			><RadioGroup
				value={priorityLevelId ?? ''}
				onValueChange={(id) =>
					onfinish('restore-focus', () => onpriority(id === '' ? null : id))}
			>
				<RadioItem value="">{m.gift_priority_none()}</RadioItem>
				{#each priorityLevels as choice (choice.id)}<RadioItem value={choice.id}
						>{choice.label}</RadioItem
					>{/each}
			</RadioGroup></SubContent
		>
	</Sub>
{/if}
{#if has('category')}
	<Sub
		><SubTrigger disabled={!categoryReady}
			>{categoryReady
				? m.gift_context_category()
				: `${m.gift_context_category()}: ${m.moderator_loading()}`}</SubTrigger
		>
		<SubContent
			><RadioGroup
				value={categoryId ?? ''}
				onValueChange={(id) =>
					onfinish('restore-focus', () => oncategory(id === '' ? null : id))}
			>
				<RadioItem value="">{m.gift_category_uncategorized()}</RadioItem>
				{#each categories as choice (choice.id)}<RadioItem value={choice.id}
						>{choice.label}</RadioItem
					>{/each}
			</RadioGroup></SubContent
		>
	</Sub>
{/if}
{#if has('received')}<Item onSelect={() => onfinish('restore-focus', onreceived)}
		><CheckIcon />{received ? m.gift_mark_unreceived() : m.gift_mark_received()}</Item
	>{/if}
{#if has('multiselect')}<Separator /><Item onSelect={() => onfinish('handoff', onselect)}
		><ListChecksIcon />{m.gift_context_select_multiple()}</Item
	>{/if}
{#if has('reserve') && onreserve}<Item onSelect={() => onfinish('handoff', onreserve!)}
		><BookmarkIcon />{m.reserve_button_reserve()}</Item
	>{/if}
{#if has('cancel-reservation') && oncancelreservation}<Item
		onSelect={() => onfinish('restore-focus', oncancelreservation!)}
		><BookmarkXIcon />{m.reserve_button_cancel()}</Item
	>{/if}
{#if has('purchased') && onpurchased}<Item onSelect={() => onfinish('restore-focus', onpurchased!)}
		><ShoppingBagIcon />{purchased ? m.gift_bought() : m.gift_mark_bought()}</Item
	>{/if}
