<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { afterNavigate, replaceState, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount, tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import WishlistDetailToolbar from '$lib/components/blocks/wishlist/WishlistDetailToolbar.svelte';
	import WishlistGiftDisplay from '$lib/components/blocks/wishlist/WishlistGiftDisplay.svelte';
	import WishlistSelectionToolbar from '$lib/components/blocks/wishlist/WishlistSelectionToolbar.svelte';
	import GiftBulkCopyDialog, {
		type BulkCopyDestination,
	} from '$lib/components/blocks/wishlist/GiftBulkCopyDialog.svelte';
	import GiftContextActions from '$lib/components/blocks/wishlist/GiftContextActions.svelte';
	import WishlistPreparingNotice from '$lib/components/blocks/wishlist/WishlistPreparingNotice.svelte';
	import WishlistModals from '$lib/components/blocks/wishlist/WishlistModals.svelte';
	import WishlistSettingsModal from '$lib/components/blocks/wishlist/WishlistSettingsModal.svelte';
	import EditRecipientDialog from '$lib/components/blocks/wishlist/EditRecipientDialog.svelte';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import {
		WISHLIST_SETTINGS_TABS,
		isWishlistSettingsTab,
		type WishlistSettingsTab,
	} from '$lib/components/blocks/wishlist/wishlist_settings_modal_types.js';
	import {
		WISHLIST_GIFT_QUERY_PARAM,
		WISHLIST_SETTINGS_QUERY_PARAM,
	} from '$lib/modules/wishlists/wishlist_query_params.js';
	import { consumeGiftDeepLink } from '$lib/modules/wishlists/gift_deep_link.js';
	import { LazyImportWizard } from '$lib/components/blocks/import/index.js';
	import { WIZARD_MODE } from '$lib/components/blocks/import/import_wizard_types.js';
	import { emptyGiftFilters, setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { createLatestAsyncQueue } from '$lib/modules/gifts/latest_async_queue.js';
	import { createIdentityLayoutMotion } from '$lib/motion/layout_motion.js';
	import {
		createGiftReceivedMotion,
		type GiftReceivedMotionSnapshot,
	} from '$lib/components/blocks/wishlist/gift_received_motion.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setSharingContext } from '$lib/modules/sharing/sharing.context.svelte.js';
	import { wishlistSocialDescription } from '$lib/modules/sharing/social_description.js';
	import {
		getWishlistByShortId,
		archiveWishlist,
		unfollowWishlist,
		recordWishlistVisit,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getGiftCategories } from '$lib/modules/gift-categories/gift_categories.remote.js';
	import { getUserLikesForWishlistScoped } from '$lib/modules/likes/likes.remote.js';
	import {
		reserveGift,
		unreserveGift,
		setReservationPurchased,
		getReservationLedgerForWishlist,
	} from '$lib/modules/reservations/reservations.remote.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type {
		ReserveGiftInput,
		ReservationForModerator,
	} from '$lib/modules/reservations/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		canManageWishlist,
		REVERT_CAPABILITY,
		RESERVATION_RELEASE_CAPABILITY,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
	import { wishlistSocialImageUrl } from '$lib/modules/images/index.js';
	import {
		giftEditorModeFromMeta,
		IMAGE_EDITOR_MODES,
	} from '$lib/modules/images/editor_modes.js';
	import { SITE_URL, SOCIAL_PREVIEW_IMAGE_URL } from '$lib/config/site.js';
	import { untrack } from 'svelte';
	import { showToast, toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import {
		translateServerError,
		getServerErrorCode,
	} from '$lib/modules/errors/translate_server_error.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
	import {
		createGift,
		updateGift as updateGiftRemote,
		deleteGift,
		reorderGifts,
		markGiftReceived,
		bulkUpdateGifts,
		bulkCopyGifts,
		getBulkCopyDestinations,
		getPriorityLevels,
	} from '$lib/modules/gifts/gifts.remote.js';
	import { importGifts } from '$lib/modules/import/import.remote.js';
	import {
		createDuplicateAwareImportState,
		resetDuplicateAwareImportState,
		submitDuplicateAwareImport,
	} from '$lib/modules/import/duplicate_aware_submission.js';
	import { buildGiftCsv, giftCsvFilename, downloadGiftCsv } from '$lib/modules/import/index.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import {
		GIFT_SECTION_KINDS,
		activeGiftsInOwnerOrder,
		effectiveGiftPresentationRole,
		projectGiftForRecipient,
		projectGiftsForRecipient,
		resolveActiveGiftOrder,
		type GiftSection,
	} from '$lib/modules/gifts/gift_ordering.js';
	import {
		ownerSharedGiftDeleteGraceExpiresAt,
		preShareOwnerFullEditGraceExpiresAt,
	} from '$lib/modules/gifts/gift_deletion_rules.js';
	import {
		createGiftSelection,
		shouldExitGiftSelectionOnEscape,
	} from '$lib/modules/gifts/gift_selection.svelte.js';
	import {
		giftContextActions,
		hasAdditionalGiftContextActions,
	} from '$lib/modules/gifts/gift_context_actions.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import type {
		GiftBulkAction,
		PendingGiftBulkActionDescriptor,
	} from '$lib/modules/gifts/gift_bulk_update.js';
	import {
		resetPriorityLevelLoaderForWishlistChange,
		settlePriorityLevelLoad,
	} from './priority_level_loader.js';
	import type {
		GiftFilters,
		GiftSortOption,
		GiftForVisitor,
		GiftByRole,
		GiftDraftInput,
		CreateGiftInput,
		UpdateGiftInput,
		GiftViewMode,
		GiftGroupingOption,
	} from '$lib/modules/gifts/types.js';

	let { data } = $props();

	const shortId = $derived(page.params.id!);
	const isAuthenticated = $derived(data.user !== null);

	// ── Reactive queries (issue #108) ────────────────────────────────────────
	//
	// The page consumes its remote queries reactively (tracked), so single-flight
	// refreshes that mutations trigger server-side ride back on the command
	// response and update the UI without any follow-up fetches.

	// Gift rows load client-side only, keeping the Cloudflare Worker SSR render
	// path below the free CPU budget (the `browser` gate skips the query on SSR).
	const giftsQuery = $derived(browser ? getGiftsByWishlistShortId(shortId) : null);
	const giftsResult = $derived(giftsQuery?.current);
	const gifts = $derived<GiftByRole[]>(giftsResult?.gifts ?? []);
	const isGiftDataLoading = $derived(giftsResult === undefined);

	// Optimistic palette: the override paints instantly on selection; the persisted
	// value rides back via setWishlistPalette's single-flight refresh.
	let paletteOverride = $state<Palette | null>(null);

	// Opens the "log in to like" prompt when an anonymous visitor taps the heart.
	let authPromptOpen = $state(false);

	// Client-only presentation state. It never enters a remote command or persisted preference.
	let recipientViewPreview = $state(false);
	let recipientPreviewWishlistShortId = $state<string | null>(null);

	// ── Context setup (must be synchronous – before any await) ───────────────

	const giftsContext = untrack(() =>
		setGiftsContext(
			() => wishlist.id,
			() => (recipientViewPreview ? projectGiftsForRecipient(gifts) : gifts),
			() => effectiveGiftPresentationRole(role, recipientViewPreview),
			() => wishlist?.status === 'archived',
			() => isAuthenticated,
			() => likedGiftIds,
		),
	);

	untrack(() =>
		setLikesContext(
			() => likedGiftIds,
			() => isAuthenticated,
			() => {
				authPromptOpen = true;
			},
		),
	);

	const sharingContext = untrack(() =>
		setSharingContext(
			() => wishlist?.shortId ?? '',
			() => wishlist?.sharedAt != null,
		),
	);

	// Release wiring for gift detail/editor dialogs. The capability is server-computed,
	// so the administrator identity never reaches the client.
	untrack(() =>
		setReservationsContext(
			() => wishlist.reservationReleaseCapability,
			(giftId) => releaseLedgers[giftId] ?? [],
			handleRelease,
		),
	);

	// ── Remote data fetch ────────────────────────────────────────────────────

	// SSR fetches only wishlist metadata for title/OG/header. The plain awaited value
	// is required for <svelte:head> — reading post-await state through a memoized
	// $derived there collapses to undefined during async SSR and 500s (see
	// getSocialDescription). The reactive query shares the same client cache entry,
	// so hydration costs no second fetch and single-flight refreshes flow into
	// `wishlist` below; the awaited value doubles as the fallback while a new
	// shortId is loading after in-place navigation.
	// svelte-ignore state_referenced_locally
	const initialWishlist = await getWishlistByShortId(shortId);
	const wishlistQuery = $derived(getWishlistByShortId(shortId));
	const wishlist = $derived(wishlistQuery.current ?? initialWishlist);
	const likesQuery = $derived(
		browser && isAuthenticated
			? getUserLikesForWishlistScoped({ wishlistId: wishlist.id })
			: null,
	);
	const likedGiftIds = $derived(likesQuery?.current ?? []);
	const role = $derived<WishlistRole>(giftsResult?.role ?? wishlist.role);
	let filterStateWishlistId = $state<string | null>(null);

	$effect(() => {
		if (filterStateWishlistId !== wishlist.id) {
			filterStateWishlistId = wishlist.id;
			giftsContext.filters.current = emptyGiftFilters();
		}
	});

	$effect(() => {
		if (recipientPreviewWishlistShortId !== shortId) {
			recipientPreviewWishlistShortId = shortId;
			recipientViewPreview = false;
		}
		if (role === 'recipient' && recipientViewPreview) {
			recipientViewPreview = false;
		}
	});

	// One wishlist-level ledger replaces the former request per reserved gift. Unauthorized
	// viewers never start the query; the server independently enforces the same privacy gate.
	const releaseLedgerQuery = $derived(
		browser &&
			!recipientViewPreview &&
			wishlist.reservationReleaseCapability !== RESERVATION_RELEASE_CAPABILITY.none
			? getReservationLedgerForWishlist(shortId)
			: null,
	);
	const releaseLedgers = $derived<Record<string, ReservationForModerator[]>>(
		releaseLedgerQuery?.current?.reservationsByGiftId ?? {},
	);

	// Fresh server gift data is authoritative — drop any optimistic reorder layer so
	// a stale pre-refresh order can never mask newly fetched gifts. Successful
	// reorders don't refetch (see handleReorder), so their optimistic order survives.
	$effect(() => {
		if (giftsResult !== undefined) {
			giftsContext.clearReorderOverride();
		}
	});

	// ── Derived values ───────────────────────────────────────────────────────

	const activePalette = $derived(paletteOverride ?? wishlist.palette);
	const isArchived = $derived(wishlist.status === 'archived');
	const isRecipient = $derived(role === 'recipient');
	const hideReservationState = $derived(isRecipient || recipientViewPreview);
	// Full management gate (add/edit gifts, share, archive, settings): recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	const categoriesQuery = $derived(browser && canManage ? getGiftCategories(wishlist.id) : null);
	const categoryOptions = $derived(categoriesQuery?.current ?? []);
	const categoryActionOptions = $derived(
		categoryOptions.map((category) => ({
			id: category.id,
			label: labelForGiftCategory(category, getLocale()),
		})),
	);
	const categoriesReady = $derived(
		categoriesQuery !== null && categoriesQuery.current !== undefined,
	);
	let priorityLevels = $state<Awaited<ReturnType<typeof getPriorityLevels>>>([]);
	let priorityLevelsOwnerWishlistId = $state<string | null>(null);
	let priorityLevelsWishlistId = $state<string | null>(null);
	let priorityLevelsRequestedForWishlistId = $state<string | null>(null);
	let priorityLevelsLoadPromise: Promise<void> | null = null;
	const priorityLevelsReady = $derived(priorityLevelsWishlistId === wishlist.id);
	const priorityActionOptions = $derived(
		priorityLevels.map((level) => ({ id: level.id, label: level.label })),
	);

	$effect(() => {
		const nextState = resetPriorityLevelLoaderForWishlistChange(
			{
				ownerWishlistId: priorityLevelsOwnerWishlistId,
				loadedWishlistId: priorityLevelsWishlistId,
				requestedWishlistId: priorityLevelsRequestedForWishlistId,
				loadPromise: priorityLevelsLoadPromise,
			},
			wishlist.id,
		);
		if (nextState.ownerWishlistId === priorityLevelsOwnerWishlistId) {
			return;
		}
		priorityLevelsOwnerWishlistId = nextState.ownerWishlistId;
		priorityLevels = [];
		priorityLevelsWishlistId = nextState.loadedWishlistId;
		priorityLevelsRequestedForWishlistId = nextState.requestedWishlistId;
		priorityLevelsLoadPromise = nextState.loadPromise;
	});

	const wishlistStatus = $derived(wishlist?.status as 'draft' | 'active' | 'archived');
	// Non-managers see a friendly „Seznam se připravuje" page on a draft list (never-shared or
	// reverted, issue #150) instead of the toolbar + gifts; the URL revives on (re-)share.
	const isPreparing = $derived(wishlistStatus === 'draft' && !canManage);
	// App admin with a revert action but no management rights: surface the settings gear so they
	// can reach the danger-only revert (issue #150). Non-hidden capability for a non-manager ⟺ admin.
	const adminSettingsAvailable = $derived(
		!recipientViewPreview &&
			!canManage &&
			wishlist?.revertCapability !== REVERT_CAPABILITY.hidden,
	);
	const presentationRevertCapability = $derived(
		recipientViewPreview ? REVERT_CAPABILITY.hidden : wishlist.revertCapability,
	);
	const recipientIsModerator = $derived(wishlist?.recipientIsModerator);
	// For-someone-else ⇔ no linked recipient account (management is via správci rows only).
	const isForSomeoneElse = $derived(wishlist?.recipientUserId == null);
	const themeEmoji = $derived(getWishlistEmoji(wishlist?.theme));
	function getWishlistPageUrl() {
		return `${SITE_URL}/w/${wishlist.shortId}`;
	}

	// OG/Twitter image (issue #117): a fixed-aspect crop honoring the `social` slot's saved
	// focal point, so the crawler-visible preview matches what the owner framed in the crop
	// editor instead of always serving the unmodified source image.
	function getWishlistSocialImageUrl() {
		const url = wishlistSocialImageUrl(
			wishlist.imageKey,
			wishlist.imageSlots,
			SOCIAL_PREVIEW_IMAGE_URL,
		);
		return url.startsWith('http') ? url : `${SITE_URL}${url}`;
	}

	// OG/Twitter description. A plain function (evaluated at render), NOT a $derived — reading
	// post-await state through a memoized $derived inside <svelte:head> collapses to undefined
	// during async SSR and 500s. Localized via Paraglide (issue #117). Sentence form
	// „Seznam přání pro {recipient}" on ALL lists — self lists included (2026-07-14 decision).
	function getSocialDescription() {
		return wishlistSocialDescription(wishlist.recipientDisplayName);
	}

	// ── Modal state ──────────────────────────────────────────────────────────

	let moderatorPanelOpen = $state(false);
	let giftModalOpen = $state(false);
	let giftModalMode = $state<'create' | 'edit'>('create');
	let selectedGift = $state<GiftByRole | null>(null);
	const selectedPresentationGift = $derived(
		selectedGift !== null && hideReservationState
			? projectGiftForRecipient(selectedGift)
			: selectedGift,
	);
	let isSubmitting = $state(false);
	let isDeleting = $state(false);

	// ── Batch add dialog state ───────────────────────────────────────────────

	let batchAddDialogOpen = $state(false);
	let isBatchSubmitting = $state(false);
	let batchDuplicateSubmissionState = $state(createDuplicateAwareImportState<GiftDraftInput>());

	// ── Import wizard state ──────────────────────────────────────────────────

	let importWizardOpen = $state(false);

	// ── Settings modal state (per-wishlist settings, moved from /w/<id>/settings) ─

	let settingsModalOpen = $state(false);
	let settingsModalTab = $state<WishlistSettingsTab>(WISHLIST_SETTINGS_TABS.details);

	// ── Archive confirmation dialog state ────────────────────────────────────

	let archiveConfirmOpen = $state(false);
	let archiving = $state(false);

	// ── Edit-recipient dialog state (issue #150): one shared dialog, two entry points
	//    (header pencil + settings modal recipient row) ────────────────────────

	let recipientEditDialogOpen = $state(false);

	// ── Reservation modal state ───────────────────────────────────────────────

	let reserveModalOpen = $state(false);
	let reservingGift = $state<GiftForVisitor | null>(null);
	let isReserving = $state(false);

	// ── Gift display ─────────────────────────────────────────────────────────

	let reorderMode = $state(false);
	let reorderActiveIds = $state<string[] | null>(null);
	const reorderPersistenceQueue = createLatestAsyncQueue<string[]>(
		async (orderedIds) => {
			await reorderGifts(
				orderedIds.map((id, sortOrder) => ({
					id,
					sortOrder,
				})),
			);
		},
		async (thrown) => {
			console.error('Failed to reorder gifts:', thrown);
			giftsContext.clearReorderOverride();
			await getGiftsByWishlistShortId(shortId).refresh();
			reorderActiveIds = activeGiftsInOwnerOrder(gifts).map((giftItem) => giftItem.id);
		},
	);
	const viewMode = $derived(giftsContext.viewMode.current);
	const reorderModeGifts = $derived(
		reorderActiveIds === null
			? activeGiftsInOwnerOrder(giftsContext.effectiveGifts.current)
			: resolveActiveGiftOrder(giftsContext.effectiveGifts.current, reorderActiveIds),
	);
	const reorderPresentationGifts = $derived(
		recipientViewPreview ? projectGiftsForRecipient(reorderModeGifts) : reorderModeGifts,
	);
	const giftSections = $derived.by<GiftSection[]>(() => {
		if (!reorderMode) {
			return giftsContext.giftSections.current;
		}
		return reorderPresentationGifts.length === 0
			? []
			: [
					{
						kind: GIFT_SECTION_KINDS.available,
						key: 'reorder',
						label: null,
						gifts: reorderPresentationGifts,
					},
				];
	});
	const displayedGifts = $derived(
		reorderMode ? reorderModeGifts : giftsContext.sortedAndFilteredGifts.current,
	);
	const totalCount = $derived(giftsContext.giftCount.current);
	const headerGiftCount = $derived(isGiftDataLoading && gifts.length === 0 ? null : totalCount);
	const isFilteredEmpty = $derived(!reorderMode && displayedGifts.length === 0 && totalCount > 0);
	const isEmpty = $derived(reorderMode ? reorderModeGifts.length === 0 : totalCount === 0);
	const giftSelection = untrack(() => createGiftSelection());
	const visibleGiftIds = $derived(displayedGifts.map((giftItem) => giftItem.id));
	const selectionSnapshot = $derived(giftSelection.snapshot(visibleGiftIds));
	const selectedGiftRows = $derived(
		gifts.filter((giftItem) => giftSelection.isSelected(giftItem.id)),
	);
	function commonSelectionValue<Value>(values: Value[]): Value | undefined {
		if (values.length === 0) {
			return undefined;
		}
		return values.every((value) => value === values[0]) ? values[0] : undefined;
	}
	const commonPriorityId = $derived(
		commonSelectionValue(selectedGiftRows.map((giftItem) => giftItem.priorityLevelId)),
	);
	const commonCategoryId = $derived(
		commonSelectionValue(selectedGiftRows.map((giftItem) => giftItem.categoryId ?? null)),
	);
	const commonImageFit = $derived(
		commonSelectionValue(
			selectedGiftRows.map((giftItem) => {
				const mode = giftEditorModeFromMeta(giftItem.imageMeta);
				return mode === IMAGE_EDITOR_MODES.manual ? undefined : mode;
			}),
		),
	);
	const commonImageBackground = $derived(
		commonSelectionValue(
			selectedGiftRows.map((giftItem) => giftItem.imageMeta?.bgColor ?? null),
		),
	);
	const commonReceived = $derived(
		commonSelectionValue(selectedGiftRows.map((giftItem) => giftItem.received)),
	);
	let bulkPending = $state<PendingGiftBulkActionDescriptor | null>(null);
	let bulkCopyOpen = $state(false);
	let bulkCopyLoading = $state(false);
	let bulkCopySubmitting = $state(false);
	let bulkCopyDestinationId = $state('');
	let bulkCopyReturnToActions = $state<(() => void) | null>(null);
	let bulkCopyDestinations = $state<BulkCopyDestination[]>([]);
	let hiddenConfirmOpen = $state(false);
	let deferredBulkAction = $state<GiftBulkAction | null>(null);
	let contextGift = $state<GiftByRole | null>(null);
	// Keep the Bits UI content component mounted before the first contextmenu event so its
	// floating-positioning lifecycle can observe the trigger's virtual anchor.
	const contextActionGift = $derived(contextGift ?? gifts[0] ?? null);
	let contextAnchorPoint = $state({ x: 0, y: 0 });
	let contextOpen = $state(false);
	let contextMobile = $state(false);

	$effect(() => giftSelection.reconcileExisting(gifts.map((giftItem) => giftItem.id)));

	function reservationContextFor(giftItem: GiftByRole) {
		if (hideReservationState || !('myReservationId' in giftItem)) {
			return {
				canReserve: false,
				ownsReservation: false,
				canTrackPurchased: false,
				purchased: false,
			};
		}
		const ownsReservation = giftItem.myReservationId !== null;
		return {
			// This is presentation of existing domain state, not a responsive permission guess:
			// visitors and správci receive reservation fields; recipients and preview projections do not.
			canReserve: ownsReservation || !giftItem.isFullyReserved,
			ownsReservation,
			canTrackPurchased: isAuthenticated && ownsReservation,
			purchased: giftItem.myReservationPurchasedAt !== null,
		};
	}

	function contextActionsFor(giftItem: GiftByRole) {
		const primaryUrl = giftItem.links?.[0]?.url ?? null;
		const reservationContext = reservationContextFor(giftItem);
		return giftContextActions({
			role,
			primaryUrl: normalizeGiftUrl(primaryUrl),
			readOnly: isArchived,
			canEdit: true,
			...reservationContext,
		});
	}

	function hasAdditionalContextActions(giftItem: GiftByRole) {
		return hasAdditionalGiftContextActions(contextActionsFor(giftItem), role);
	}

	function openContextActions(giftItem: GiftByRole, event: MouseEvent | null): boolean {
		if (giftSelection.active) {
			return false;
		}
		const actions = contextActionsFor(giftItem);
		if (actions.length === 0) {
			contextGift = null;
			contextOpen = false;
			return false;
		}
		contextGift = giftItem;
		contextMobile = event === null;
		if (event !== null) {
			contextAnchorPoint = { x: event.clientX, y: event.clientY };
		}
		// Desktop opening belongs to Bits UI's ContextMenu.Trigger. Setting the controlled root
		// open before its contextmenu handler runs skips virtual-anchor measurement and leaves the
		// floating content at its off-screen setup position. Long press has no Bits trigger event,
		// so the mobile Sheet is opened directly.
		if (contextMobile) {
			contextOpen = true;
		}
		void ensurePriorityLevels();
		return true;
	}

	async function updateContextGift(update: {
		priorityLevelId?: string | null;
		categoryId?: string | null;
	}) {
		if (contextGift === null) {
			return;
		}
		try {
			await updateGiftRemote({ id: contextGift.id, ...update });
			toastSuccess(m.toast_gift_updated());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		}
	}

	function settlePriorityLevels(targetWishlistId: string, succeeded: boolean) {
		const nextState = settlePriorityLevelLoad(
			{
				ownerWishlistId: priorityLevelsOwnerWishlistId,
				loadedWishlistId: priorityLevelsWishlistId,
				requestedWishlistId: priorityLevelsRequestedForWishlistId,
				loadPromise: priorityLevelsLoadPromise,
			},
			targetWishlistId,
			succeeded,
		);
		priorityLevelsWishlistId = nextState.loadedWishlistId;
		priorityLevelsRequestedForWishlistId = nextState.requestedWishlistId;
		priorityLevelsLoadPromise = nextState.loadPromise;
	}

	async function ensurePriorityLevels(targetWishlistId = wishlist.id): Promise<void> {
		if (!browser || !canManage) {
			return;
		}
		if (priorityLevelsWishlistId === targetWishlistId) {
			return;
		}
		if (
			priorityLevelsLoadPromise !== null &&
			priorityLevelsRequestedForWishlistId === targetWishlistId
		) {
			return priorityLevelsLoadPromise;
		}
		priorityLevelsRequestedForWishlistId = targetWishlistId;
		const requestPromise = getPriorityLevels(targetWishlistId)
			.then((levels) => {
				if (wishlist.id !== targetWishlistId) {
					return;
				}
				priorityLevels = levels;
				settlePriorityLevels(targetWishlistId, true);
			})
			.catch(() => {
				if (wishlist.id !== targetWishlistId) {
					return;
				}
				priorityLevels = [];
				settlePriorityLevels(targetWishlistId, false);
			});
		priorityLevelsLoadPromise = requestPromise;
		return requestPromise;
	}

	function enterSelection(giftId?: string) {
		reorderMode = false;
		reorderActiveIds = null;
		giftSelection.enter(giftId);
		void ensurePriorityLevels();
	}

	async function applyBulkAction(action: GiftBulkAction, hiddenConfirmed = false) {
		if (bulkPending !== null || selectionSnapshot.selectedIds.length === 0) {
			return;
		}
		if (selectionSnapshot.hiddenIds.length > 0 && !hiddenConfirmed) {
			deferredBulkAction = action;
			hiddenConfirmOpen = true;
			return;
		}
		const selectedIds = [...selectionSnapshot.selectedIds];
		const selectedCount = selectedIds.length;
		const mutatedWishlistId = wishlist.id;
		bulkPending = { action: action.action, count: selectedCount };
		try {
			const result = await bulkUpdateGifts({
				wishlistId: mutatedWishlistId,
				giftIds: selectedIds,
				...action,
			});
			if (
				action.action === 'received' &&
				action.received &&
				!giftsContext.filters.current.showReceived
			) {
				giftsContext.filters.current = {
					...giftsContext.filters.current,
					showReceived: true,
				};
			}
			if (action.action === 'received') {
				const priorReceived = result.priorReceived;
				showToast({
					tone: 'success',
					title: m.gift_bulk_success({ count: selectedCount }),
					actionLabel: m.gift_bulk_undo(),
					onAction: () => void restoreBulkReceived(mutatedWishlistId, priorReceived),
				});
			} else {
				toastSuccess(m.gift_bulk_success({ count: selectedCount }));
			}
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			bulkPending = null;
			hiddenConfirmOpen = false;
			deferredBulkAction = null;
		}
	}

	async function openBulkCopy(returnToActions?: () => void) {
		if (bulkCopySubmitting || selectionSnapshot.selectedIds.length === 0) {
			return;
		}
		bulkCopyReturnToActions = returnToActions ?? null;
		bulkCopyOpen = true;
		bulkCopyLoading = true;
		bulkCopyDestinationId = '';
		try {
			bulkCopyDestinations = await getBulkCopyDestinations(wishlist.id);
			bulkCopyDestinationId = bulkCopyDestinations[0]?.id ?? '';
		} catch (thrown) {
			bulkCopyDestinations = [];
			toastError(translateServerError(thrown));
		} finally {
			bulkCopyLoading = false;
		}
	}

	function handleBulkCopyOpenChange(open: boolean) {
		bulkCopyOpen = open;
		if (!open) {
			bulkCopyReturnToActions = null;
		}
	}

	function returnFromBulkCopy() {
		const returnToActions = bulkCopyReturnToActions;
		bulkCopyOpen = false;
		bulkCopyReturnToActions = null;
		returnToActions?.();
	}

	async function submitBulkCopy() {
		if (
			bulkCopySubmitting ||
			bulkCopyDestinationId === '' ||
			selectionSnapshot.selectedIds.length === 0
		) {
			return;
		}
		const selectedIds = [...selectionSnapshot.selectedIds];
		bulkCopySubmitting = true;
		try {
			await bulkCopyGifts({
				sourceWishlistId: wishlist.id,
				destinationWishlistId: bulkCopyDestinationId,
				giftIds: selectedIds,
			});
			const returnToActions = bulkCopyReturnToActions;
			toastSuccess(m.gift_bulk_copy_success({ count: selectedIds.length }));
			bulkCopyOpen = false;
			bulkCopyReturnToActions = null;
			returnToActions?.();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			bulkCopySubmitting = false;
		}
	}

	async function restoreBulkReceived(mutatedWishlistId: string, states: Record<string, boolean>) {
		if (bulkPending !== null) {
			return;
		}
		bulkPending = { action: 'restoreReceived', count: Object.keys(states).length };
		try {
			await bulkUpdateGifts({
				wishlistId: mutatedWishlistId,
				giftIds: Object.keys(states),
				action: 'restoreReceived',
				states,
			});
			toastSuccess(m.gift_bulk_undo_success());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			bulkPending = null;
		}
	}

	function confirmHiddenBulkAction() {
		const action = deferredBulkAction;
		hiddenConfirmOpen = false;
		if (action !== null) {
			void applyBulkAction(action, true);
		}
	}

	$effect(() => {
		if (
			reorderMode &&
			(!canManage ||
				isArchived ||
				(viewMode !== 'card' && viewMode !== 'list') ||
				giftsContext.effectiveGrouping.current !== 'none')
		) {
			reorderMode = false;
			reorderActiveIds = null;
		}
	});

	// ── Computed: can user edit/delete the selected gift? ────────────────────

	// Ticking clock driving the live grace countdown + re-lock (issue #83); seeded now, advanced by
	// the effect below while the modal is open.
	let graceClockNow = $state(new Date());

	// Full edit grace: a pre-share gift is fully editable for 2 minutes after sharing only.
	// Later edits update the transparency badge but never reopen name/delete grace.
	const selectedFullEditGraceExpiresAt = $derived.by(() => {
		// Post-share edit locks bind the linked recipient (the person the list is for), never a
		// správce — a moderator edits freely. Self-promotion changes only reservation visibility,
		// so a self-promoted recipient stays subject to the lock.
		if (selectedGift === null || !isRecipient || wishlist.sharedAt === null) {
			return null;
		}
		return preShareOwnerFullEditGraceExpiresAt({
			wishlistSharedAt: wishlist.sharedAt,
			giftCreatedAt: selectedGift.createdAt,
		});
	});

	const selectedDeleteGraceExpiresAt = $derived.by(() => {
		if (selectedGift === null || !isRecipient || wishlist.sharedAt === null) {
			return null;
		}
		return ownerSharedGiftDeleteGraceExpiresAt({
			wishlistSharedAt: wishlist.sharedAt,
			giftCreatedAt: selectedGift.createdAt,
		});
	});
	const selectedClockExpiresAt = $derived(
		selectedFullEditGraceExpiresAt ?? selectedDeleteGraceExpiresAt,
	);
	const isSelectedGiftWithinFullEditGrace = $derived(
		selectedFullEditGraceExpiresAt !== null &&
			graceClockNow.getTime() < selectedFullEditGraceExpiresAt.getTime(),
	);
	const isSelectedGiftWithinDeleteGrace = $derived(
		selectedDeleteGraceExpiresAt !== null &&
			graceClockNow.getTime() < selectedDeleteGraceExpiresAt.getTime(),
	);
	const selectedActiveGraceExpiresAt = $derived(
		isSelectedGiftWithinFullEditGrace
			? selectedFullEditGraceExpiresAt
			: isSelectedGiftWithinDeleteGrace
				? selectedDeleteGraceExpiresAt
				: null,
	);
	const selectedGraceMessage = $derived(
		isSelectedGiftWithinFullEditGrace ? m.gift_grace_hint : m.gift_delete_grace_hint,
	);

	// Advance the clock once per second while the modal is open; self-stops once the window closes
	// and is torn down when the modal closes (no timer leak).
	$effect(() => {
		if (!giftModalOpen || selectedClockExpiresAt === null) {
			return;
		}
		const expiry = selectedClockExpiresAt.getTime();
		graceClockNow = new Date();
		const id = setInterval(() => {
			graceClockNow = new Date();
			if (graceClockNow.getTime() >= expiry) {
				clearInterval(id); // window closed – the lock has already flipped
			}
		}, 1000);
		return () => clearInterval(id);
	});

	// Post-share-locked means a pre-share gift's initial full-edit grace has closed.
	const postShareLockSelectedGift = $derived(
		selectedFullEditGraceExpiresAt !== null && !isSelectedGiftWithinFullEditGrace,
	);

	const canDeleteSelectedGift = $derived.by(() => {
		if (selectedGift === null) {
			return false;
		}
		if (postShareLockSelectedGift) {
			return false;
		}
		if (
			'reservedCount' in selectedGift &&
			(selectedGift as { reservedCount: number }).reservedCount > 0
		) {
			return false;
		}
		if (isRecipient && wishlist.sharedAt !== null) {
			return isSelectedGiftWithinDeleteGrace;
		}
		return true;
	});

	// ── Event handlers ───────────────────────────────────────────────────────

	function handleModeratorsOpened() {
		moderatorPanelOpen = true;
	}

	function handleEditRecipientOpened() {
		recipientEditDialogOpen = true;
	}

	// Recipient change via the shared dialog (issue #150): the flip/rename command
	// single-flight-refreshes the page query (role, „Spravuje" line) and, for the flip, the
	// Moje seznamy/Spravované dashboards (issue #108) — nothing left to do here.
	async function handleRecipientChanged() {}

	function handleShareOpened() {
		sharingContext.openWizard();
	}

	function handleSettingsOpened() {
		settingsModalTab = WISHLIST_SETTINGS_TABS.details;
		settingsModalOpen = true;
	}

	function handleEditImage() {
		settingsModalTab = WISHLIST_SETTINGS_TABS.image;
		settingsModalOpen = true;
	}

	function handleReorderModeChange(active: boolean) {
		if (active) {
			if (
				!canManage ||
				isArchived ||
				(viewMode !== 'card' && viewMode !== 'list') ||
				giftsContext.effectiveGrouping.current !== 'none'
			) {
				return;
			}
			reorderActiveIds = activeGiftsInOwnerOrder(giftsContext.effectiveGifts.current).map(
				(giftItem) => giftItem.id,
			);
			reorderMode = true;
			return;
		}
		reorderMode = false;
		reorderActiveIds = null;
	}

	function handleViewModeChange(mode: GiftViewMode) {
		if (!reorderMode) {
			giftsContext.viewMode.current = mode;
		}
	}

	function handleSortChange(sort: GiftSortOption) {
		giftsContext.sortOption.current = sort;
	}

	let wishlistPageElement = $state<HTMLElement | null>(null);
	let receivedAnnouncement = $state('');
	const filterLayoutMotion = createIdentityLayoutMotion();
	const receivedGiftMotion = createGiftReceivedMotion();

	async function handleFilterChange(filters: GiftFilters) {
		receivedGiftMotion.cancel();
		const root = wishlistPageElement;
		if (root === null) {
			giftsContext.filters.current = filters;
			return;
		}
		const toolbar = root.querySelector<HTMLElement>('[data-testid="wishlist-toolbar"]');
		const before = filterLayoutMotion.capture(root, toolbar);
		giftsContext.filters.current = filters;
		await tick();
		filterLayoutMotion.play(before, root, toolbar);
	}

	function handleGroupingChange(grouping: GiftGroupingOption) {
		giftsContext.grouping.current = grouping;
	}

	function handleRecipientViewPreviewChange(active: boolean) {
		if (role !== 'visitor' && role !== 'moderator') {
			return;
		}
		recipientViewPreview = active;
		if (active) {
			reserveModalOpen = false;
			reservingGift = null;
		}
	}

	function clearFilters() {
		void handleFilterChange(emptyGiftFilters());
	}

	async function openCreateModal() {
		await ensurePriorityLevels();
		giftModalMode = 'create';
		selectedGift = null;
		giftModalOpen = true;
	}

	/** Opens the gift detail modal (issue #125): edit mode for managers, read-only for everyone
	 *  else. */
	async function openEditModal(gift: GiftByRole) {
		await ensurePriorityLevels();
		giftModalMode = 'edit';
		selectedGift = gifts.find((actualGift) => actualGift.id === gift.id) ?? gift;
		giftModalOpen = true;
	}

	// Gift mutations rely on the command's server-side single-flight refresh: the
	// fresh gift list rides back on the command response and the tracked query
	// updates in place — no follow-up fetches, no metadata/likes/dashboard reloads
	// (issue #108, REQ-3/4/5).

	async function handleCreate(input: CreateGiftInput) {
		isSubmitting = true;
		try {
			await createGift(input);
			giftModalOpen = false;
			toastSuccess(m.toast_gift_created());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isSubmitting = false;
		}
	}

	async function handleUpdate(input: UpdateGiftInput) {
		isSubmitting = true;
		try {
			await updateGiftRemote(input);
			giftModalOpen = false;
			toastSuccess(m.toast_gift_updated());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete(giftId: string) {
		isDeleting = true;
		try {
			await deleteGift(giftId);
			giftModalOpen = false;
			toastSuccess(m.toast_gift_deleted());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isDeleting = false;
		}
	}

	function findGiftElement(root: ParentNode, giftId: string): HTMLElement | null {
		for (const element of root.querySelectorAll<HTMLElement>(
			'[data-gift-item][data-gift-id]',
		)) {
			if (element.dataset.giftId === giftId) {
				return element;
			}
		}
		return null;
	}

	async function handleReceived(giftId: string, received: boolean) {
		const root = wishlistPageElement;
		const source = root === null ? null : findGiftElement(root, giftId);
		const snapshot: GiftReceivedMotionSnapshot | null =
			root === null || source === null
				? null
				: receivedGiftMotion.capture(giftId, source, root);
		const giftName = gifts.find((giftItem) => giftItem.id === giftId)?.name ?? '';
		try {
			await markGiftReceived({ giftId, received });
			// Receiving has always revealed the received section. Keep that production semantic,
			// but fold it into this one captured layout run rather than starting filter motion.
			if (received && !giftsContext.filters.current.showReceived) {
				giftsContext.filters.current = {
					...giftsContext.filters.current,
					showReceived: true,
				};
			}
			await tick();
			const settled =
				snapshot === null || root === null
					? true
					: await receivedGiftMotion.play(snapshot, root);
			if (settled) {
				receivedAnnouncement = received
					? m.gift_received_announcement({ name: giftName })
					: m.gift_unreceived_announcement({ name: giftName });
			}
		} catch (thrown) {
			if (snapshot !== null) {
				receivedGiftMotion.discard(snapshot);
			}
			toastError(translateServerError(thrown));
		}
	}

	function handleGiftModalClose() {
		giftModalOpen = false;
		selectedGift = null;
	}

	async function handleUnfollow() {
		try {
			await unfollowWishlist(wishlist.id);
			toastSuccess(m.toast_unfollowed());
		} catch (thrown) {
			console.error('Failed to unfollow:', thrown);
			toastError(m.toast_unfollow_error());
		}
	}

	// ── Import wizard handlers ───────────────────────────────────────────────

	const importExistingGifts = $derived(
		gifts.map((gift) => ({ name: gift.name, links: gift.links ?? [] })),
	);

	function openImportWizard() {
		settingsModalOpen = false;
		importWizardOpen = true;
	}

	// ── Export handler ────────────────────────────────────────────────────────

	// Exports gift DATA ONLY (name/notes/links/price), mirroring the import columns
	// for a round-trip. Never emits reservation state – the recipient must not infer
	// it, and reservations are not gift-catalog data (DECISIONS.md).
	function handleExport() {
		const csv = buildGiftCsv(
			gifts.map((gift) => ({
				name: gift.name,
				description: gift.description,
				links: gift.links ?? [],
				price: gift.price,
				currency: gift.currency,
				categoryLabel:
					gift.category == null
						? ''
						: labelForGiftCategory(
								gift.category,
								getLocale().startsWith('en') ? 'en' : 'cs',
							),
			})),
		);
		downloadGiftCsv(csv, giftCsvFilename(wishlist.title, wishlist.shortId));
	}

	// ── Batch add handlers ───────────────────────────────────────────────────

	function resetBatchDuplicateWarning() {
		batchDuplicateSubmissionState = resetDuplicateAwareImportState<GiftDraftInput>();
	}

	function openBatchAddDialog() {
		resetBatchDuplicateWarning();
		batchAddDialogOpen = true;
	}

	async function handleBatchSubmit(drafts: GiftDraftInput[]) {
		isBatchSubmitting = true;
		try {
			const submission = await submitDuplicateAwareImport({
				command: (request) => importGifts(request),
				wishlistId: wishlist.id,
				drafts,
				state: batchDuplicateSubmissionState,
			});
			batchDuplicateSubmissionState = submission.state;
			if (submission.result.status === 'duplicate-warning') {
				return;
			}
			batchAddDialogOpen = false;
			toastSuccess(m.toast_batch_add_success({ count: submission.result.gifts.length }));
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isBatchSubmitting = false;
		}
	}

	function handleBatchDialogOpenChange(open: boolean) {
		batchAddDialogOpen = open;
		if (!open) {
			resetBatchDuplicateWarning();
		}
	}

	// ── Archive handler ───────────────────────────────────────────────────────

	function handleArchive() {
		archiveConfirmOpen = true;
	}

	async function handleArchiveConfirmed() {
		archiving = true;
		try {
			// The command single-flight-refreshes the wishlist query (archived status).
			await archiveWishlist(wishlist.id);
			toastSuccess(m.toast_wishlist_archived());
			archiveConfirmOpen = false;
		} catch (thrown) {
			console.error('Failed to archive wishlist:', thrown);
			toastError(m.toast_wishlist_archive_error());
		} finally {
			archiving = false;
		}
	}

	// ── Delete handler (issue #120) ────────────────────────────────────────────
	// The confirmation + deleteWishlist call live inside WishlistSettingsModal (danger-zone
	// tab); this callback only handles what must happen on THIS page after a successful delete:
	// navigate away since the wishlist no longer exists. The command already single-flight-
	// refreshes Moje seznamy/Spravované (issue #108), so the destination dashboards are current.
	async function handleWishlistDeleted() {
		await goto(localizeInternalHref(resolve('/my-lists')));
	}

	// ── Palette handler (issue #102 REQ-5) ────────────────────────────────────

	// Optimistic local update: the `data-palette` wrapper re-derives the whole token
	// subtree instantly; the picker persists via setWishlistPalette (whose server-side
	// single-flight refresh brings the persisted value back) and reverts on error.
	function handlePaletteSelect(palette: Palette) {
		paletteOverride = palette;
	}

	// ── Reorder handler (pointer + keyboard, mouse/touch/pen) ─────────────────

	function isExactActiveGiftOrder(orderedIds: readonly string[]): boolean {
		const activeIds = activeGiftsInOwnerOrder(giftsContext.effectiveGifts.current).map(
			(giftItem) => giftItem.id,
		);
		return (
			orderedIds.length === activeIds.length &&
			new Set(orderedIds).size === activeIds.length &&
			activeIds.every((id) => orderedIds.includes(id))
		);
	}

	function handleReorderPreview(orderedIds: string[]) {
		if (reorderMode && isExactActiveGiftOrder(orderedIds)) {
			reorderActiveIds = [...orderedIds];
		}
	}

	function handleReorderCancel(orderedIds: string[]) {
		if (reorderMode && isExactActiveGiftOrder(orderedIds)) {
			reorderActiveIds = [...orderedIds];
		}
	}

	function handleReorderCommit(orderedIds: string[]) {
		if (!reorderMode || !canManage || isArchived || !isExactActiveGiftOrder(orderedIds)) {
			return;
		}

		reorderActiveIds = [...orderedIds];
		giftsContext.setActiveGiftOrder(orderedIds);
		reorderPersistenceQueue.enqueue([...orderedIds]);
	}

	// ── Reservation handlers ──────────────────────────────────────────────────

	function handleOpenReserveModal(giftItem: GiftForVisitor) {
		if (hideReservationState) {
			return;
		}
		reservingGift = giftItem;
		reserveModalOpen = true;
	}

	function handleReserveModalClose() {
		reserveModalOpen = false;
		reservingGift = null;
	}

	async function handleReserve(input: ReserveGiftInput) {
		if (hideReservationState) {
			return;
		}
		isReserving = true;
		try {
			// The command single-flight-refreshes the gift list (reservation state).
			await reserveGift(input);
			reserveModalOpen = false;
			reservingGift = null;
			toastSuccess(m.toast_gift_reserved());
		} catch (thrown) {
			// Lost the race: someone reserved the last unit between page load and submit.
			// Rather than a generic "not enough available" error, sync the real state and
			// tell the visitor what actually happened. (Errors carry no single-flight
			// payload, so this path refreshes explicitly.)
			if (getServerErrorCode(thrown) === SERVER_ERROR.NOT_ENOUGH_AVAILABLE) {
				reserveModalOpen = false;
				reservingGift = null;
				await getGiftsByWishlistShortId(shortId).refresh();
				toastError(m.toast_gift_just_reserved());
			} else {
				toastError(translateServerError(thrown));
			}
		} finally {
			isReserving = false;
		}
	}

	async function handleUnreserve(giftItem: GiftForVisitor) {
		if (hideReservationState || giftItem.myReservationId === null) {
			return;
		}
		try {
			await unreserveGift({ reservationId: giftItem.myReservationId });
			toastSuccess(m.toast_gift_unreserved());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		}
	}

	async function handleContextPurchased(giftItem: GiftByRole) {
		if (
			hideReservationState ||
			!isAuthenticated ||
			!('myReservationId' in giftItem) ||
			giftItem.myReservationId === null
		) {
			return;
		}
		const purchased = giftItem.myReservationPurchasedAt === null;
		try {
			await setReservationPurchased({
				reservationId: giftItem.myReservationId,
				purchased,
			});
			toastSuccess(purchased ? m.toast_marked_bought() : m.toast_unmarked_bought());
		} catch (thrown) {
			toastError(translateServerError(thrown));
		}
	}

	/**
	 * Releasing SOMEONE ELSE's reservation (issue #213). The server re-checks the capability, so
	 * this path carries no authorization of its own. Returns whether the release went through, so
	 * the confirmation dialog stays open on a rejection.
	 */
	async function handleRelease(_giftId: string, reservationId: string): Promise<boolean> {
		try {
			// The command single-flight-refreshes both gift state and the one wishlist ledger.
			await unreserveGift({ reservationId });
			toastSuccess(m.toast_reservation_released());
			return true;
		} catch (thrown) {
			toastError(translateServerError(thrown));
			return false;
		}
	}

	// ── Lifecycle: record the visit on mount ──────────────────────────────────

	onDestroy(() => {
		filterLayoutMotion.destroy();
		receivedGiftMotion.destroy();
	});

	onMount(() => {
		// One command per view for ANY authed user (issue #225): it upserts the visit that
		// powers the „Nedávné" row on /home for owners and moderators too, and folds in the
		// legacy auto-follow — the server auto-follows only non-managers, so a recipient never
		// gains a follower row and a moderator is not turned into a redundant follower.
		if (!isAuthenticated) {
			return;
		}
		recordWishlistVisit(initialWishlist.id).catch(() => {
			// Visit tracking is non-critical – ignore.
		});
	});

	// The legacy /w/<id>/settings route redirects here with ?settings=<tab>; open the
	// modal on the requested tab, then strip the marker so reload/share won't reopen it.
	afterNavigate(() => {
		receivedGiftMotion.cancel();
		const requestedTab = page.url.searchParams.get(WISHLIST_SETTINGS_QUERY_PARAM);
		if (requestedTab === null) {
			return;
		}
		settingsModalTab = isWishlistSettingsTab(requestedTab)
			? requestedTab
			: WISHLIST_SETTINGS_TABS.details;
		settingsModalOpen = true;
		const cleanedUrl = new URL(page.url);
		cleanedUrl.searchParams.delete(WISHLIST_SETTINGS_QUERY_PARAM);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- shallow cleanup of the current URL's query marker, not a route navigation
		replaceState(cleanedUrl, {});
	});

	// Gift deep-link from an in-app notification (issue #204): /w/<shortId>?gift=<id> opens
	// that gift's detail modal. Track the page URL objects already consumed because replaceState
	// updates the address bar without synchronously replacing `page.url`; closing the modal can
	// otherwise re-run the effect against that stale marked URL and reopen the gift. A later
	// navigation supplies a new URL object and is therefore eligible again.
	const consumedGiftDeepLinkUrls = new WeakSet<URL>();

	// Gifts load client-side only (see giftsQuery above), so this is
	// an $effect (not afterNavigate) — it must re-run once that query settles, not just on
	// navigation. A gift missing from the loaded list (deleted/archived, REQ-3) is not an
	// error: the marker is cleared and the visitor simply stays on the wishlist.
	//
	// The marker is consumed exactly once, and never while the gift modal is already open.
	// The effect also re-runs on every `gifts` refresh (including the single-flight refresh a
	// createGift response carries), so without both guards a pending marker could hijack an
	// open create-mode form into edit mode targeting the deep-linked gift — the mounted form
	// keeps its typed values across that prop swap, and the next submit would overwrite the
	// deep-linked gift with them (production data-corruption incident, 2026-08-04).
	$effect(() => {
		const currentUrl = page.url;
		if (isGiftDataLoading || consumedGiftDeepLinkUrls.has(currentUrl)) {
			return;
		}
		if (currentUrl.searchParams.has(WISHLIST_GIFT_QUERY_PARAM)) {
			consumedGiftDeepLinkUrls.add(currentUrl);
		}
		consumeGiftDeepLink({
			url: currentUrl,
			gifts,
			canOpen: !giftModalOpen,
			onConsume: (cleanedUrl) => {
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- shallow cleanup of the current URL's query marker, not a route navigation
				replaceState(cleanedUrl, {});
			},
			onOpen: (gift) => void openEditModal(gift),
		});
	});
</script>

<!-- data-palette re-derives every color token for this subtree (see app.css), giving the
     wishlist its own per-list identity independent of the viewer's app palette. -->
<div
	bind:this={wishlistPageElement}
	data-testid="wishlist-page-shell"
	data-palette={activePalette}
	style="overflow-anchor: none"
	class="mx-auto mt-3 flex w-full max-w-6xl flex-col gap-3 px-3 pb-3 sm:mt-0 sm:gap-6 sm:px-4 sm:py-6"
>
	<WishlistHeader
		title={wishlist.title}
		recipientDisplayName={wishlist.recipientDisplayName}
		recipientImage={wishlist.recipientImage}
		{isForSomeoneElse}
		managerNames={wishlist.managerNames}
		description={wishlist.description}
		imageKey={wishlist.imageKey}
		imageSlots={wishlist.imageSlots}
		{themeEmoji}
		eventDate={wishlist.eventDate}
		status={wishlistStatus}
		{role}
		giftCount={headerGiftCount}
		{recipientIsModerator}
		onshare={handleShareOpened}
		onmoderators={handleModeratorsOpened}
		onarchive={handleArchive}
		oneditimage={handleEditImage}
		oneditrecipient={handleEditRecipientOpened}
		onsettings={handleSettingsOpened}
	/>

	{#if isPreparing}
		<WishlistPreparingNotice />
	{:else}
		{#snippet selectionToolbar()}
			<WishlistSelectionToolbar
				selectedCount={selectionSnapshot.selectedIds.length}
				hiddenCount={selectionSnapshot.hiddenIds.length}
				visibleState={selectionSnapshot.visibleState}
				pending={bulkPending}
				priorityReady={priorityLevelsReady}
				categoryReady={categoriesReady}
				priorityLevels={priorityActionOptions}
				categories={categoryActionOptions}
				{commonPriorityId}
				{commonCategoryId}
				{commonImageFit}
				{commonImageBackground}
				{commonReceived}
				onselectvisible={(checked) => giftSelection.setVisible(visibleGiftIds, checked)}
				onpriority={(priorityLevelId) =>
					void applyBulkAction({ action: 'priority', priorityLevelId })}
				oncategory={(categoryId) =>
					void applyBulkAction({ action: 'category', categoryId })}
				onaction={(action) => void applyBulkAction(action)}
				oncopy={(returnToActions) => void openBulkCopy(returnToActions)}
				ondone={() => giftSelection.exit()}
			/>
		{/snippet}
		<WishlistDetailToolbar
			{canManage}
			{adminSettingsAvailable}
			{role}
			{isArchived}
			{isAuthenticated}
			{viewMode}
			sortOption={giftsContext.sortOption.current}
			filters={giftsContext.filters.current}
			grouping={giftsContext.effectiveGrouping.current}
			groupingAvailability={giftsContext.groupingAvailability.current}
			categoryFilterOptions={giftsContext.categoryFilterOptions.current}
			priorityFilterOptions={giftsContext.priorityFilterOptions.current}
			{reorderMode}
			{recipientViewPreview}
			onrecipientviewpreviewchange={handleRecipientViewPreviewChange}
			onreordermodechange={handleReorderModeChange}
			onviewmodechange={handleViewModeChange}
			onsortchange={handleSortChange}
			onfilterchange={handleFilterChange}
			ongroupingchange={handleGroupingChange}
			onsettings={handleSettingsOpened}
			onunfollow={handleUnfollow}
			onaddgift={openCreateModal}
			onbatchadd={openBatchAddDialog}
			onselectionstart={() => enterSelection()}
			selectionContent={giftSelection.active ? selectionToolbar : undefined}
		/>

		{#snippet contextActions()}
			{#if contextActionGift !== null}
				<GiftContextActions
					open={contextOpen}
					mobile={contextMobile}
					anchorPoint={contextAnchorPoint}
					name={contextActionGift.name}
					{role}
					primaryUrl={contextActionGift.links?.[0]?.url ?? null}
					readOnly={isArchived}
					received={contextActionGift.received}
					priorityReady={priorityLevelsReady}
					categoryReady={categoriesReady}
					priorityLevels={priorityActionOptions}
					categories={categoryActionOptions}
					priorityLevelId={contextActionGift.priorityLevelId}
					categoryId={contextActionGift.categoryId ?? null}
					{...reservationContextFor(contextActionGift)}
					onclose={() => (contextOpen = false)}
					onedit={() => void openEditModal(contextActionGift)}
					onpriority={(priorityLevelId) => void updateContextGift({ priorityLevelId })}
					oncategory={(categoryId) => void updateContextGift({ categoryId })}
					onreceived={() =>
						void handleReceived(contextActionGift.id, !contextActionGift.received)}
					onselect={() => enterSelection(contextActionGift.id)}
					onreserve={() => {
						if ('myReservationId' in contextActionGift) {
							handleOpenReserveModal(contextActionGift);
						}
					}}
					oncancelreservation={() => {
						if ('myReservationId' in contextActionGift) {
							void handleUnreserve(contextActionGift);
						}
					}}
					onpurchased={() => void handleContextPurchased(contextActionGift)}
					oncopysuccess={() => toastSuccess(m.gift_context_copy_success())}
					oncopyerror={() => toastError(m.gift_context_copy_error())}
				/>
			{/if}
		{/snippet}
		<WishlistGiftDisplay
			sections={giftSections}
			{role}
			{isArchived}
			{hideReservationState}
			{viewMode}
			isLoading={isGiftDataLoading}
			{isEmpty}
			{isFilteredEmpty}
			{reorderMode}
			selectionMode={giftSelection.active}
			selectedIds={selectionSnapshot.selectedIds}
			onselectiontoggle={(giftId) => giftSelection.toggle(giftId)}
			oncontextactions={openContextActions}
			hascontextactions={hasAdditionalContextActions}
			onedit={openEditModal}
			onreserve={handleOpenReserveModal}
			onunreserve={handleUnreserve}
			onreceived={handleReceived}
			onaddgift={openCreateModal}
			onclearfilters={clearFilters}
			onreorderpreview={handleReorderPreview}
			onreordercommit={handleReorderCommit}
			onreordercancel={handleReorderCancel}
			bind:contextMenuOpen={contextOpen}
			contextContent={contextActions}
		/>
	{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true">{receivedAnnouncement}</p>
</div>

<svelte:window
	onkeydown={(event) => {
		if (
			shouldExitGiftSelectionOnEscape(event, {
				selectionActive: giftSelection.active,
				contextOpen,
				hiddenConfirmOpen,
			})
		) {
			giftSelection.exit();
		}
	}}
/>

<GiftBulkCopyDialog
	open={bulkCopyOpen}
	destinations={bulkCopyDestinations}
	selectedDestinationId={bulkCopyDestinationId}
	selectedCount={selectionSnapshot.selectedIds.length}
	loading={bulkCopyLoading}
	submitting={bulkCopySubmitting}
	onopenchange={handleBulkCopyOpenChange}
	onback={bulkCopyReturnToActions === null ? undefined : returnFromBulkCopy}
	ondestinationchange={(id) => (bulkCopyDestinationId = id)}
	onconfirm={() => void submitBulkCopy()}
/>

<Dialog.Root bind:open={hiddenConfirmOpen}>
	<Dialog.Content size="sm">
		<Dialog.Header>
			<Dialog.Title>{m.gift_hidden_selection_title()}</Dialog.Title>
			<Dialog.Description
				>{m.gift_hidden_selection_description({
					count: selectionSnapshot.hiddenIds.length,
				})}</Dialog.Description
			>
		</Dialog.Header>
		<Dialog.Footer>
			<Button intent="outline" onclick={() => (hiddenConfirmOpen = false)}
				>{m.cancel()}</Button
			>
			<Button intent="primary" onclick={confirmHiddenBulkAction}
				>{m.gift_hidden_selection_continue()}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<WishlistModals
	{role}
	{canManage}
	{isAuthenticated}
	redirectHref={page.url.pathname}
	wishlistId={wishlist.id}
	wishlistTitle={wishlist.title}
	giftCount={totalCount}
	{recipientIsModerator}
	{isArchived}
	{hideReservationState}
	bind:giftModalOpen
	{giftModalMode}
	selectedGift={selectedPresentationGift}
	{priorityLevels}
	{categoryOptions}
	postShareLocked={postShareLockSelectedGift}
	{canDeleteSelectedGift}
	graceExpiresAt={selectedActiveGraceExpiresAt}
	graceMessage={selectedGraceMessage}
	graceNow={graceClockNow}
	{isSubmitting}
	{isDeleting}
	bind:reserveModalOpen
	{reservingGift}
	{isReserving}
	bind:batchAddDialogOpen
	{isBatchSubmitting}
	batchServerDuplicateCount={batchDuplicateSubmissionState.duplicateCount}
	bind:moderatorPanelOpen
	bind:authPromptOpen
	ongiftmodalclose={handleGiftModalClose}
	oncreate={handleCreate}
	onupdate={handleUpdate}
	ondelete={handleDelete}
	ongiftreserve={handleOpenReserveModal}
	ongiftunreserve={handleUnreserve}
	onreservemodalclose={handleReserveModalClose}
	onreserve={handleReserve}
	onbatchsubmit={handleBatchSubmit}
	onbatchdialogopenchange={handleBatchDialogOpenChange}
	onbatchresetduplicatewarning={resetBatchDuplicateWarning}
/>

<!-- Per-wishlist settings modal (details / appearance / image). Mounted for every viewer:
     non-managers and archived lists get the read-only notice inside the dialog, preserving
     the old /w/<id>/settings deep-link behavior. -->
<WishlistSettingsModal
	bind:open={settingsModalOpen}
	bind:activeTab={settingsModalTab}
	{wishlist}
	{canManage}
	{role}
	revertCapability={presentationRevertCapability}
	recipientDisplayName={wishlist.recipientDisplayName}
	{themeEmoji}
	onsaved={async () => {}}
	onpaletteselect={handlePaletteSelect}
	ondeleted={handleWishlistDeleted}
	onimport={openImportWizard}
	onexport={handleExport}
	oneditrecipient={handleEditRecipientOpened}
/>

<!-- Shared recipient dialog (issue #150): linked lists get the one-way flip with consequence
     copy (linked recipient only); free-text lists get the plain rename (any správce). -->
<EditRecipientDialog
	bind:open={recipientEditDialogOpen}
	wishlistId={wishlist.id}
	isLinkedRecipient={!isForSomeoneElse}
	recipientDisplayName={wishlist.recipientDisplayName}
	isShared={wishlist.sharedAt !== null}
	onchanged={handleRecipientChanged}
/>

<!-- Archive confirmation dialog: archiving hides the list from the dashboards, so it asks first. -->
<Dialog.Root bind:open={archiveConfirmOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_archive_confirm_title()}</Dialog.Title>
			<Dialog.Description>{m.wishlist_archive_confirm_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button
				intent="outline"
				onclick={() => (archiveConfirmOpen = false)}
				disabled={archiving}
			>
				{m.cancel()}
			</Button>
			<Button intent="danger" onclick={handleArchiveConfirmed} disabled={archiving}>
				{archiving ? m.wishlist_archiving() : m.wishlist_archive_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

{#if canManage}
	<LazyImportWizard
		bind:open={importWizardOpen}
		mode={WIZARD_MODE.append}
		wishlistId={wishlist.id}
		wishlistShortId={wishlist.shortId}
		wishlistTitle={wishlist.title}
		priorityLevelCount={priorityLevels.length}
		{categoryOptions}
		existingGifts={importExistingGifts}
		suppressNavigation
	/>
{/if}

<svelte:head>
	<title>{wishlist.title} – Přejeme si</title>
	<meta property="og:title" content={wishlist.title} />
	<meta property="og:description" content={getSocialDescription()} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={getWishlistPageUrl()} />
	<meta property="og:image" content={getWishlistSocialImageUrl()} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={wishlist.title} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={wishlist.title} />
	<meta name="twitter:description" content={getSocialDescription()} />
	<meta name="twitter:image" content={getWishlistSocialImageUrl()} />
	<link rel="canonical" href={getWishlistPageUrl()} />
</svelte:head>
