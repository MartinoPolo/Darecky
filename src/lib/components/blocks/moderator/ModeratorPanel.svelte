<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ModeratorListItem from './ModeratorListItem.svelte';
	import { moderatorPanelVariants } from './moderator_panel_variants.js';
	import {
		getModeratorsForWishlist,
		generateModeratorInviteLink,
		revokeModeratorInvite,
		removeModerator,
		selfPromoteToModerator,
	} from '$lib/modules/moderators/moderators.remote.js';
	import {
		getClaimInvitesForWishlist,
		generateClaimInviteLink,
		revokeClaimInvite,
	} from '$lib/modules/claim/claim.remote.js';
	import type { ModeratorWithUser, PendingInvite } from '$lib/modules/moderators/types.js';
	import type { PendingClaimInvite } from '$lib/modules/claim/types.js';
	import { toastSuccess, toastError, toastInfo } from '$lib/components/base/toast/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { getApplicationUrl } from '$lib/config/site.js';
	import LinkIcon from '@lucide/svelte/icons/link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';

	interface ModeratorPanelProps {
		wishlistId: string;
		/** Linked recipient self-promoted to see reservation state; toggles the disclosure section. */
		recipientIsModerator: boolean;
		open: boolean;
		onopenchange?: (open: boolean) => void;
		onselfpromoted?: () => void;
	}

	let {
		wishlistId,
		recipientIsModerator,
		open = $bindable(false),
		onopenchange,
		onselfpromoted,
	}: ModeratorPanelProps = $props();

	const styles = moderatorPanelVariants();

	let moderators = $state.raw<ModeratorWithUser[]>([]);
	let pendingInvites = $state.raw<PendingInvite[]>([]);
	// For-someone lists (free-text recipient) show the claim-link section.
	let isForSomeoneElse = $state(false);
	let isLoading = $state(false);
	let isGenerating = $state(false);
	let isRemoving = $state(false);
	let isRevokingId = $state<string | null>(null);
	let isSelfPromoting = $state(false);
	let linkCopied = $state(false);
	let generatedInvitePath = $state<string | null>(null);
	let inviteEmail = $state('');

	// Claim link („Pozvat obdarovaného", issue #150): only for-someone lists. Links a free-text
	// recipient's real account. Mirrors the správce-invite generate/email/copy/revoke flow.
	let claimInvites = $state.raw<PendingClaimInvite[]>([]);
	let isGeneratingClaim = $state(false);
	let isRevokingClaimId = $state<string | null>(null);
	let claimLinkCopied = $state(false);
	let generatedClaimPath = $state<string | null>(null);
	let claimEmail = $state('');

	async function loadModerators() {
		isLoading = true;
		try {
			const [data, claimData] = await Promise.all([
				getModeratorsForWishlist(wishlistId),
				getClaimInvitesForWishlist(wishlistId),
			]);
			moderators = data.moderators;
			pendingInvites = data.pendingInvites;
			isForSomeoneElse = data.isForSomeoneElse;
			claimInvites = claimData.pendingInvites;
		} catch (thrown) {
			console.error('Failed to load moderators:', thrown);
		} finally {
			isLoading = false;
		}
	}

	async function handleGenerateInvite() {
		isGenerating = true;
		linkCopied = false;
		generatedInvitePath = null;
		try {
			const trimmed = inviteEmail.trim();
			const result = await generateModeratorInviteLink(
				trimmed === '' ? { wishlistId } : { wishlistId, email: trimmed },
			);
			generatedInvitePath = result.invitePath;
			await loadModerators();
			if (trimmed === '') {
				toastSuccess(m.moderator_toast_invite_generated());
			} else {
				toastSuccess(m.moderator_toast_invite_sent({ email: trimmed }));
				// Non-blocking heads-up: the invitee has no account yet, so they'll be
				// asked to register when they open the invite (the email still went out).
				if (result.unregisteredInvitee) {
					toastInfo(
						m.moderator_invite_unregistered_title(),
						m.moderator_invite_unregistered_body(),
					);
				}
				inviteEmail = '';
			}
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_generate()));
		} finally {
			isGenerating = false;
		}
	}

	async function handleCopyLink() {
		if (generatedInvitePath === null) {
			return;
		}
		try {
			const fullUrl = getApplicationUrl(generatedInvitePath, window.location.origin);
			await navigator.clipboard.writeText(fullUrl);
			linkCopied = true;
			toastSuccess(m.moderator_toast_link_copied());
			setTimeout(() => {
				linkCopied = false;
			}, 3000);
		} catch {
			toastError(m.moderator_error_copy());
		}
	}

	async function handleRevokeInvite(inviteId: string) {
		isRevokingId = inviteId;
		try {
			await revokeModeratorInvite({ inviteId });
			await loadModerators();
			// Clear generated link if it was for this invite
			generatedInvitePath = null;
			toastSuccess(m.moderator_toast_invite_revoked());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_revoke()));
		} finally {
			isRevokingId = null;
		}
	}

	async function handleGenerateClaim() {
		isGeneratingClaim = true;
		claimLinkCopied = false;
		generatedClaimPath = null;
		try {
			const trimmed = claimEmail.trim();
			const result = await generateClaimInviteLink(
				trimmed === '' ? { wishlistId } : { wishlistId, email: trimmed },
			);
			generatedClaimPath = result.claimPath;
			await loadModerators();
			if (trimmed === '') {
				toastSuccess(m.claim_toast_generated());
			} else {
				toastSuccess(m.claim_toast_sent({ email: trimmed }));
				if (result.unregisteredInvitee) {
					toastInfo(
						m.claim_invite_unregistered_title(),
						m.claim_invite_unregistered_body(),
					);
				}
				claimEmail = '';
			}
		} catch (thrown) {
			toastError(translateServerError(thrown, m.claim_error_generate()));
		} finally {
			isGeneratingClaim = false;
		}
	}

	async function handleCopyClaimLink() {
		if (generatedClaimPath === null) {
			return;
		}
		try {
			const fullUrl = getApplicationUrl(generatedClaimPath, window.location.origin);
			await navigator.clipboard.writeText(fullUrl);
			claimLinkCopied = true;
			toastSuccess(m.claim_toast_link_copied());
			setTimeout(() => {
				claimLinkCopied = false;
			}, 3000);
		} catch {
			toastError(m.claim_error_copy());
		}
	}

	async function handleRevokeClaim(inviteId: string) {
		isRevokingClaimId = inviteId;
		try {
			await revokeClaimInvite({ inviteId });
			await loadModerators();
			generatedClaimPath = null;
			toastSuccess(m.claim_toast_revoked());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.claim_error_revoke()));
		} finally {
			isRevokingClaimId = null;
		}
	}

	async function handleRemoveModerator(assignmentId: string) {
		isRemoving = true;
		try {
			await removeModerator({ assignmentId });
			await loadModerators();
			toastSuccess(m.moderator_toast_removed());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_remove()));
		} finally {
			isRemoving = false;
		}
	}

	async function handleSelfPromote() {
		isSelfPromoting = true;
		try {
			await selfPromoteToModerator({ wishlistId });
			toastSuccess(m.moderator_toast_self_promoted());
			onselfpromoted?.();
		} catch (thrown) {
			toastError(translateServerError(thrown, m.moderator_error_activate()));
		} finally {
			isSelfPromoting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onopenchange?.(newOpen);
	}

	// Load moderator/invite data whenever the panel opens. Driven by an $effect on the
	// bound `open` prop rather than only `onOpenChange`, because the panel is opened
	// programmatically from the wishlist header (parent sets `open = true`). bits-ui's
	// `onOpenChange` fires only for internally-initiated open changes (trigger/ESC/overlay),
	// NOT parent-driven ones – so without this effect the panel would render empty.
	$effect(() => {
		if (open) {
			void loadModerators();
		} else {
			// Reset transient state when the panel closes.
			generatedInvitePath = null;
			linkCopied = false;
			inviteEmail = '';
			generatedClaimPath = null;
			claimLinkCopied = false;
			claimEmail = '';
		}
	});
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content size="2xl" class="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0">
		<Dialog.Header class="shrink-0 px-6 pt-6 pb-4">
			<Dialog.Title>{m.moderator_title()}</Dialog.Title>
			<Dialog.Description>{m.moderator_description()}</Dialog.Description>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
			<div class="flex flex-col gap-6">
				{#if isForSomeoneElse}
					<!-- Claim link (issue #150): nudge to link the free-text recipient's real account.
				     Mirrors the správce-invite generate/email/copy/revoke flow. -->
					<div class={styles.section()}>
						<div class={styles.sectionTitle()}>{m.claim_section_title()}</div>
						<div class={styles.disclosureBanner()}>
							<LinkIcon class="size-4 flex-shrink-0" />
							<div class="flex flex-col gap-0.5">
								<span class="font-medium">{m.claim_nudge_title()}</span>
								<span class="text-xs">{m.claim_nudge_description()}</span>
							</div>
						</div>

						{#if generatedClaimPath !== null}
							<div class="flex items-center gap-2">
								<div
									class="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs"
									data-testid="claim-link"
								>
									{getApplicationUrl(generatedClaimPath, window.location.origin)}
								</div>
								<Button
									size="sm"
									intent={claimLinkCopied ? 'primary' : 'outline'}
									aria-label={m.claim_copy_link()}
									data-testid="copy-claim-link"
									onclick={handleCopyClaimLink}
								>
									{#if claimLinkCopied}
										<CheckIcon data-icon="solo" />
									{:else}
										<CopyIcon data-icon="solo" />
									{/if}
								</Button>
							</div>
						{/if}

						<div class="flex flex-col gap-1.5">
							<Label for="claim-email">
								{m.claim_email_label()}
							</Label>
							<Input
								id="claim-email"
								size="lg"
								type="email"
								placeholder={m.claim_email_placeholder()}
								bind:value={claimEmail}
								disabled={isGeneratingClaim}
							/>
						</div>

						<Button
							size="lg"
							intent="primary"
							class="w-full"
							disabled={isGeneratingClaim}
							onclick={handleGenerateClaim}
						>
							<LinkIcon data-icon="inline-start" />
							{isGeneratingClaim ? m.claim_generating() : m.claim_generate_button()}
						</Button>

						{#if claimInvites.length > 0}
							<div class={styles.sectionTitle()}>
								{m.claim_pending_title({ count: claimInvites.length })}
							</div>
							{#each claimInvites as invite (invite.id)}
								<div class={styles.inviteRow()}>
									<div class="min-w-0 flex-1">
										<div class={styles.inviteToken()}>
											...{invite.token.slice(-8)}
										</div>
										<div class={styles.inviteDate()}>
											{new Intl.DateTimeFormat(getLocale(), {
												day: 'numeric',
												month: 'short',
												hour: '2-digit',
												minute: '2-digit',
											}).format(new Date(invite.createdAt))}
										</div>
									</div>
									<Button
										size="sm"
										intent="ghost"
										class=""
										surfaceClass="text-destructive group-hover:text-destructive"
										disabled={isRevokingClaimId === invite.id}
										aria-label={m.claim_revoke_invite()}
										onclick={() => handleRevokeClaim(invite.id)}
									>
										<XIcon data-icon="solo" />
									</Button>
								</div>
							{/each}
						{/if}
					</div>

					<Separator />
				{/if}

				<!-- Active moderators -->
				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>{m.moderator_active_title()}</div>

					{#if isLoading}
						<div class={styles.emptyText()}>{m.moderator_loading()}</div>
					{:else if moderators.length === 0}
						<div class={styles.emptyText()}>{m.moderator_empty()}</div>
					{:else}
						{#each moderators as moderator (moderator.id)}
							<ModeratorListItem
								{moderator}
								canRemove={true}
								{isRemoving}
								onremove={handleRemoveModerator}
							/>
						{/each}
					{/if}
				</div>

				<Separator />

				<!-- Generate invite -->
				<div class={styles.section()}>
					<div class={styles.sectionTitle()}>{m.moderator_invite_title()}</div>
					<div class={styles.sectionDescription()}>
						{m.moderator_invite_description()}
					</div>

					{#if generatedInvitePath !== null}
						<div class="flex items-center gap-2">
							<div
								class="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs"
								data-testid="invite-link"
							>
								{getApplicationUrl(generatedInvitePath, window.location.origin)}
							</div>
							<Button
								size="sm"
								intent={linkCopied ? 'primary' : 'outline'}
								aria-label={m.moderator_copy_link()}
								data-testid="copy-invite-link"
								onclick={handleCopyLink}
							>
								{#if linkCopied}
									<CheckIcon data-icon="solo" />
								{:else}
									<CopyIcon data-icon="solo" />
								{/if}
							</Button>
						</div>
					{/if}

					<div class="flex flex-col gap-1.5">
						<Label for="invite-email">
							{m.moderator_invite_email_label()}
						</Label>
						<Input
							id="invite-email"
							size="lg"
							type="email"
							placeholder={m.moderator_invite_email_placeholder()}
							bind:value={inviteEmail}
							disabled={isGenerating}
						/>
					</div>

					<Button
						size="lg"
						intent="primary"
						class="w-full"
						disabled={isGenerating}
						onclick={handleGenerateInvite}
					>
						<LinkIcon data-icon="inline-start" />
						{isGenerating ? m.moderator_generating() : m.moderator_generate_invite()}
					</Button>
				</div>

				<!-- Pending invites -->
				{#if pendingInvites.length > 0}
					<Separator />

					<div class={styles.section()}>
						<div class={styles.sectionTitle()}>
							{m.moderator_pending_title({ count: pendingInvites.length })}
						</div>

						{#each pendingInvites as invite (invite.id)}
							<div class={styles.inviteRow()}>
								<div class="min-w-0 flex-1">
									<div class={styles.inviteToken()}>
										...{invite.token.slice(-8)}
									</div>
									<div class={styles.inviteDate()}>
										{new Intl.DateTimeFormat(getLocale(), {
											day: 'numeric',
											month: 'short',
											hour: '2-digit',
											minute: '2-digit',
										}).format(new Date(invite.createdAt))}
									</div>
								</div>
								<Button
									size="sm"
									intent="ghost"
									class=""
									surfaceClass="text-destructive group-hover:text-destructive"
									disabled={isRevokingId === invite.id}
									aria-label={m.moderator_revoke_invite()}
									onclick={() => handleRevokeInvite(invite.id)}
								>
									<XIcon data-icon="solo" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Reservation visibility (self lists only): recipient self-promotion + disclosure -->
				{#if !isForSomeoneElse}
					<Separator />

					<!-- Self-promote section -->
					{#if !recipientIsModerator}
						<div class={styles.section()}>
							<div class={styles.sectionTitle()}>
								{m.moderator_reservations_title()}
							</div>

							<div class={styles.selfPromoteWarning()}>
								<div class="flex items-center gap-2">
									<AlertTriangleIcon class="size-4 flex-shrink-0" />
									<div class={styles.selfPromoteTitle()}>
										{m.moderator_see_reservations_title()}
									</div>
								</div>
								<div class={styles.selfPromoteDescription()}>
									{m.moderator_see_reservations_description()}
								</div>
								<Button
									size="sm"
									intent="outline"
									class="mt-1 self-start"
									disabled={isSelfPromoting}
									onclick={handleSelfPromote}
								>
									<EyeIcon data-icon="inline-start" />
									{isSelfPromoting
										? m.moderator_activating()
										: m.moderator_activate_button()}
								</Button>
							</div>
						</div>
					{:else}
						<div class={styles.section()}>
							<div class={styles.sectionTitle()}>
								{m.moderator_reservations_title()}
							</div>
							<div class={styles.disclosureBanner()}>
								<EyeIcon class="size-4 flex-shrink-0" />
								<span>{m.moderator_active_disclosure()}</span>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
