<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import * as Tabs from '$lib/components/base/tabs/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import XIcon from '@lucide/svelte/icons/x';
	import WishlistCropEditor from './WishlistCropEditor.svelte';
	import WishlistPaletteAutoSave from './WishlistPaletteAutoSave.svelte';
	import WishlistCategorySettings from './WishlistCategorySettings.svelte';
	import WishlistSettingsSaveButton from './WishlistSettingsSaveButton.svelte';
	import RecipientPreview from './RecipientPreview.svelte';
	import {
		WISHLIST_SETTINGS_TABS,
		type WishlistSettingsTab,
	} from './wishlist_settings_modal_types.js';
	import { deleteWishlist } from '$lib/modules/wishlists/wishlists.remote.js';
	import { saveWishlistSettings } from '$lib/modules/wishlists/wishlist_settings.remote.js';
	import type { SaveWishlistSettingsInput } from '$lib/modules/wishlists/wishlist_settings_types.js';
	import { revertWishlistToDraft } from '$lib/modules/sharing/sharing.remote.js';
	import { graceWindowExpiresAt } from '$lib/modules/sharing/grace_window.js';
	import {
		getServerErrorCode,
		translateServerError,
	} from '$lib/modules/errors/translate_server_error.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
	import { getGiftCategorySettingsRows } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
	import {
		REVERT_CAPABILITY,
		type RevertCapability,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import {
		RECIPIENT_NAME_MAX_LENGTH,
		WISHLIST_TITLE_MAX_LENGTH,
		WISHLIST_ROLES,
		type Wishlist,
		type WishlistRole,
	} from '$lib/modules/wishlists/types.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import {
		overlayCloseButtonClass,
		overlayCloseButtonSurfaceClass,
	} from '$lib/components/base/dialog/dialog_close_button.js';

	interface WishlistSettingsModalProps {
		open: boolean;
		/** Tab shown while the dialog is open; bindable so entry points can deep-link a tab. */
		activeTab: WishlistSettingsTab;
		wishlist: Wishlist;
		/** Recipient OR správce; non-managers get a read-only notice instead of the forms. */
		canManage: boolean;
		/** Viewer role: on linked lists only the linked recipient may edit the recipient (issue #150). */
		role: WishlistRole;
		/** Server-computed revert-to-draft affordance (issue #150): drives the danger-zone revert
		 *  action and — for an app admin who does not manage the list — the admin-only settings view. */
		revertCapability: RevertCapability;
		/** Who the list is for: linked account name or free-text name (shown in the recipient row). */
		recipientDisplayName: string;
		/** Theme-derived fallback emoji for the crop editor previews. */
		themeEmoji: string;
		/** Awaited page refresh after a save so the form can re-seed from fresh values. */
		onsaved: () => Promise<void>;
		/** Optimistic palette update so the page's data-palette subtree re-themes instantly. */
		onpaletteselect?: (palette: Palette) => void;
		/** Fires after a successful delete so the page can navigate away + refresh dashboards. */
		ondeleted?: () => void;
		/** Awaited page refresh after a successful revert-to-draft (issue #150). */
		onreverted?: () => Promise<void>;
		/** Opens the append import wizard from settings while keeping manager-only visibility. */
		onimport: () => void;
		/** Downloads the gift spreadsheet export from settings while keeping manager-only visibility. */
		onexport: () => void;
		/** Opens the shared edit-recipient dialog (issue #150) — the page renders it. */
		oneditrecipient?: () => void;
	}

	/** Normalize a stored event date to a `Date` for the `DatePicker`, or `null` when unset/invalid. */
	function toEventDate(value: Date | string | null): Date | null {
		if (value === null) {
			return null;
		}
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	let {
		open = $bindable(false),
		activeTab = $bindable(WISHLIST_SETTINGS_TABS.details),
		wishlist,
		canManage,
		role,
		revertCapability,
		recipientDisplayName,
		themeEmoji,
		onsaved,
		onpaletteselect,
		ondeleted,
		onreverted,
		onimport,
		onexport,
		oneditrecipient,
	}: WishlistSettingsModalProps = $props();

	const isArchived = $derived(wishlist.status === 'archived');
	const isShared = $derived(wishlist.sharedAt !== null);
	// An app admin who does not manage this list still reaches the danger zone for the revert
	// action only (issue #150). Non-hidden capability for a non-manager ⟺ admin on a reserved list.
	const isAdminRevertOnly = $derived(!canManage && revertCapability !== REVERT_CAPABILITY.hidden);
	// Recipient edit affordance (issue #150): free-text lists → the recipient name is an inline
	// field any manager edits and saves with the details form; linked lists → the name is read-only,
	// and ONLY the linked recipient may flip to a free-text recipient (no evicting by správci) via
	// the shared dialog.
	const isFreeTextRecipient = $derived(wishlist.recipientUserId === null);
	const canFlipRecipient = $derived(role === WISHLIST_ROLES.recipient);

	// Event-date grace window (issue #83): after sharing, the event date stays editable for a
	// debounced 2-min window before it locks. `eventDateEditedAt` drives the debounce, falling back
	// to `sharedAt` until the first in-window edit. The countdown re-locks the field live at zero.
	let eventDateClockNow = $state(new Date());
	const eventDateGraceExpiresAt = $derived(
		isShared ? graceWindowExpiresAt(wishlist.eventDateEditedAt ?? wishlist.sharedAt) : null,
	);
	const eventDateEditable = $derived(
		!isShared ||
			(eventDateGraceExpiresAt !== null &&
				eventDateClockNow.getTime() < eventDateGraceExpiresAt.getTime()),
	);
	$effect(() => {
		if (!open || eventDateGraceExpiresAt === null) {
			return;
		}
		const expiry = eventDateGraceExpiresAt.getTime();
		eventDateClockNow = new Date();
		const id = setInterval(() => {
			eventDateClockNow = new Date();
			if (eventDateClockNow.getTime() >= expiry) {
				clearInterval(id); // window closed – the field has already re-locked
			}
		}, 1000);
		return () => clearInterval(id);
	});

	// One-time seed; handleOpenChange re-seeds on close so the next open starts fresh.
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let detailsTitle = $state(wishlist.title);
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let detailsDescription = $state(wishlist.description ?? '');
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let detailsEventDate = $state(toEventDate(wishlist.eventDate));
	// Free-text recipient name (issue #150): an inline field saved alongside the details form.
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let recipientNameDraft = $state(recipientDisplayName);
	let detailsError = $state('');
	let recipientError = $state('');
	let saving = $state(false);
	let imageDirty = $state(false);
	let categoriesDirty = $state(false);
	let paletteDirty = $state(false);
	// svelte-ignore state_referenced_locally (one-time modal draft seed)
	let paletteDraft = $state<Palette>(wishlist.palette);
	let categoryDraft = $state<SaveWishlistSettingsInput['categories']>();
	let imageDraft = $state<SaveWishlistSettingsInput['image']>();
	let commitVersion = $state(0);
	let discardVersion = $state(0);
	let guardOpen = $state(false);
	let pendingAction = $state<null | (() => void)>(null);
	let allowNavigation = false;
	let categoryResetVersion = $state(0);

	// Browsers prohibit custom dialogs during unload; beforeunload is the only standards-compliant guard.
	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!open || !anyDirty) {
				return;
			}
			event.preventDefault();
			event.returnValue = true;
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	function dateTimestamp(value: Date | null): number | null {
		return value?.getTime() ?? null;
	}

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = value?.trim() ?? '';
		return trimmed === '' ? null : trimmed;
	}

	const detailsDirty = $derived.by(() => {
		const normalizedDescription = normalizeOptionalText(detailsDescription);
		const recipientChanged =
			isFreeTextRecipient && recipientNameDraft.trim() !== recipientDisplayName.trim();
		const eventDateChanged =
			eventDateEditable &&
			dateTimestamp(detailsEventDate) !== dateTimestamp(toEventDate(wishlist.eventDate));
		return (
			detailsTitle.trim() !== wishlist.title.trim() ||
			normalizedDescription !== normalizeOptionalText(wishlist.description) ||
			recipientChanged ||
			eventDateChanged
		);
	});

	/** Re-seed the details form from the canonical server values (server trims/normalizes). */
	function seedDetailsForm() {
		detailsTitle = wishlist.title;
		detailsDescription = wishlist.description ?? '';
		detailsEventDate = toEventDate(wishlist.eventDate);
		recipientNameDraft = recipientDisplayName;
		detailsError = '';
		recipientError = '';
	}

	const anyDirty = $derived(detailsDirty || categoriesDirty || paletteDirty || imageDirty);

	function discardDrafts() {
		onpaletteselect?.(wishlist.palette);
		discardVersion += 1;
		seedDetailsForm();
		categoryDraft = undefined;
		imageDraft = undefined;
		categoriesDirty = false;
		imageDirty = false;
		paletteDirty = false;
	}

	function requestGuarded(action: () => void) {
		if (!anyDirty) {
			action();
			return;
		}
		pendingAction = action;
		guardOpen = true;
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			if (saving) {
				open = true;
				return;
			}
			requestGuarded(() => (open = false));
			return;
		}
		open = true;
	}

	/** Keep Bits UI from hiding its internal dialog state before the dirty guard resolves. */
	function handleDismiss(event: Event) {
		if (!saving && !anyDirty) {
			return;
		}
		event.preventDefault();
		handleOpenChange(false);
	}

	function continueEditing() {
		guardOpen = false;
		pendingAction = null;
		open = true;
	}

	function handleImport() {
		requestGuarded(onimport);
	}

	beforeNavigate((navigation) => {
		if (!open || !anyDirty || allowNavigation) {
			return;
		}
		navigation.cancel();
		if (navigation.to?.url === undefined) {
			return;
		}
		const destination = `${navigation.to.url.pathname}${navigation.to.url.search}${navigation.to.url.hash}`;
		requestGuarded(() => {
			allowNavigation = true;
			void goto(destination)
				.catch((thrown) => {
					console.error('Failed to navigate from wishlist settings:', thrown);
					toastError(m.toast_wishlist_details_save_error());
				})
				.finally(() => (allowNavigation = false));
		});
	});

	async function saveAll(afterSave?: () => void): Promise<boolean> {
		if (!anyDirty || saving) {
			return false;
		}
		const trimmedTitle = detailsTitle.trim();
		if (detailsDirty && trimmedTitle === '') {
			detailsError = m.wishlist_name_required();
			activeTab = WISHLIST_SETTINGS_TABS.details;
			await tick();
			document.getElementById('wishlist-title')?.focus();
			return false;
		}
		if (detailsDirty && isFreeTextRecipient && recipientNameDraft.trim() === '') {
			recipientError = m.create_recipient_name_required();
			activeTab = WISHLIST_SETTINGS_TABS.details;
			await tick();
			document.getElementById('wishlist-settings-recipient')?.focus();
			return false;
		}
		detailsError = '';
		recipientError = '';
		saving = true;
		try {
			const input: SaveWishlistSettingsInput = { wishlistId: wishlist.id };
			if (detailsDirty) {
				const description = detailsDescription.trim();
				input.details = {
					title: trimmedTitle,
					description: description === '' ? null : description,
					...(eventDateEditable ? { eventDate: detailsEventDate } : {}),
					...(isFreeTextRecipient && recipientNameDraft.trim() !== recipientDisplayName
						? { recipientName: recipientNameDraft.trim() }
						: {}),
				};
			}
			if (categoriesDirty && categoryDraft !== undefined) {
				input.categories = categoryDraft;
			}
			if (paletteDirty) {
				input.palette = paletteDraft;
			}
			if (imageDirty && imageDraft !== undefined) {
				input.image = imageDraft;
			}
			await saveWishlistSettings(input);
			commitVersion += 1;
			await tick();
			await onsaved();
			toastSuccess(m.toast_wishlist_details_saved());
			afterSave?.();
			return true;
		} catch (thrown) {
			console.error('Failed to save wishlist settings:', thrown);
			if (
				getServerErrorCode(thrown) ===
				SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH
			) {
				try {
					await getGiftCategorySettingsRows(wishlist.id).refresh();
				} catch (refreshError) {
					console.error(
						'Failed to refresh category settings after conflict:',
						refreshError,
					);
				}
				categoryDraft = undefined;
				categoriesDirty = false;
				categoryResetVersion += 1;
				activeTab = WISHLIST_SETTINGS_TABS.categories;
			}
			toastError(translateServerError(thrown, m.toast_wishlist_details_save_error()));
			return false;
		} finally {
			saving = false;
		}
	}

	async function handleGlobalSave() {
		await saveAll(() => (open = false));
	}

	function discardAndContinue() {
		const action = pendingAction;
		guardOpen = false;
		pendingAction = null;
		discardDrafts();
		action?.();
	}

	async function saveAndContinue() {
		const action = pendingAction;
		if (
			await saveAll(() => {
				guardOpen = false;
				pendingAction = null;
				action?.();
			})
		) {
			return;
		}
	}

	// ── Delete handler (issue #120) ────────────────────────────────────────────
	// Delete is only possible for an unshared (draft) wishlist – the same rule the
	// `deleteWishlist` command enforces server-side; a shared list must be archived instead.

	let deleteConfirmOpen = $state(false);
	let deleting = $state(false);

	async function handleDeleteConfirmed() {
		deleting = true;
		try {
			await deleteWishlist(wishlist.id);
			deleteConfirmOpen = false;
			open = false;
			toastSuccess(m.toast_wishlist_deleted());
			ondeleted?.();
		} catch (thrown) {
			console.error('Failed to delete wishlist:', thrown);
			toastError(translateServerError(thrown, m.toast_wishlist_delete_error()));
		} finally {
			deleting = false;
		}
	}

	// ── Revert-to-draft handler (issue #150) ───────────────────────────────────
	// A shared list can return to draft: a správce silently when reservation-free, an app admin
	// when reserved (cancels reservations + notifies). The reserved variant confirm dialog spells
	// out the cancellation; the server re-checks the capability as the security boundary.

	let revertConfirmOpen = $state(false);
	let reverting = $state(false);

	async function handleRevertConfirmed() {
		reverting = true;
		try {
			await revertWishlistToDraft(wishlist.id);
			revertConfirmOpen = false;
			open = false;
			toastSuccess(m.toast_wishlist_reverted());
			await onreverted?.();
		} catch (thrown) {
			console.error('Failed to revert wishlist:', thrown);
			toastError(translateServerError(thrown, m.toast_wishlist_revert_error()));
		} finally {
			reverting = false;
		}
	}
