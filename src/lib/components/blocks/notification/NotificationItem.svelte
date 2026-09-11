<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import type { Notification } from '$lib/modules/notifications/types.js';
	import { formatRelativeTime } from '$lib/modules/notifications/notification_display.js';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import BookmarkCheckIcon from '@lucide/svelte/icons/bookmark-check';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import BookmarkXIcon from '@lucide/svelte/icons/bookmark-x';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { Button } from '$lib/components/base/button/index.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { WISHLIST_GIFT_QUERY_PARAM } from '$lib/modules/wishlists/wishlist_query_params.js';
	import { cn } from '$lib/utils.js';

	interface NotificationItemProps {
		notification: Notification;
		onMarkAsRead: (id: string) => void;
	}

	let { notification, onMarkAsRead }: NotificationItemProps = $props();

	const ICON_MAP = {
		liked_gift_reserved: HeartIcon,
		reserved_gift_edited: PencilIcon,
		wishlist_archived: ArchiveIcon,
		owner_self_promoted: ShieldIcon,
		new_gift_added: GiftIcon,
		gift_reserved: BookmarkCheckIcon,
		moderator_invited: UserPlusIcon,
		claim_invited: LinkIcon,
		recipient_claimed: UserCheckIcon,
		reservation_cancelled: BookmarkXIcon,
	} as const;

	const IconComponent = $derived(ICON_MAP[notification.type] ?? BellIcon);

	const relativeTime = $derived(formatRelativeTime(notification.createdAt));

	function handleClick() {
		if (!notification.read) {
			onMarkAsRead(notification.id);
		}

		if (notification.href != null) {
			void goto(localizeInternalHref(notification.href));
			return;
		}
		// Legacy rows navigate by the wishlist's shortId, never its database UUID.
		if (notification.wishlistShortId == null || notification.wishlistShortId === '') {
			return;
		}
		const path = resolve('/(app)/w/[id]', { id: notification.wishlistShortId });
		const href =
			notification.giftId !== null && notification.giftId !== ''
				? `${path}?${WISHLIST_GIFT_QUERY_PARAM}=${notification.giftId}`
				: path;
		void goto(localizeInternalHref(href));
	}
</script>

<!-- Flexible-height exception: notification copy and digest details must wrap naturally. -->
<Button
	intent="ghost"
	class="flex h-auto w-full"
	surfaceClass={cn(
		'items-start gap-3 px-3 py-2.5 text-left transition-colors group-hover:bg-accent',
		!notification.read && 'bg-tint',
	)}
	onclick={handleClick}
>
	<!-- Icon: tilted sticker tile, filled while unread -->
	<span
		class={cn(
			'mt-0.5 flex size-8 shrink-0 -rotate-3 items-center justify-center rounded-[9px] border-2 border-ink',
			notification.read
				? 'bg-surface text-muted-foreground'
				: 'bg-primary text-primary-foreground',
		)}
	>
		<IconComponent class="size-4" />
	</span>

	<!-- Content -->
	<div class="flex min-w-0 flex-1 flex-col gap-0.5">
		<p
			class={cn(
				'whitespace-normal break-words text-sm leading-snug',
				!notification.read && 'font-semibold',
			)}
		>
			{notification.message}
		</p>
		{#if notification.digest}
			<ul class="space-y-0.5 text-xs text-muted-foreground">
				{#each notification.digest.wishlists as item (item.wishlistId)}
					<li class="whitespace-normal break-words">
						{item.title}: {item.count}{#if item.namePreviews.length > 0}
							<span> · {item.namePreviews.join(', ')}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else if notification.actorName}
			<p class="whitespace-normal break-words text-xs text-muted-foreground">
				{notification.actorName}
			</p>
		{/if}
		<p class="truncate text-xs text-muted-foreground">{relativeTime}</p>
	</div>

	<!-- Unread dot -->
	{#if !notification.read}
		<span
			class="mt-2 size-2.5 shrink-0 rounded-full border-2 border-ink bg-primary"
			aria-label={m.notification_unread()}
		></span>
	{/if}
</Button>
