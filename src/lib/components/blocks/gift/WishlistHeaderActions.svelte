<script lang="ts">
	import MoreHorizontalIcon from '@lucide/svelte/icons/ellipsis';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import UsersIcon from '@lucide/svelte/icons/users';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ImageIcon from '@lucide/svelte/icons/image';
	import UserRoundPenIcon from '@lucide/svelte/icons/user-round-pen';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		canManage: boolean;
		settingsAvailable: boolean;
		canShare: boolean;
		canEditImage: boolean;
		canEditRecipient: boolean;
		canArchive: boolean;
		onshare?: () => void;
		onmoderators?: () => void;
		onsettings?: () => void;
		oneditimage?: () => void;
		oneditrecipient?: () => void;
		onarchive?: () => void;
	}

	let {
		canManage,
		settingsAvailable,
		canShare,
		canEditImage,
		canEditRecipient,
		canArchive,
		onshare,
		onmoderators,
		onsettings,
		oneditimage,
		oneditrecipient,
		onarchive,
	}: Props = $props();
	let open = $state(false);

	function run(callback?: () => void) {
		callback?.();
		open = false;
	}
</script>

{#if settingsAvailable || canManage}
	<div class="flex shrink-0 items-center gap-1.5" data-testid="wishlist-header-actions">
		{#if settingsAvailable}
			<Button
				size="icon"
				intent="secondary"
				class="size-10 shrink-0"
				aria-label={m.wishlist_settings_title()}
				title={m.wishlist_settings_title()}
				onclick={onsettings}
			>
				<SettingsIcon />
			</Button>
		{/if}
		{#if canManage}
			<div class="hidden sm:block">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								intent="secondary"
								class="size-10 shrink-0"
								data-testid="desktop-header-more-trigger"
								aria-label={m.gift_more_actions()}
							>
								<MoreHorizontalIcon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						align="end"
						aria-label={m.gift_more_actions()}
						preventScroll={false}
					>
						{#if canShare}<DropdownMenu.Item onclick={onshare}
								><ShareIcon />{m.wishlist_share_button()}</DropdownMenu.Item
							>{/if}
						<DropdownMenu.Item onclick={onmoderators}
							><UsersIcon />{m.wishlist_moderators_label()}</DropdownMenu.Item
						>
						{#if canEditImage}<DropdownMenu.Item onclick={oneditimage}
								><ImageIcon />{m.wishlist_edit_image_label()}</DropdownMenu.Item
							>{/if}
						{#if canEditRecipient}<DropdownMenu.Item onclick={oneditrecipient}
								><UserRoundPenIcon
								/>{m.wishlist_edit_recipient_label()}</DropdownMenu.Item
							>{/if}
						{#if canArchive}
							<DropdownMenu.Separator />
							<DropdownMenu.Item class="text-destructive" onclick={onarchive}
								><ArchiveIcon />{m.wishlist_archive_button()}</DropdownMenu.Item
							>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
			<div class="sm:hidden">
				<Sheet.Root bind:open>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								intent="secondary"
								class="size-10 shrink-0"
								data-testid="mobile-header-more-trigger"
								aria-label={m.gift_more_actions()}
							>
								<MoreHorizontalIcon />
							</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content
						side="bottom"
						class="max-h-[80dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
					>
						<Sheet.Header>
							<Sheet.Title>{m.gift_more_actions()}</Sheet.Title>
							<Sheet.Description
								>{m.wishlist_more_actions_description()}</Sheet.Description
							>
						</Sheet.Header>
						<div class="mt-3 flex flex-col">
							{#if canShare}
								<Button
									intent="ghost"
									class="min-h-11 w-full"
									surfaceClass="justify-start"
									onclick={() => run(onshare)}
								>
									<ShareIcon
										data-icon="inline-start"
									/>{m.wishlist_share_button()}
								</Button>
							{/if}
							<Button
								intent="ghost"
								class="min-h-11 w-full"
								surfaceClass="justify-start"
								onclick={() => run(onmoderators)}
							>
								<UsersIcon
									data-icon="inline-start"
								/>{m.wishlist_moderators_label()}
							</Button>
							{#if canEditImage}
								<Button
									intent="ghost"
									class="min-h-11 w-full"
									surfaceClass="justify-start"
									onclick={() => run(oneditimage)}
								>
									<ImageIcon
										data-icon="inline-start"
									/>{m.wishlist_edit_image_label()}
								</Button>
							{/if}
							{#if canEditRecipient}
								<Button
									intent="ghost"
									class="min-h-11 w-full"
									surfaceClass="justify-start"
									onclick={() => run(oneditrecipient)}
								>
									<UserRoundPenIcon
										data-icon="inline-start"
									/>{m.wishlist_edit_recipient_label()}
								</Button>
							{/if}
						</div>
						{#if canArchive}
							<div
								class="mt-2 border-t border-border pt-2"
								data-testid="wishlist-header-danger-actions"
							>
								<Button
									intent="ghost"
									class="min-h-11 w-full"
									surfaceClass="justify-start text-destructive"
									onclick={() => run(onarchive)}
								>
									<ArchiveIcon
										data-icon="inline-start"
									/>{m.wishlist_archive_button()}
								</Button>
							</div>
						{/if}
					</Sheet.Content>
				</Sheet.Root>
			</div>
		{/if}
	</div>
{/if}