</script>

<!-- Revert-to-draft card (issue #150). Rendered per the server-computed capability: enabled for a
     clean/reserved-admin revert, DISABLED with the „jen administrátor" copy for a non-admin správce
     on a reserved list, and nothing at all when hidden. Reused by the manager danger panel and the
     admin-only view. -->
{#snippet revertSection()}
	{#if revertCapability !== REVERT_CAPABILITY.hidden}
		<Card.Root class="border-destructive/30">
			<Card.Header>
				<div class="flex items-center gap-2">
					<RotateCcwIcon class="size-5 text-destructive" />
					<div>
						<Card.Title class="text-destructive">
							{m.wishlist_settings_revert_title()}
						</Card.Title>
						<Card.Description>{m.wishlist_settings_revert_hint()}</Card.Description>
					</div>
				</div>
			</Card.Header>
			<Card.Content>
				{#if revertCapability === REVERT_CAPABILITY.reservedBlocked}
					<div class="flex flex-col gap-3">
						<Alert.Root tone="warning">
							<Alert.Description>
								{m.wishlist_revert_reserved_admin_only()}
							</Alert.Description>
						</Alert.Root>
						<div class="flex justify-end">
							<Button intent="danger" size="sm" disabled>
								<RotateCcwIcon data-icon="inline-start" />
								{m.wishlist_revert_button()}
							</Button>
						</div>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#if revertCapability === REVERT_CAPABILITY.reservedAdmin}
							<p class="text-xs text-muted-foreground">
								{m.wishlist_revert_reserved_warning()}
							</p>
						{/if}
						<div class="flex justify-end">
							<Button
								intent="danger"
								size="sm"
								data-testid="settings-revert-to-draft"
								onclick={() => requestGuarded(() => (revertConfirmOpen = true))}
							>
								<RotateCcwIcon data-icon="inline-start" />
								{m.wishlist_revert_button()}
							</Button>
						</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
{/snippet}

<!-- Per-wishlist settings modal (UX rework of the old /w/<id>/settings page). Panels hide via
     the `hidden` attribute instead of unmounting so unsaved edits (typed details,
     uploaded-but-unsaved image) survive tab switches; closing the dialog unmounts everything,
     matching the old leave-the-page reset. -->
<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content
		size="2xl"
		showCloseButton={false}
		onEscapeKeydown={handleDismiss}
		onInteractOutside={handleDismiss}
		class="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100%-2rem)] xl:max-w-5xl"
		style="height: min(52rem, 85dvh); max-height: calc(100dvh - 2rem);"
	>
		<Dialog.Header class="shrink-0 px-6 pt-6 pb-4">
			<Dialog.Title>{m.wishlist_settings_title()}</Dialog.Title>
			<Dialog.Description>{wishlist.title}</Dialog.Description>
		</Dialog.Header>

		{#if canManage && !isArchived}
			<div inert={saving ? true : undefined} class="h-14 shrink-0 px-6 pb-4">
				<Tabs.Root
					aria-label={m.wishlist_settings_title()}
					aria-orientation="horizontal"
					class="flex h-10 min-h-10 w-full max-w-full flex-nowrap overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>[role=tab]]:shrink-0 [&>[role=tab]]:whitespace-nowrap lg:[&>[role=tab]]:flex-1 lg:[&>[role=tab]]:justify-center"
				>
					<Tabs.Tab
						id="wishlist-settings-tab-details"
						aria-controls="wishlist-settings-panel-details"
						active={activeTab === WISHLIST_SETTINGS_TABS.details}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.details)}
					>
						{m.wishlist_settings_details_section()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-categories"
						aria-controls="wishlist-settings-panel-categories"
						active={activeTab === WISHLIST_SETTINGS_TABS.categories}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.categories)}
					>
						{m.wishlist_settings_categories_tab()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-appearance"
						aria-controls="wishlist-settings-panel-appearance"
						active={activeTab === WISHLIST_SETTINGS_TABS.appearance}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.appearance)}
					>
						{m.wishlist_settings_appearance_tab()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-image"
						aria-controls="wishlist-settings-panel-image"
						active={activeTab === WISHLIST_SETTINGS_TABS.image}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.image)}
					>
						{m.wishlist_settings_image_section()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-data"
						aria-controls="wishlist-settings-panel-data"
						active={activeTab === WISHLIST_SETTINGS_TABS.data}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.data)}
					>
						{m.wishlist_settings_data_title()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-danger"
						aria-controls="wishlist-settings-panel-danger"
						active={activeTab === WISHLIST_SETTINGS_TABS.danger}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.danger)}
					>
						{m.wishlist_settings_danger_tab()}
					</Tabs.Tab>
				</Tabs.Root>
			</div>
		{/if}

		<div
			data-testid="wishlist-settings-scroll-region"
			inert={saving ? true : undefined}
			class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 {canManage && !isArchived
				? 'flex w-full min-w-0 flex-col gap-4'
				: ''}"
		>
			{#if canManage && !isArchived}
				<!-- Podrobnosti: title / description / event date, saved by the global composite save. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-details"
					aria-labelledby="wishlist-settings-tab-details"
					class="w-full min-w-0"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.details}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_settings_details_hint()}
						</p>

						<form
							id="wishlist-details-form"
							onsubmit={(event) => {
								event.preventDefault();
								void handleGlobalSave();
							}}
							class="flex flex-col gap-4"
						>
							<!-- Recipient (issue #150): free-text lists get an inline name field saved with
						     this form; linked lists show a read-only name, and only the linked recipient
						     may flip to a free-text recipient (no evicting by správci) via the dialog. -->
							{#if isFreeTextRecipient}
								<div class="flex flex-col gap-2">
									<Label for="wishlist-settings-recipient"
										>{m.recipient_section_title()}</Label
									>
									<Input
										id="wishlist-settings-recipient"
										bind:value={recipientNameDraft}
										placeholder={m.create_recipient_name_placeholder()}
										maxlength={RECIPIENT_NAME_MAX_LENGTH}
										required
										disabled={saving}
										aria-invalid={recipientError !== '' ? true : undefined}
										aria-describedby={recipientError !== ''
											? 'wishlist-recipient-error'
											: undefined}
									/>
									{#if recipientError !== ''}
										<p
											id="wishlist-recipient-error"
											class="text-sm text-destructive"
										>
											{recipientError}
										</p>
									{/if}
									<RecipientPreview name={recipientNameDraft} />
								</div>
							{:else}
								<div
									class="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2"
								>
									<div class="min-w-0">
										<p class="text-sm font-medium">
											{m.recipient_section_title()}
										</p>
										<p class="truncate text-sm text-muted-foreground">
											{recipientDisplayName}
										</p>
									</div>
									{#if canFlipRecipient}
										<Button
											type="button"
											size="sm"
											intent="outline"
											data-testid="settings-edit-recipient"
											onclick={oneditrecipient}
										>
											<PencilIcon data-icon="inline-start" />
											{m.wishlist_edit_recipient_label()}
										</Button>
									{/if}
								</div>
							{/if}

							<Field
								fieldId="wishlist-title"
								label={m.wishlist_name_label()}
								errorMessage={detailsError}
							>
								{#snippet children({ hasError, errorId }: FieldControlContext)}
									<Input
										id="wishlist-title"
										bind:value={detailsTitle}
										placeholder={m.wishlist_name_placeholder()}
										required
										maxlength={WISHLIST_TITLE_MAX_LENGTH}
										disabled={saving}
										state={hasError ? 'error' : 'default'}
										aria-invalid={hasError ? true : undefined}
										aria-describedby={errorId}
									/>
								{/snippet}
							</Field>

							<div class="flex flex-col gap-2">
								<Label for="wishlist-description"
									>{m.wishlist_description_label()}</Label
								>
								<Textarea
									id="wishlist-description"
									bind:value={detailsDescription}
									placeholder={m.wishlist_description_placeholder()}
									disabled={saving}
								/>
							</div>

							<div class="flex flex-col gap-2">
								<Label id="wishlist-event-date-label"
									>{m.wishlist_event_date_label()}</Label
								>
								<DatePicker
									id="wishlist-event-date"
									ariaLabelledby="wishlist-event-date-label"
									bind:value={detailsEventDate}
									disabled={saving || !eventDateEditable}
								/>
								{#if isShared && eventDateEditable && eventDateGraceExpiresAt !== null}
									<GraceCountdown
										expiresAt={eventDateGraceExpiresAt}
										now={eventDateClockNow}
										message={m.wishlist_event_date_grace_hint}
									/>
								{:else if isShared}
									<HelpText>{m.wishlist_event_date_locked_hint()}</HelpText>
								{/if}
							</div>
						</form>
					</div>
				</div>

				<!-- Import/export: uses the existing actions without duplicate card chrome or heading. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-data"
					aria-labelledby="wishlist-settings-tab-data"
					class="w-full min-w-0"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.data}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_settings_data_hint()}
						</p>
						<div class="flex flex-wrap gap-2">
							<Button type="button" intent="outline" size="sm" onclick={handleImport}>
								<FileUpIcon data-icon="inline-start" />
								{m.import_toolbar_label()}
							</Button>
							<Button type="button" intent="outline" size="sm" onclick={onexport}>
								<FileDownIcon data-icon="inline-start" />
								{m.export_toolbar_label()}
							</Button>
						</div>
					</div>
				</div>

				<!-- Kategorie: managed wishlist gift categories. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-categories"
					aria-labelledby="wishlist-settings-tab-categories"
					class="w-full min-w-0"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.categories}
				>
					{#key `${discardVersion}:${categoryResetVersion}`}
						<WishlistCategorySettings
							wishlistId={wishlist.id}
							{saving}
							{commitVersion}
							ondirtychange={(dirty) => (categoriesDirty = dirty)}
							ondraftchange={(draft) => (categoryDraft = draft ?? undefined)}
						/>
					{/key}
				</div>

				<!-- Vzhled: palette picker contributes a draft to the global composite save. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-appearance"
					aria-labelledby="wishlist-settings-tab-appearance"
					class="w-full min-w-0"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.appearance}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_palette_dialog_description()}
						</p>
						<WishlistPaletteAutoSave
							palette={wishlist.palette}
							onselect={onpaletteselect}
							{commitVersion}
							{discardVersion}
							disabled={saving}
							ondirtychange={(dirty, palette) => {
								paletteDirty = dirty;
								paletteDraft = palette;
							}}
						/>
					</div>
				</div>

				<!-- Obrázek a ořezy: saved from the shared fixed dialog footer. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-image"
					aria-labelledby="wishlist-settings-tab-image"
					class="w-full min-w-0"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.image}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_settings_image_hint()}
						</p>
						{#key discardVersion}
							<WishlistCropEditor
								formId="wishlist-image-form"
								imageKey={wishlist.imageKey}
								imageSlots={wishlist.imageSlots}
								{themeEmoji}
								title={wishlist.title}
								isSaving={saving}
								{commitVersion}
								ondirtychange={(dirty) => (imageDirty = dirty)}
								ondraftchange={(draft) => (imageDraft = draft ?? undefined)}
							/>
						{/key}
					</div>
				</div>

				<!-- Nebezpečná zóna: delete is only offered for an unshared list (issue #120), a
			     shared list must be archived instead, matching the deleteWishlist server guard. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-danger"
					aria-labelledby="wishlist-settings-tab-danger"
					class="w-full min-w-0"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.danger}
				>
					<div class="flex flex-col gap-4">
						<!-- Revert to draft (issue #150): shown for a shared list per the server-computed
					     capability; sits above delete. Delete stays draft-only (issue #120). -->
						{@render revertSection()}
						{#if isShared}
							<Alert.Root tone="warning">
								<Alert.Description
									>{m.wishlist_settings_danger_shared_notice()}</Alert.Description
								>
							</Alert.Root>
						{:else}
							<Card.Root class="border-destructive/30">
								<Card.Header>
									<div class="flex items-center gap-2">
										<TriangleAlertIcon class="size-5 text-destructive" />
										<div>
											<Card.Title class="text-destructive">
												{m.wishlist_settings_danger_tab()}
											</Card.Title>
											<Card.Description
												>{m.wishlist_settings_danger_hint()}</Card.Description
											>
										</div>
									</div>
								</Card.Header>
								<Card.Content>
									<div class="flex items-center justify-between gap-4">
										<div>
											<p class="text-sm font-medium">
												{m.wishlist_delete_button()}
											</p>
											<p class="text-xs text-muted-foreground">
												{m.wishlist_delete_confirm_description()}
											</p>
										</div>
										<Button
											intent="danger"
											size="sm"
											onclick={() =>
												requestGuarded(() => (deleteConfirmOpen = true))}
										>
											<TrashIcon data-icon="inline-start" />
											{m.wishlist_delete_button()}
										</Button>
									</div>
								</Card.Content>
							</Card.Root>
						{/if}
					</div>
				</div>
			{:else if isAdminRevertOnly}
				<!-- App admin who does not manage this list: danger/admin actions only (revert). -->
				<div class="flex flex-col gap-4">
					<p class="text-sm text-muted-foreground">
						{m.wishlist_settings_admin_only_hint()}
					</p>
					{@render revertSection()}
				</div>
			{:else if isArchived}
				<Alert.Root tone="warning">
					<Alert.Description>{m.wishlist_settings_archived_readonly()}</Alert.Description>
				</Alert.Root>
			{:else}
				<Alert.Root tone="warning">
					<Alert.Description>{m.wishlist_settings_owner_only()}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<Dialog.Footer
			data-testid="wishlist-settings-footer"
			class="shrink-0 border-t border-border bg-background px-6 py-4"
			style="min-height: 4.25rem;"
		>
			{#if canManage && !isArchived}
				<WishlistSettingsSaveButton
					dirty={anyDirty}
					{saving}
					onclick={() => void handleGlobalSave()}
					testId="wishlist-settings-save"
				/>
			{/if}
		</Dialog.Footer>

		<Button
			intent="ghost"
			size="icon-sm"
			class={overlayCloseButtonClass}
			surfaceClass={overlayCloseButtonSurfaceClass}
			onclick={() => handleOpenChange(false)}
		>
			<XIcon data-icon="inline-start" />
			<span class="sr-only">{m.close()}</span>
		</Button>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={guardOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_settings_unsaved_title()}</Dialog.Title>
			<Dialog.Description>{m.wishlist_settings_unsaved_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex flex-wrap gap-2">
			<Button intent="outline" onclick={continueEditing}>
				{m.wishlist_settings_continue_editing()}
			</Button>
			<Button intent="outline" onclick={discardAndContinue} disabled={saving}>
				{m.wishlist_settings_discard()}
			</Button>
			<Button onclick={() => void saveAndContinue()} disabled={saving}>
				{m.wishlist_settings_save_continue()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete confirmation dialog (issue #120) -->
<Dialog.Root bind:open={deleteConfirmOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_delete_confirm_title({ title: wishlist.title })}</Dialog.Title
			>
			<Dialog.Description>{m.wishlist_delete_confirm_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button
				intent="outline"
				onclick={() => (deleteConfirmOpen = false)}
				disabled={deleting}
			>
				{m.cancel()}
			</Button>
			<Button intent="danger" onclick={handleDeleteConfirmed} disabled={deleting}>
				{deleting ? m.deleting() : m.wishlist_delete_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Revert-to-draft confirmation dialog (issue #150): the reserved variant spells out that all
     reservations are cancelled and reservers notified; the clean variant is silent. -->
<Dialog.Root bind:open={revertConfirmOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_revert_confirm_title()}</Dialog.Title>
			<Dialog.Description>
				{revertCapability === REVERT_CAPABILITY.reservedAdmin
					? m.wishlist_revert_confirm_reserved_description()
					: m.wishlist_revert_confirm_clean_description()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button
				intent="outline"
				onclick={() => (revertConfirmOpen = false)}
				disabled={reverting}
			>
				{m.cancel()}
			</Button>
			<Button intent="danger" onclick={handleRevertConfirmed} disabled={reverting}>
				{reverting ? m.wishlist_reverting() : m.wishlist_revert_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
