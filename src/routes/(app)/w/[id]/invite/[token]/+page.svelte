<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { acceptModeratorInvite } from '$lib/modules/moderators/moderators.remote.js';
	import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { toastSuccess } from '$lib/components/base/toast/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { onMount } from 'svelte';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import LogInIcon from '@lucide/svelte/icons/log-in';

	// Marker appended to the post-auth redirect target so we know the freshly
	// authenticated visitor came back to auto-accept the invite.
	const AUTOACCEPT_PARAM = 'autoaccept';

	const wishlistData = await getWishlistByShortId(page.params.id!);
	const token = page.params.token!;

	// The invite route is public, so anonymous visitors reach this page. When
	// logged out we send them to auth first, then auto-accept on their return.
	const isAuthenticated = $derived(page.data.user != null);
	const shouldAutoAccept = $derived(page.url.searchParams.get(AUTOACCEPT_PARAM) === '1');

	// Localised invite path with the auto-accept marker, so returning from auth
	// lands back here and accepts automatically. Localise the bare path first,
	// then append the marker query (matching the layout redirect convention).
	const inviteReturnHref = `${localizeInternalHref(
		resolve('/(app)/w/[id]/invite/[token]', {
			id: page.params.id!,
			token,
		}),
	)}?${AUTOACCEPT_PARAM}=1`;

	const registerHref = `${localizeInternalHref(resolve('/register'))}?${new URLSearchParams({
		redirect: inviteReturnHref,
	})}`;
	const loginHref = `${localizeInternalHref(resolve('/login'))}?${new URLSearchParams({
		redirect: inviteReturnHref,
	})}`;

	let isAccepting = $state(false);
	let errorMessage = $state<string | null>(null);
	let accepted = $state(false);
	let isHydrated = $state(false);

	// Fire-once guard so the auto-accept-on-return never runs twice (e.g. if the
	// mount effect re-evaluates or the user reloads mid-flow).
	let hasAutoAccepted = false;

	async function handleAccept() {
		isAccepting = true;
		errorMessage = null;
		try {
			const result = await acceptModeratorInvite({ token });
			accepted = true;
			toastSuccess(m.invite_toast_accepted());
			// Redirect to the wishlist after a short delay
			setTimeout(() => {
				void goto(
					localizeInternalHref(resolve('/(app)/w/[id]', { id: result.wishlistShortId })),
				);
			}, 1500);
		} catch (thrown) {
			errorMessage = translateServerError(thrown, m.invite_error_generic());
		} finally {
			isAccepting = false;
		}
	}

	onMount(() => {
		isHydrated = true;
		if (isAuthenticated && shouldAutoAccept && !hasAutoAccepted) {
			hasAutoAccepted = true;
			void handleAccept();
		}
	});
</script>

<div class="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16">
	<Card.Root class="w-full">
		<Card.Header class="text-center">
			<div
				class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10"
			>
				{#if accepted}
					<CheckIcon class="size-7 text-primary" />
				{:else if errorMessage !== null}
					<XCircleIcon class="size-7 text-destructive" />
				{:else if !isAuthenticated}
					<LogInIcon class="size-7 text-primary" />
				{:else}
					<UsersIcon class="size-7 text-primary" />
				{/if}
			</div>
			<Card.Title class="text-xl">
				{#if accepted}
					{m.invite_accepted_title()}
				{:else if errorMessage !== null}
					{m.invite_error_title()}
				{:else if !isAuthenticated}
					{m.invite_login_required_title()}
				{:else}
					{m.invite_pending_title()}
				{/if}
			</Card.Title>
			<Card.Description>
				{#if accepted}
					{m.invite_accepted_description({ title: wishlistData.title })}
				{:else if errorMessage !== null}
					{errorMessage}
				{:else if !isAuthenticated}
					{m.invite_login_required_description({
						title: wishlistData.title,
						owner: wishlistData.recipientDisplayName,
					})}
				{:else}
					{m.invite_pending_description({
						title: wishlistData.title,
						owner: wishlistData.recipientDisplayName,
					})}
				{/if}
			</Card.Description>
		</Card.Header>

		{#if !accepted && errorMessage === null}
			<Card.Content class="flex flex-col gap-3">
				<div
					class="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground"
				>
					<p class="font-medium text-foreground">{m.invite_moderator_can()}</p>
					<ul class="mt-2 flex flex-col gap-1">
						<li>{m.invite_can_see_reservations()}</li>
						<li>{m.invite_can_add_gifts()}</li>
						<li>{m.invite_can_manage()}</li>
					</ul>
				</div>
			</Card.Content>

			{#if !isAuthenticated}
				<Card.Footer class="flex flex-col gap-3">
					<Button class="w-full" href={registerHref}>
						{m.invite_register_and_accept()}
					</Button>
					<Button intent="outline" class="w-full" href={loginHref}>
						{m.invite_login_to_accept()}
					</Button>
				</Card.Footer>
			{:else}
				<Card.Footer class="flex justify-center gap-3">
					<Button
						intent="outline"
						onclick={() =>
							void goto(
								localizeInternalHref(
									resolve('/(app)/w/[id]', { id: wishlistData.shortId }),
								),
							)}
					>
						{m.cancel()}
					</Button>
					<Button disabled={!isHydrated || isAccepting} onclick={handleAccept}>
						{#if isAccepting}
							{m.invite_accepting()}
						{:else}
							{m.invite_accept_button()}
						{/if}
					</Button>
				</Card.Footer>
			{/if}
		{/if}

		{#if errorMessage !== null}
			<Card.Footer class="flex justify-center">
				<Button
					intent="outline"
					onclick={() =>
						void goto(
							localizeInternalHref(
								resolve('/(app)/w/[id]', { id: wishlistData.shortId }),
							),
						)}
				>
					{m.invite_back_to_list()}
				</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>

<svelte:head>
	<title>{m.invite_page_title({ title: wishlistData.title })}</title>
</svelte:head>
