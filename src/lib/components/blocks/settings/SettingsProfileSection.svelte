<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import { untrack } from 'svelte';
	import UserIcon from '@lucide/svelte/icons/user';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import { getInitials } from '$lib/utils/initials.js';

	interface SettingsProfileSectionProps {
		email: string;
		isOAuthUser: boolean;
		/** Whether a Google account is linked – shows the "use Google photo" action (issue #158). */
		hasGoogleAccount: boolean;
		initialName: string;
		/** Display URL of the current avatar (resolved from the persisted value). */
		initialAvatarUrl: string | null;
		/** Raw persisted `user.image` value (URL or object key) – preserved when the avatar is untouched. */
		initialImageValue: string | null;
		onSave: (params: { name: string; image: string | null }) => Promise<void>;
		/** Pulls the avatar from the linked Google account and persists it (issue #158). */
		onFetchGoogleAvatar: () => Promise<{
			ok: boolean;
			image?: string | null;
			imageUrl?: string | null;
		}>;
	}

	let {
		email,
		isOAuthUser,
		hasGoogleAccount,
		initialName,
		initialAvatarUrl,
		initialImageValue,
		onSave,
		onFetchGoogleAvatar,
	}: SettingsProfileSectionProps = $props();

	// untrack() is intentional: these props seed local editable state once at mount.
	// The local state intentionally diverges from the prop after first render.
	let displayName = $state(untrack(() => initialName));
	let avatarUrl = $state<string | null>(untrack(() => initialAvatarUrl));
	let avatarObjectKey = $state<string | null>(null);
	// Tracks the raw persisted image value so Save preserves it after a Google fetch
	// (which writes directly server-side) instead of reverting to the mount-time value.
	let currentImageValue = $state<string | null>(untrack(() => initialImageValue));
	let saving = $state(false);
	let saved = $state(false);
	let fetchingGoogle = $state(false);
	let googleError = $state(false);

	// Uploads that are not saved yet; replaced/abandoned ones are deleted from
	// storage on save or unmount (issue #107, REQ-6).
	const pendingUploads = createPendingUploads();

	function handleAvatarUpload(result: UploadResult) {
		avatarUrl = result.publicUrl;
		avatarObjectKey = result.objectKey;
		pendingUploads.track(result);
	}

	async function handleFetchGoogleAvatar() {
		fetchingGoogle = true;
		googleError = false;
		try {
			const result = await onFetchGoogleAvatar();
			if (result.ok && result.imageUrl != null && result.imageUrl !== '') {
				// The command already persisted the URL; reflect it locally and keep it
				// as the value a subsequent Save would preserve.
				avatarUrl = result.imageUrl;
				currentImageValue = result.image ?? null;
				avatarObjectKey = null;
			} else {
				googleError = true;
			}
		} catch {
			googleError = true;
		} finally {
			fetchingGoogle = false;
		}
	}

	async function handleSave() {
		saving = true;
		saved = false;
		try {
			// An untouched avatar keeps the raw persisted value (URL or object key)
			// so saving the profile never rewrites it into a resolved URL.
			await onSave({ name: displayName, image: avatarObjectKey ?? currentImageValue });
			await pendingUploads.commit(avatarObjectKey);
			saved = true;
			setTimeout(() => {
				saved = false;
			}, 2000);
		} catch {
			// TODO: toast error
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		return () => {
			void pendingUploads.discardAll();
		};
	});
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center gap-2">
			<UserIcon class="size-5 text-muted-foreground" />
			<div>
				<Card.Title>{m.settings_profile_title()}</Card.Title>
				<Card.Description>{m.settings_profile_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="flex flex-col gap-6">
			<!-- Avatar -->
			<div class="flex flex-col gap-2">
				<Label>{m.settings_avatar_label()}</Label>
				<div class="flex items-center gap-4">
					{#if avatarUrl}
						<ImageFrame
							src={avatarUrl}
							alt={displayName}
							shape="square"
							fitMode="cover-crop"
							referrerPolicy="no-referrer"
							class="size-16 rounded-xl"
						/>
					{:else}
						<span
							class="flex size-16 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary"
						>
							{getInitials(displayName)}
						</span>
					{/if}
					<div class="flex flex-1 flex-col gap-2">
						<ImageUpload target="avatar" size="small" onUpload={handleAvatarUpload} />
						{#if hasGoogleAccount}
							<Button
								intent="outline"
								size="sm"
								class="self-start"
								onclick={handleFetchGoogleAvatar}
								disabled={fetchingGoogle}
							>
								<RefreshCwIcon
									data-icon="inline-start"
									class={fetchingGoogle ? 'animate-spin' : undefined}
								/>
								{fetchingGoogle
									? m.settings_avatar_fetching_google()
									: m.settings_avatar_use_google()}
							</Button>
						{/if}
					</div>
				</div>
				{#if googleError}
					<HelpText state="error" aria-live="polite">
						{m.settings_avatar_google_error()}
					</HelpText>
				{/if}
			</div>

			<Separator />

			<!-- Display name -->
			<div class="flex flex-col gap-2">
				<Label for="settings-display-name">{m.settings_display_name()}</Label>
				<Input
					id="settings-display-name"
					size="lg"
					type="text"
					placeholder={m.settings_display_name_placeholder()}
					bind:value={displayName}
				/>
			</div>

			<!-- Email -->
			<div class="flex flex-col gap-2">
				<Label for="settings-email">{m.settings_email_label()}</Label>
				<Input
					id="settings-email"
					size="lg"
					type="email"
					value={email}
					disabled={isOAuthUser}
					readonly={isOAuthUser}
				/>
				{#if isOAuthUser}
					<HelpText>{m.settings_email_readonly_hint()}</HelpText>
				{/if}
			</div>
		</div>
	</Card.Content>
	<Card.Footer class="flex justify-end">
		<Button size="lg" onclick={handleSave} disabled={saving}>
			{#if saving}
				{m.saving()}
			{:else if saved}
				{m.saved()}
			{:else}
				{m.settings_save_profile()}
			{/if}
		</Button>
	</Card.Footer>
</Card.Root>
