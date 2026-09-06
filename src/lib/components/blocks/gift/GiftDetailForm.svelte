<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import ImageCropStage from '$lib/components/derived/image-crop/ImageCropStage.svelte';
	import GiftImagePreviewSlots from './GiftImagePreviewSlots.svelte';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import GiftDescription from './GiftDescription.svelte';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import {
		getPriorityDisplay,
		adjustGiftPriceByMagnitude,
		finalizeGiftPrice,
		finalizeGiftQuantity,
		formatAppendDate,
	} from '$lib/modules/gifts/gift_display.js';
	import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import {
		GIFT_CURRENCIES,
		GIFT_CURRENCY_LABELS,
		type GiftCurrency,
		type GiftByRole,
		type GiftForVisitor,
		type GiftLink,
		type CreateGiftInput,
		type UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import { isGiftForVisitor } from '$lib/modules/gifts/gift_display_state.js';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import {
		IMAGE_FIT_MODES,
		IMAGE_TOKEN_SCOPES,
		normalizeFrameFill,
		resolveAutoFit,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		buildManualGiftTargets,
		fitModeForEditorMode,
		giftEditorModeFromMeta,
		resolveGiftTargetCrop,
		seedCropRectFromLegacyMeta,
		FULL_CROP_RECT,
		GIFT_CROP_TARGET_SPECS,
		GIFT_EDITOR_CROP_TARGET_VALUES,
		IMAGE_EDITOR_MODES,
		IMAGE_EDITOR_MODE_VALUES,
		type GiftEditorCropTarget,
		type ImageCropRect,
		type ImageEditorMode,
		type ImageMetadata,
	} from '$lib/modules/images/index.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { ensureGiftLinkIds, normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import {
		labelForGiftCategory,
		type ManagedGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	interface Props {
		mode: GiftDetailModalMode;
		gift: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		categoryOptions?: ManagedGiftCategory[];
		role: WishlistRole;
		hideReservationState?: boolean;
		postShareLocked: boolean;
		canDelete: boolean;
		/** When the active gift grace window closes (issue #83), or null when none is active. */
		graceExpiresAt?: Date | null;
		graceMessage?: (inputs: { time: string }) => string;
		/** Reactive "now" from the page clock that keeps the grace countdown live. */
		graceNow?: Date;
		isSubmitting: boolean;
		isDeleting: boolean;
		oncreate?: (input: CreateGiftInput) => void;
		onupdate?: (input: UpdateGiftInput) => void;
		ondelete?: (giftId: string) => void;
	}

	let {
		mode,
		gift,
		wishlistId,
		priorityLevels,
		categoryOptions = [],
		role,
		hideReservationState = false,
		postShareLocked,
		canDelete,
		graceExpiresAt = null,
		graceMessage = m.gift_grace_hint,
		graceNow = new Date(),
		isSubmitting,
		isDeleting,
		oncreate,
		onupdate,
		ondelete,
	}: Props = $props();

	// Intentional one-time seed from the `gift` prop: this form edits a local copy and Dialog.Content
	// unmounts on close, so the form remounts (re-seeding) each time it opens for a new gift.
	// svelte-ignore state_referenced_locally
	let name = $state(gift?.name ?? '');
	// svelte-ignore state_referenced_locally
	let description = $state(gift?.description ?? '');
	// svelte-ignore state_referenced_locally
	let links = $state<GiftLink[]>(ensureGiftLinkIds(gift?.links));
	// svelte-ignore state_referenced_locally
	let price = $state<number | null>(gift?.price ?? null);
	// svelte-ignore state_referenced_locally
	let priceMax = $state<number | null>(gift?.priceMax ?? null);
	// Switch state is DERIVED on edit from `priceMax`, not its own persisted flag (issue #155 REQ-1):
	// a saved range (price_max non-null) opens the form in range mode; everything else is single-price.
	// svelte-ignore state_referenced_locally
	let isPriceRange = $state((gift?.priceMax ?? null) !== null);
	let priceRangeError = $state('');
	let priceInput = $state<HTMLInputElement | null>(null);
	let priceMaxInput = $state<HTMLInputElement | null>(null);
	// svelte-ignore state_referenced_locally
	let currency = $state<GiftCurrency>((gift?.currency as GiftCurrency) ?? 'CZK');
	// svelte-ignore state_referenced_locally
	let imageUrl = $state(gift?.imageUrl ?? '');
	// svelte-ignore state_referenced_locally
	let imageKey = $state(gift?.imageKey ?? '');
	// svelte-ignore state_referenced_locally
	let quantity = $state<number>(gift?.quantity ?? 1);
	// svelte-ignore state_referenced_locally
	let priorityLevelId = $state(gift?.priorityLevelId ?? '');
	// svelte-ignore state_referenced_locally
	let categoryId = $state(gift?.categoryId ?? '');
	// Editing an uploaded image (imageKey set) opens on the Upload tab so the user sees
	// the current image with replace/remove – not its resolved URL in the URL field.
	// Editing a URL image (imageUrl set, no imageKey) opens on the URL tab. A brand-new
	// gift (no image at all) defaults to Upload (issue #143).
	// svelte-ignore state_referenced_locally
	let imageMode = $state<'url' | 'upload'>(
		(gift?.imageKey ?? '') !== '' || (gift?.imageUrl ?? '') === '' ? 'upload' : 'url',
	);
	let showDeleteConfirm = $state(false);
	let nameError = $state('');
	// Component instance ref (issue #131): lets the image-column click-to-edit
	// affordance open the file picker owned by the Upload-tab ImageUpload.
	let imageUploadRef: ReturnType<typeof ImageUpload> | undefined = $state();

	// Uploads made in this form session that are not persisted yet (issue #107,
	// REQ-6). The image key included in the last submit is kept on unmount.
	const pendingUploads = createPendingUploads();
	let submittedImageKey: string | null = null;

	// Image presentation metadata (#116 D1/D2 + follow-up). The editor offers three
	// modes – Fill / Fit / Manual – mapped onto the persisted fitMode enum.
	// Manual crops are edited PER TARGET: each target keeps its own rect, locked to
	// the target's aspect by the stage, so the two targets stay independent live
	// (editing one never moves the other's preview tile). An untouched session
	// passes persisted targets through verbatim (legacy base focal/zoom rows
	// included, D5); the moment the user edits ANY target, a save pins every
	// editor target explicitly – see `buildManualGiftTargets` for why.
	// svelte-ignore state_referenced_locally
	let editorMode = $state<ImageEditorMode>(giftEditorModeFromMeta(gift?.imageMeta));
	// Whether the user touched the display mode this session; an untouched form keeps
	// the persisted (possibly legacy `auto`) fitMode verbatim on save (REQ-8).
	let modeDirty = $state(false);
	type ExplicitImageBackground = '#ffffff' | '#000000';
	const IMAGE_BACKGROUND_VALUES = ['#ffffff', '#000000', 'transparent'] as const;
	// `null` is the canonical dotted/theme-derived default. Legacy metadata containing
	// the CSS keyword `transparent` is normalized here and becomes null on the next save.
	// svelte-ignore state_referenced_locally
	let bgColor = $state(normalizeFrameFill(gift?.imageMeta?.bgColor));
	// svelte-ignore state_referenced_locally
	const initialImageUrl = gift?.imageUrl ?? '';
	// svelte-ignore state_referenced_locally
	const initialImageKey = gift?.imageKey ?? '';
	const hadImageInitially = initialImageUrl !== '' || initialImageKey !== '';
	// svelte-ignore state_referenced_locally
	const legacyFitMode = hadImageInitially
		? (gift?.imageMeta?.fitMode ?? IMAGE_FIT_MODES.auto)
		: null;

	function initTargetRects(meta: ImageMetadata | null | undefined) {
		const rects = {} as Record<GiftEditorCropTarget, ImageCropRect>;
		for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
			// A persisted per-target rect restores exactly; the shared carry-over chain
			// (`resolveGiftTargetCrop`) keeps this editor seed in lockstep with the
			// renderer's fallback. Otherwise seed from the base-level metadata (issue
			// #123: a legacy row with focal/zoom but no cropRect must reconstruct its
			// real framing via seedCropRectFromLegacyMeta, not silently fall back to the
			// always-centered FULL_CROP_RECT – the stage snaps this seed to the target's
			// real aspect once the image is measured).
			const targetCrop = resolveGiftTargetCrop(meta?.targets, target);
			rects[target] =
				targetCrop !== undefined
					? { ...targetCrop.cropRect }
					: seedCropRectFromLegacyMeta(meta ?? {});
		}
		return rects;
	}

	// svelte-ignore state_referenced_locally
	let targetRects = $state(initTargetRects(gift?.imageMeta));
	let activeTarget = $state<GiftEditorCropTarget>('square');
	// Targets edited in this session; only these are (re)persisted on save.
	const dirtyTargets = new SvelteSet<GiftEditorCropTarget>();

	const styles = giftDetailModalVariants();

	let descriptionAppendText = $state('');

	// Per-segment append edit (issue #83): the index currently being edited inline, and its draft.
	let editingAppendIndex = $state<number | null>(null);
	let editingAppendText = $state('');

	const isEdit = $derived(mode === 'edit');
	const releaseGift = $derived.by((): GiftForVisitor | null => {
		if (
			!isEdit ||
			gift === null ||
			role !== WISHLIST_ROLES.moderator ||
			!isGiftForVisitor(gift, role, hideReservationState)
		) {
			return null;
		}
		return gift;
	});
	const locked = $derived(isEdit && postShareLocked);
	// Active gift grace window: full edit after sharing, or delete-only for a new post-share gift.
	const graceActive = $derived(
		isEdit && graceExpiresAt !== null && graceNow.getTime() < graceExpiresAt.getTime(),
	);
	// Reads the local seeded `description` copy (not the `gift` prop) so the frozen/append
	// branch stays self-contained and never re-toggles from a reactive prop change.
	const descriptionFrozen = $derived(locked && description.trim() !== '');
	// Edited-after-share transparency (issue #185): the recipient/moderator edit
	// surface shows the SAME muted text line as the read-only visitor detail view
	// (`GiftDetailView.svelte`) – only the surface changed, not who can see it
	// (REQ-5).
	const editedAfterShareLine = $derived(
		gift?.editedAfterShareAt != null
			? m.gift_edited_after_share_line({
					date: formatAppendDate(gift.editedAfterShareAt.toISOString()),
				})
			: null,
	);
	const currentQuantity = $derived(gift?.quantity ?? 1);
	const submitLabel = $derived(isEdit ? m.save() : m.gift_add_title());
	const hasImage = $derived(imageUrl !== '' || imageKey !== '');

	const previewSrc = $derived(
		resolveGiftImageUrl(imageUrl.trim() === '' ? null : imageUrl.trim(), imageKey),
	);
	const isCropMode = $derived(editorMode === IMAGE_EDITOR_MODES.manual);

	// A different source invalidates the persisted geometry: crops and focal points
	// target the old pixels, so a replaced image starts from the automatic framing.
	const imageReplaced = $derived(
		imageUrl.trim() !== initialImageUrl || imageKey !== initialImageKey,
	);

	// The fitMode a save would persist: legacy rows keep their stored value (incl.
	// `auto`) until the user touches the mode or replaces the image (REQ-8).
	const savedFitMode = $derived(
		modeDirty || imageReplaced || legacyFitMode === null
			? fitModeForEditorMode(editorMode)
			: legacyFitMode,
	);

	/**
	 * Outside Manual mode there are no manual crops: leaving Manual drops them on
	 * save (Fill/Fit own the framing), and a replaced image never inherits crops
	 * drawn for the old pixels. Inside Manual mode, delegates the pin-all-on-edit
	 * rule to `buildManualGiftTargets` (session independence + WYSIWYG vs. the
	 * legacy carry-over chain – see its doc comment): an untouched session passes
	 * the persisted targets through verbatim, but the moment any target is dirty
	 * every editor target is pinned from its own current session rect.
	 */
	function buildTargets(): ImageMetadata['targets'] {
		if (editorMode !== IMAGE_EDITOR_MODES.manual) {
			return undefined;
		}
		return buildManualGiftTargets(
			targetRects,
			dirtyTargets.size > 0,
			imageReplaced ? undefined : gift?.imageMeta?.targets,
		);
	}

	// Base focal/zoom/cropRect stay exactly as persisted for an unreplaced image so
	// legacy rows render unchanged (#116 REQ-8). Explicitly choosing Fill re-centers
	// the framing, and a replaced image starts from the automatic centered default.
	const currentImageMeta = $derived.by((): ImageMetadata => {
		const base = imageReplaced ? null : gift?.imageMeta;
		const recentered = base == null || (modeDirty && editorMode === IMAGE_EDITOR_MODES.fill);
		return {
			fitMode: savedFitMode,
			cropRect: recentered ? null : (base?.cropRect ?? null),
			focal: recentered ? { x: 50, y: 50 } : (base?.focal ?? { x: 50, y: 50 }),
			zoom: recentered ? 1 : (base?.zoom ?? 1),
			bgColor,
			targets: buildTargets(),
		};
	});

	const targetLabels = {
		square: () => m.gift_image_target_card(),
		thumb: () => m.gift_image_target_thumb(),
	} as const satisfies Record<GiftEditorCropTarget, () => string>;

	// Legacy `auto` honesty (#183 EXTRA): a persisted `auto` fitMode resolves to
	// cover or contain PER IMAGE at real render time (`resolveAutoFit`, comparing
	// the image's natural ratio against the target box ratio), while every
	// legacy `auto` row reads as Fill in this editor (`giftEditorModeFromMeta`).
	// Measuring the image lets the initial toggle selection – and the WYSIWYG
	// preview below – match the real card/list render exactly, WITHOUT marking
	// the form dirty or rewriting the persisted `auto` value: an untouched save
	// still writes `auto` verbatim (`savedFitMode` only reads `modeDirty`).
	let measuredNaturalRatio = $state<number | null>(null);

	$effect(() => {
		const src = previewSrc;
		if (src === null) {
			measuredNaturalRatio = null;
			return;
		}
		let cancelled = false;
		const probe = new Image();
		probe.onload = () => {
			if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
				measuredNaturalRatio = probe.naturalWidth / probe.naturalHeight;
			}
		};
		probe.src = src;
		return () => {
			cancelled = true;
		};
	});

	const legacyAutoRendersAsFit = $derived(
		legacyFitMode === IMAGE_FIT_MODES.auto &&
			!modeDirty &&
			!imageReplaced &&
			measuredNaturalRatio !== null &&
			resolveAutoFit(measuredNaturalRatio, GIFT_CROP_TARGET_SPECS.square.aspect) ===
				IMAGE_FIT_MODES.containPadded,
	);

	/**
	 * The mode actually presented (toggle selection + static preview): normalizes
	 * an untouched legacy `auto` row to match its real render instead of the
	 * always-Fill default `editorMode` starts at, so the toggle never
	 * contradicts the WYSIWYG preview. `savedFitMode`/`currentImageMeta` are
	 * unaffected – only the presentation is normalized, never the persisted data.
	 */
	const presentedEditorMode = $derived(
		legacyAutoRendersAsFit ? IMAGE_EDITOR_MODES.fit : editorMode,
	);

	// Bits UI's ToggleGroup.Root (type="single") mutates its own bindable `value`
	// on every click, including a re-click of the already-active item (see
	// GiftViewSwitcher.svelte for the full root-cause note). Passing
	// `presentedEditorMode` as a plain prop leaves the group uncontrolled, so that
	// transient deselect is never undone. A writable `$derived` local, kept in
	// sync with `presentedEditorMode` automatically, makes the rendered state
	// always resolvable, and resetting it inside setEditorMode undoes the
	// deselect. That reset always overwrites a value the two-way binding just set
	// to "" (Bits UI writes through the bound value before calling onValueChange),
	// so it's a genuine change and always re-renders.
	let selectedEditorMode = $derived(presentedEditorMode);
	// The visible Transparent option represents the canonical null fallback. Preserve an
	// unsupported historical literal untouched rather than falsely selecting a known fill.
	let selectedBgColor = $derived(
		bgColor === null
			? 'transparent'
			: (IMAGE_BACKGROUND_VALUES as readonly string[]).includes(bgColor)
				? bgColor
				: '',
	);

	// Adaptive stage sizing (#189 REQ-4/5): the stage tracks the photo's natural
	// aspect (portrait renders tall, landscape wide) within the min/max caps applied
	// on the wrapper, so the whole photo is visible at default zoom. Falls back to the
	// 4:3 card aspect until the probe (`measuredNaturalRatio`) resolves the real ratio.
	const stageAspectRatio = $derived(measuredNaturalRatio ?? GIFT_CROP_TARGET_SPECS.square.aspect);

	function setEditorMode(value: string) {
		if (value === '') {
			selectedEditorMode = presentedEditorMode;
			return;
		}
		if ((IMAGE_EDITOR_MODE_VALUES as string[]).includes(value)) {
			const nextMode = value as ImageEditorMode;
			if (nextMode === IMAGE_EDITOR_MODES.fill) {
				// Explicit Fill re-centers the framing (the `recentered` branch of
				// `currentImageMeta` below), so the static preview must show that SAME
				// centered framing (#183 REQ-6/7 WYSIWYG) instead of whatever rect
				// Manual editing or a legacy seed left in `targetRects` – reset it to
				// the "no framing yet" sentinel and let `ImageCropStage`'s own snap
				// effect resolve it to the identical centered cover-crop
				// (`centeredCropRect`) that Save persists. Fit and Manual are
				// unaffected: Fit's preview is computed independently of
				// `targetRects` (`containMode`), and Manual must keep whatever
				// framing the user actually drew.
				targetRects[activeTarget] = { ...FULL_CROP_RECT };
			}
			editorMode = nextMode;
			modeDirty = true;
		}
	}

	function setBgColor(value: string) {
		if (value === '') {
			selectedBgColor = bgColor ?? 'transparent';
			return;
		}
		if (value === 'transparent') {
			bgColor = null;
			return;
		}
		if (value === '#ffffff' || value === '#000000') {
			bgColor = value as ExplicitImageBackground;
		}
	}

	/** A zoom attempt on the plain preview is a manual-crop intent (#116 follow-up). */
	function promoteToManual() {
		if (editorMode !== IMAGE_EDITOR_MODES.manual) {
			editorMode = IMAGE_EDITOR_MODES.manual;
			modeDirty = true;
		}
	}

	/** Clicking a preview tile jumps to Manual mode with that target active. */
	function handleTileSelect(target: GiftEditorCropTarget) {
		activeTarget = target;
		promoteToManual();
	}

	function adjustGiftPrice(
		currentPrice: number | null,
		direction: 1 | -1,
		setPrice: (value: number) => void,
	): void {
		setPrice(adjustGiftPriceByMagnitude(currentPrice, direction));
	}

	function handleGiftPriceKeydown(
		event: KeyboardEvent,
		currentPrice: number | null,
		setPrice: (value: number) => void,
	): void {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
			return;
		}
		event.preventDefault();
		adjustGiftPrice(currentPrice, event.key === 'ArrowUp' ? 1 : -1, setPrice);
	}

	interface GiftPriceWheelOptions {
		getPrice: () => number | null;
		setPrice: (value: number) => void;
	}

	// Svelte attaches inline `onwheel` as a passive listener, so `preventDefault()`
	// would be ignored and the dialog would scroll while changing price. Register non-passive.
	function giftPriceWheel(node: HTMLInputElement, options: GiftPriceWheelOptions) {
		const listener = (event: WheelEvent) => {
			if (node !== document.activeElement || event.deltaY === 0) {
				return;
			}
			event.preventDefault();
			adjustGiftPrice(options.getPrice(), event.deltaY < 0 ? 1 : -1, options.setPrice);
		};
		node.addEventListener('wheel', listener, { passive: false });
		return () => node.removeEventListener('wheel', listener);
	}

	$effect(() => {
		if (priceInput !== null) {
			return giftPriceWheel(priceInput, {
				getPrice: () => price,
				setPrice: (value) => (price = value),
			});
		}
	});

	$effect(() => {
		if (priceMaxInput !== null) {
			return giftPriceWheel(priceMaxInput, {
				getPrice: () => priceMax,
				setPrice: (value) => (priceMax = value),
			});
		}
	});

	function validateForm(): boolean {
		nameError = '';
		priceRangeError = '';
		if (name.trim() === '') {
			nameError = m.gift_name_required();
			return false;
		}
		if (isPriceRange) {
			const rangeMin = finalizeGiftPrice(price);
			const rangeMax = finalizeGiftPrice(priceMax);
			if (rangeMin === null || rangeMax === null) {
				priceRangeError = m.gift_price_range_required();
				return false;
			}
			if (rangeMax < rangeMin) {
				priceRangeError = m.gift_price_range_invalid();
				return false;
			}
		}
		return true;
	}

	function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		const finalPrice = finalizeGiftPrice(price);
		// price_max only persists in range mode; toggling back to single mode drops it (REQ-1).
		const finalPriceMax = isPriceRange ? finalizeGiftPrice(priceMax) : null;
		const finalQuantity = finalizeGiftQuantity(quantity);
		const normalizedLinks = normalizeGiftLinks(links);
		const imageMeta = hasImage ? currentImageMeta : null;
		submittedImageKey = imageKey || null;

		if (mode === 'create') {
			oncreate?.({
				wishlistId,
				name: name.trim(),
				description: description.trim() || null,
				links: normalizedLinks,
				price: finalPrice,
				priceMax: finalPriceMax,
				currency,
				imageUrl: imageUrl.trim() || null,
				imageKey: imageKey || null,
				imageMeta,
				quantity: finalQuantity,
				priorityLevelId: priorityLevelId || null,
				categoryId: categoryId || null,
			});
		} else if (mode === 'edit' && gift !== null) {
			const descriptionPayload = descriptionFrozen
				? descriptionAppendText.trim() || null
				: description.trim() || null;
			onupdate?.({
				id: gift.id,
				name: name.trim(),
				description: descriptionPayload,
				links: normalizedLinks,
				price: finalPrice,
				priceMax: finalPriceMax,
				currency,
				imageUrl: imageUrl.trim() || null,
				imageKey: imageKey || null,
				imageMeta,
				quantity: finalQuantity,
				priorityLevelId: priorityLevelId || null,
				categoryId: categoryId || null,
			});
		}
	}

	function startEditAppend(index: number, text: string) {
		editingAppendIndex = index;
		editingAppendText = text;
	}

	function cancelEditAppend() {
		editingAppendIndex = null;
		editingAppendText = '';
	}

	function saveEditAppend(index: number) {
		if (gift === null || editingAppendText.trim() === '') {
			return;
		}
		onupdate?.({
			id: gift.id,
			descriptionAppendEdit: { index, text: editingAppendText.trim() },
		});
		cancelEditAppend();
	}

	function deleteAppend(index: number) {
		if (gift !== null) {
			onupdate?.({ id: gift.id, descriptionAppendEdit: { index, text: null } });
		}
	}

	function categoryLabel(category: ManagedGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}

	function handleDelete() {
		if (!showDeleteConfirm) {
			showDeleteConfirm = true;
			return;
		}
		if (gift !== null) {
			ondelete?.(gift.id);
		}
	}

	/** A new source starts from the automatic centered Fill framing. */
	function resetCropEditing() {
		editorMode = IMAGE_EDITOR_MODES.fill;
		targetRects = initTargetRects(null);
		dirtyTargets.clear();
	}

	function handleImageUpload(result: UploadResult) {
		imageKey = result.objectKey;
		imageUrl = result.publicUrl;
		pendingUploads.track(result);
		resetCropEditing();
	}

	function handleImageRemove() {
		imageKey = '';
		imageUrl = '';
		resetCropEditing();
	}

	function handleImageUploadError(uploadError: Error) {
		console.error('Image upload failed:', uploadError.message);
	}

	/**
	 * Click-to-edit affordance for the image column (issue #131): switches the
	 * right-column image field to the Upload tab and opens the native file
	 * picker. `ImageUpload` only mounts once `imageMode` becomes `'upload'`, so
	 * the picker trigger waits a tick for it to render.
	 */
	async function openImageEditor() {
		imageMode = 'upload';
		await tick();
		imageUploadRef?.openFilePicker();
	}

	// Storage cleanup (issue #107, REQ-6): uploads that were replaced, removed,
	// or abandoned before save are deleted when the form unmounts (dialog close).
	// The submitted key survives; a pre-existing gift image is never tracked here.
	$effect(() => {
		return () => {
			void pendingUploads.commit(submittedImageKey);
		};
	});
