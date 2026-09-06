<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import {
		ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES,
		CIRCULAR_STICKER_SURFACE_CLASSES,
	} from '$lib/components/base/button/button_variants.js';
	import { Avatar } from '$lib/components/derived/avatar/index.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { authClient } from '$lib/auth_client.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';

	interface UserMenuProps {
		userName: string;
		userEmail: string;
		userInitials: string;
		userImage?: string | null;
	}

	let { userName, userEmail, userInitials, userImage = null }: UserMenuProps = $props();

	async function handleSignOut() {
		try {
			await authClient.signOut();
		} finally {
			window.location.href = localizeInternalHref(resolve('/'));
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="ghost"
				size="icon"
				class={`rounded-full ${ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES}`}
				surfaceClass={`border-[2.5px] border-ink bg-card group-hover:bg-card ${CIRCULAR_STICKER_SURFACE_CLASSES}`}
				aria-label={m.nav_user_menu({ name: userName })}
			>
				<Avatar
					src={userImage}
					alt=""
					initials={userInitials}
					size="sm"
					class="size-[calc(100%-5px)] rounded-full"
				/>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-52">
		<DropdownMenu.Label class="flex flex-col gap-0.5 font-normal">
			<span class="text-sm font-semibold">{userName}</span>
			<span class="text-xs text-muted-foreground">{userEmail}</span>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={() => goto(localizeInternalHref(resolve('/settings')))}>
				<SettingsIcon data-icon="inline-start" />
				{m.nav_settings()}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item variant="destructive" onclick={handleSignOut}>
				<LogOutIcon data-icon="inline-start" />
				{m.nav_logout()}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