</script>

<div class={styles.body()} data-testid="gift-detail-body">
	<!-- Left column: the display-mode control on top, then the WYSIWYG stage below
	     it for all three modes (issue #183: Fill/Fit now render through the same
	     bordered stage as Manual – a static, non-interactive preview – instead of
	     a plain unbounded ImageFrame, so switching to Manual is visually
	     seamless). The square live preview tile sits at the column's lower edge –
	     it doubles as the crop target switcher (round 3) – so it costs no form
	     space. -->
	<div
		class={cn(
			styles.imageColumn(),
			// Photo-workshop treatment (issue #189 REQ-6): the inset sticker panel below
			// supplies the framing, so the shared dashed column seam stays dropped in edit
			// mode (issue #156); the column is just the dotted mat the panel floats on.
			// `h-auto` + `justify-center`: the panel takes its intrinsic (photo-aspect,
			// capped) height and centers on the mat — replacing the old fixed
			// `h-[400px]` that clipped tall portraits (issue #189 REQ-5).
			'flex h-auto flex-col justify-center border-none border-b-0 p-3 sm:border-r-0 sm:p-4',
		)}
		data-testid="gift-image-column"
	>
		{#if hasImage}
			<!-- Photo-workshop panel (issue #189 REQ-6): groups the mode pill + adaptive
			     stage + preview tiles as one designed sticker unit on the dotted mat. -->
			<div class={styles.modeSectionPanel()}>
				<!-- Display-mode control (#116 round 3): lives with the preview it drives,
				     docked on the panel's top edge. `presentedEditorMode` (#183 EXTRA)
				     normalizes an untouched legacy `auto` row to the mode it actually
				     renders as, so the highlighted pill never contradicts the stage below. -->
				<div class="flex flex-none justify-center pb-2.5">
					<ToggleGroup.Root
						type="single"
						bind:value={selectedEditorMode}
						onValueChange={setEditorMode}
						aria-label={m.image_fit_label()}
						class="rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-sticker"
					>
						<ToggleGroup.Item value={IMAGE_EDITOR_MODES.fill} class="rounded-full">
							{m.image_fit_fill()}
						</ToggleGroup.Item>
						<ToggleGroup.Item value={IMAGE_EDITOR_MODES.fit} class="rounded-full">
							{m.image_fit_fit()}
						</ToggleGroup.Item>
						<ToggleGroup.Item value={IMAGE_EDITOR_MODES.manual} class="rounded-full">
							{m.image_fit_manual()}
						</ToggleGroup.Item>
					</ToggleGroup.Root>
				</div>
				<div class="flex flex-none justify-center pb-2.5">
					<ToggleGroup.Root
						type="single"
						bind:value={selectedBgColor}
						onValueChange={setBgColor}
						aria-label={m.image_background_label()}
						class="rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-sticker"
					>
						<ToggleGroup.Item value="#ffffff" class="rounded-full">
							{m.image_background_white()}
						</ToggleGroup.Item>
						<ToggleGroup.Item value="#000000" class="rounded-full">
							{m.image_background_black()}
						</ToggleGroup.Item>
						<ToggleGroup.Item value="transparent" class="rounded-full">
							{m.image_background_transparent()}
						</ToggleGroup.Item>
					</ToggleGroup.Root>
				</div>
				{#if previewSrc !== null}
					<!-- Adaptive stage (issue #189 REQ-4/5): the whole photo renders
					     contained and always fully visible; the box tracks the photo's
					     natural aspect within min/max caps (portrait tall, landscape wide).
					     Manual: interactive per-target crop. Fill/Fit: the SAME stage,
					     non-interactive, showing exactly the cover (Fill) or letterboxed
					     (Fit) framing; a wheel gesture still promotes to Manual. -->
					<div
						class="relative min-h-[220px] w-full max-h-[46dvh] sm:max-h-[440px]"
						style="aspect-ratio: {stageAspectRatio};"
					>
						<ImageCropStage
							class="size-full"
							src={previewSrc}
							alt={name || m.gift_image_preview()}
							targetAspect={GIFT_CROP_TARGET_SPECS[activeTarget].aspect}
							targetLabel={targetLabels[activeTarget]()}
							fillColor={bgColor}
							tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
							interactive={isCropMode}
							containMode={!isCropMode &&
								presentedEditorMode === IMAGE_EDITOR_MODES.fit}
							showLabelChip={false}
							bind:cropRect={targetRects[activeTarget]}
							onchange={() => dirtyTargets.add(activeTarget)}
							onWheelPromote={promoteToManual}
						/>
						{#if !isCropMode}
							<!-- Click-to-edit affordance (issue #131 REQ-1): overlays the preview
							     without wrapping it, so wheel-zoom-to-manual and the tile switcher
							     below stay independently interactive. -->
							<Button
								type="button"
								intent="ghost-overlay"
								size="icon-sm"
								class="absolute top-2 right-2 rounded-full"
								surfaceClass="bg-surface/90 shadow-sm"
								onclick={openImageEditor}
								aria-label={m.gift_image_replace_cta()}
							>
								<PencilIcon data-icon="solo" />
							</Button>
						{/if}
					</div>
					<!-- Below the stage (not overlapping: every stage pixel matters here);
					     the tiles are the only crop-target switcher (round 3). Rendered here
					     for every mode – Fill/Fit used to float these over the stage's lower
					     edge, clipping into the photo on short stages (mobile edit modal
					     scroll fix); Manual keeps the same target highlighted, Fill/Fit
					     highlight none. -->
					<GiftImagePreviewSlots
						class="flex-none pt-2.5"
						src={previewSrc}
						alt={name || m.gift_image_preview()}
						imageMeta={currentImageMeta}
						activeTarget={isCropMode ? activeTarget : null}
						onTileSelect={handleTileSelect}
					/>
				{/if}
			</div>
		{:else}
			<!-- Empty state (issue #131 REQ-2): the whole column is an explicit
			     clickable upload placeholder, restyled as a sticker panel (issue #189
			     REQ-6) so the empty column reads as intentional as the filled one. -->
			<button
				type="button"
				class={styles.imagePlaceholder()}
				onclick={openImageEditor}
				aria-label={m.gift_image_upload_cta()}
			>
				<UploadIcon class="size-16 text-ink-faint" />
				<span class="text-sm font-semibold text-muted-foreground">
					{m.gift_image_upload_cta()}
				</span>
				<span class="text-xs text-muted-foreground">{m.gift_image_upload_hint()}</span>
			</button>
		{/if}
	</div>

	<!-- Right column: form fields scroll, the action buttons stay pinned below -->
	<div class={styles.detailColumn()}>
		<div class={styles.detailScroll()} data-testid="gift-form-scroll">
			<!-- Gift grace window (issue #83): communicates temporary full-edit/delete or delete-only access. -->
			{#if graceActive && graceExpiresAt !== null}
				<div class="mb-3">
					<GraceCountdown
						expiresAt={graceExpiresAt}
						now={graceNow}
						message={graceMessage}
					/>
				</div>
			{/if}
			<fieldset class="contents">
				<!-- Name -->
				<Field
					fieldId="gift-name"
					label={m.gift_name_label()}
					errorMessage={nameError}
					class={styles.formField()}
				>
					{#snippet children({ hasError, errorId }: FieldControlContext)}
						{#if locked}
							<SimpleTooltip text={m.gift_name_frozen_hint()} side="top">
								{#snippet asChild(tooltipProps)}
									<div {...tooltipProps} tabindex="-1" class="w-full">
										<Input
											id="gift-name"
											class="pointer-events-none"
											bind:value={name}
											placeholder={m.gift_name_placeholder()}
											disabled
											state={hasError ? 'error' : 'default'}
											aria-invalid={hasError ? true : undefined}
											aria-describedby={errorId}
										/>
									</div>
								{/snippet}
							</SimpleTooltip>
						{:else}
							<Input
								id="gift-name"
								bind:value={name}
								placeholder={m.gift_name_placeholder()}
								state={hasError ? 'error' : 'default'}
								aria-invalid={hasError ? true : undefined}
								aria-describedby={errorId}
							/>
						{/if}
					{/snippet}
				</Field>

				<!-- Description -->
				<div class="mt-3 {styles.formField()}">
					{#if descriptionFrozen}
						<Label>{m.gift_description_label()}</Label>
						<!-- Frozen base the gifter reserved against (read-only). -->
						{#if (gift?.description ?? '').trim() !== ''}
							<p class="text-sm whitespace-pre-line text-muted-foreground">
								{gift?.description}
							</p>
						{/if}
						<GiftDescription
							description={null}
							descriptionAppends={gift?.descriptionAppends ?? []}
							maxVisibleAppends={1}
						/>
						<!-- Recent description appends can be corrected only during their own grace window. -->
						{#each gift?.descriptionAppends ?? [] as append, index (`${append.addedAt}:${index}`)}
							{#if isWithinGraceWindow(append.addedAt, graceNow)}
								{#if editingAppendIndex === index}
									<div
										class="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2"
									>
										<Textarea bind:value={editingAppendText} rows={2} />
										<div class="flex gap-2">
											<Button
												size="sm"
												onclick={() => saveEditAppend(index)}
												disabled={editingAppendText.trim() === ''}
											>
												{m.save()}
											</Button>
											<Button
												size="sm"
												intent="ghost"
												onclick={cancelEditAppend}
											>
												{m.cancel()}
											</Button>
										</div>
									</div>
								{:else}
									<div
										class="flex w-fit gap-1 rounded-md border border-border bg-surface-2 p-1"
									>
										<Button
											size="icon-sm"
											intent="ghost"
											aria-label={m.gift_description_append_edit_aria()}
											onclick={() => startEditAppend(index, append.text)}
										>
											<PencilIcon />
										</Button>
										<Button
											size="icon-sm"
											intent="ghost"
											aria-label={m.gift_description_append_delete_aria()}
											onclick={() => deleteAppend(index)}
										>
											<TrashIcon />
										</Button>
									</div>
								{/if}
							{/if}
						{/each}
						<Label class="mt-2">{m.gift_description_add_note_label()}</Label>
						<Textarea bind:value={descriptionAppendText} rows={2} />
						<HelpText>{m.gift_description_add_note_help()}</HelpText>
					{:else}
						<Label for="gift-description">{m.gift_description_label()}</Label>
						<Textarea
							id="gift-description"
							bind:value={description}
							placeholder={m.gift_description_placeholder()}
							rows={3}
						/>
					{/if}
				</div>

				{#if editedAfterShareLine !== null}
					<p class="mt-2 text-xs text-muted-foreground">{editedAfterShareLine}</p>
				{/if}

				<!-- Links -->
				<div class="mt-3 {styles.formField()}">
					<GiftLinkEditor {links} onlinkschange={(updated) => (links = updated)} />
				</div>

				<!-- Price + Currency -->
				<div class="mt-3 {styles.formRow()}" data-testid="gift-price-currency-row">
					<div class={styles.formField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label for="gift-price">{m.gift_price_label()}</Label>
							<div class="flex items-center gap-1.5">
								<Label
									for="gift-price-range-switch"
									class="text-xs font-normal text-muted-foreground"
								>
									{m.gift_price_range_toggle_label()}
								</Label>
								<Switch
									id="gift-price-range-switch"
									size="sm"
									bind:checked={isPriceRange}
									onCheckedChange={() => (priceRangeError = '')}
								/>
							</div>
						</div>
						{#if isPriceRange}
							<div class="flex items-center gap-2">
								<Input
									id="gift-price"
									class="numeric-input min-w-0"
									bind:value={price}
									placeholder="0"
									type="number"
									min="0"
									step="0.01"
									onkeydown={(event) =>
										handleGiftPriceKeydown(
											event,
											price,
											(value) => (price = value),
										)}
									bind:ref={priceInput}
									aria-label={m.gift_price_range_min_aria()}
									state={priceRangeError !== '' ? 'error' : 'default'}
									aria-invalid={priceRangeError !== '' ? true : undefined}
									aria-describedby={priceRangeError !== ''
										? 'gift-price-range-error'
										: undefined}
								/>
								<span class="shrink-0 text-muted-foreground" aria-hidden="true"
									>–</span
								>
								<Input
									id="gift-price-max"
									class="numeric-input min-w-0"
									bind:value={priceMax}
									placeholder="0"
									type="number"
									min="0"
									step="0.01"
									onkeydown={(event) =>
										handleGiftPriceKeydown(
											event,
											priceMax,
											(value) => (priceMax = value),
										)}
									bind:ref={priceMaxInput}
									aria-label={m.gift_price_range_max_aria()}
									state={priceRangeError !== '' ? 'error' : 'default'}
									aria-invalid={priceRangeError !== '' ? true : undefined}
									aria-describedby={priceRangeError !== ''
										? 'gift-price-range-error'
										: undefined}
								/>
							</div>
						{:else}
							<Input
								id="gift-price"
								class="numeric-input"
								bind:value={price}
								placeholder="0"
								type="number"
								min="0"
								step="0.01"
								onkeydown={(event) =>
									handleGiftPriceKeydown(
										event,
										price,
										(value) => (price = value),
									)}
								bind:ref={priceInput}
							/>
						{/if}
						{#if priceRangeError !== ''}
							<HelpText id="gift-price-range-error" state="error"
								>{priceRangeError}</HelpText
							>
						{/if}
					</div>
					<div class={styles.formField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label>{m.gift_currency_label()}</Label>
						</div>
						<Select.Root type="single" bind:value={currency}>
							<Select.Trigger size="md" class="w-full">
								{GIFT_CURRENCY_LABELS[currency]}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									{#each Object.entries(GIFT_CURRENCIES) as [key, val] (key)}
										<Select.Item value={val} label={GIFT_CURRENCY_LABELS[val]}>
											{GIFT_CURRENCY_LABELS[val]}
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Quantity + category + priority -->
				<div class={cn('mt-3', styles.formRow())} data-testid="gift-quantity-priority-row">
					<div class={styles.formField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label for="gift-quantity">{m.gift_quantity_label()}</Label>
						</div>
						<Input
							id="gift-quantity"
							class="numeric-input"
							bind:value={quantity}
							type="number"
							min={locked ? String(currentQuantity) : '1'}
							placeholder="1"
						/>
						{#if locked}
							<HelpText
								class="w-fit rounded-md border border-border bg-surface-2 px-2 py-1"
							>
								{m.gift_quantity_frozen_help()}
							</HelpText>
						{/if}
					</div>

					<div class={styles.formField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label>{m.gift_category_label()}</Label>
						</div>
						{#if categoryOptions.length > 0}
							<Select.Root type="single" bind:value={categoryId}>
								<Select.Trigger size="md" class="w-full">
									{#if categoryId}
										{categoryLabel(
											categoryOptions.find(
												(category) => category.id === categoryId,
											) ?? categoryOptions[0]!,
										)}
									{:else}
										{m.gift_category_none()}
									{/if}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="" label={m.gift_category_none()}>
											{m.gift_category_none()}
										</Select.Item>
										{#each categoryOptions as category (category.id)}
											{@const label = categoryLabel(category)}
											<Select.Item value={category.id} {label}
												>{label}</Select.Item
											>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						{:else}
							<Select.Root type="single" disabled>
								<Select.Trigger size="md" class="w-full" disabled>
									{m.gift_category_none_enabled()}
								</Select.Trigger>
							</Select.Root>
							<HelpText>{m.gift_category_none_enabled_help()}</HelpText>
						{/if}
					</div>

					{#if priorityLevels.length > 0}
						<div class={styles.formField()}>
							<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
								<Label>{m.gift_priority_label()}</Label>
							</div>
							<Select.Root type="single" bind:value={priorityLevelId}>
								<Select.Trigger size="md" class="w-full">
									{#if priorityLevelId}
										{@const selectedLabel =
											priorityLevels.find((p) => p.id === priorityLevelId)
												?.label ?? ''}
										{selectedLabel !== ''
											? (getPriorityDisplay(selectedLabel)?.label() ??
												selectedLabel)
											: m.gift_priority_select()}
									{:else}
										{m.gift_priority_none()}
									{/if}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="" label={m.gift_priority_none()}
											>{m.gift_priority_none()}</Select.Item
										>
										{#each priorityLevels as level (level.id)}
											{@const levelLabel =
												getPriorityDisplay(level.label)?.label() ??
												level.label}
											<Select.Item value={level.id} label={levelLabel}>
												{levelLabel}
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
					{/if}
				</div>

				<!-- Image (last field: source input only – the display-mode control and
			     the clickable target tiles live in the image column with the
			     preview they drive, #116 round 3) -->
				<div class="mt-3 {styles.formField()}">
					<Label>{m.gift_image_label()}</Label>
					<div class={styles.imageTabRow()}>
						<button
							type="button"
							class={giftDetailModalVariants({
								imageTabActive: imageMode === 'upload',
							}).imageTab()}
							onclick={() => (imageMode = 'upload')}
						>
							<UploadIcon class="mr-1 inline size-3" />
							{m.gift_image_upload_tab()}
						</button>
						<button
							type="button"
							class={giftDetailModalVariants({
								imageTabActive: imageMode === 'url',
							}).imageTab()}
							onclick={() => (imageMode = 'url')}
						>
							<LinkIcon class="mr-1 inline size-3" />
							{m.gift_image_url_tab()}
						</button>
					</div>
					{#if imageMode === 'url'}
						<Input
							bind:value={imageUrl}
							placeholder="https://example.com/image.jpg"
							type="url"
						/>
					{:else}
						<ImageUpload
							bind:this={imageUploadRef}
							target="gift-image"
							size="small"
							initialPreviewUrl={previewSrc ?? undefined}
							onUpload={handleImageUpload}
							onError={handleImageUploadError}
							onRemove={handleImageRemove}
						/>
					{/if}
				</div>
			</fieldset>
		</div>

		<!-- Manager actions scroll with the form on mobile. Save is hidden here on mobile
		     and rendered by `mobileSubmitFooter` below; desktop keeps it in this block. -->
		<div class={styles.formActions()}>
			{#if isEdit && gift !== null}
				{#if releaseGift !== null}
					<ReleaseReservationButton
						gift={releaseGift}
						size="md"
						class={styles.releaseButton()}
					/>
				{/if}

				{#if canDelete}
					<Button
						intent="danger"
						class={styles.deleteButton()}
						disabled={isDeleting}
						onclick={handleDelete}
					>
						<TrashIcon data-icon="inline-start" />
						{#if showDeleteConfirm}
							{m.gift_delete_confirm()}
						{:else if isDeleting}
							{m.deleting()}
						{:else}
							{m.gift_delete()}
						{/if}
					</Button>
				{/if}
			{/if}

			<div class={styles.submitWrapper()}>
				<Button
					class={styles.submitButton()}
					disabled={isSubmitting}
					onclick={handleSubmit}
				>
					{#if isSubmitting}
						{m.saving()}
					{:else}
						{submitLabel}
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>

<!-- Mobile-only pinned Save footer (see `submitWrapper` in
     gift_detail_modal_variants.ts for why this is a separate element from the
     desktop one above): a true DOM sibling OUTSIDE `body`'s scroll, so it
     stays visible regardless of scroll position – unlike a `position: sticky`
     copy nested inside the scroll, which only re-enters view once scrolled
     down to it (mobile edit modal scroll fix, follow-up). Hidden on desktop,
     where `submitWrapper` above already renders Save inline with the manager
     actions. -->
<div class={styles.mobileSubmitFooter()} data-testid="gift-mobile-submit-footer">
	<Button class={styles.submitButton()} disabled={isSubmitting} onclick={handleSubmit}>
		{#if isSubmitting}
			{m.saving()}
		{:else}
			{submitLabel}
		{/if}
	</Button>
</div>
