<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as Select from '$lib/components/base/select/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListPlusIcon from '@lucide/svelte/icons/list-plus';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import CheckIcon from '@lucide/svelte/icons/check';
	import HandIcon from '@lucide/svelte/icons/hand';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ListFilterPlusIcon from '@lucide/svelte/icons/list-filter-plus';
	import BellOffIcon from '@lucide/svelte/icons/bell-off';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import MoreHorizontalIcon from '@lucide/svelte/icons/ellipsis';
	import GiftSortSelect from '$lib/components/blocks/gift/GiftSortSelect.svelte';
	import {
		GIFT_SORT_KEYS,
		GIFT_SORT_LABELS,
	} from '$lib/components/blocks/gift/gift_sort_options.js';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import {
		ActiveFilterPills,
		FilterMenu,
		normalizeActiveFilters,
		type FilterDefinition,
		type FilterFacetGroup,
	} from '$lib/components/derived/filter-menu/index.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import { flushSync, onMount, tick, type Snippet } from 'svelte';
	import { emptyGiftFilters } from '$lib/modules/gifts/gifts.context.svelte.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import {
		GIFT_GROUPING_OPTIONS,
		GIFT_SORT_OPTIONS,
		type GiftCategoryFilterValue,
		type GiftFilterOption,
		type GiftFilters,
		type GiftGroupingOption,
		type GiftPriorityFilterValue,
		type GiftSortOption,
		type GiftViewMode,
	} from '$lib/modules/gifts/types.js';

	interface WishlistDetailToolbarProps {
		canManage: boolean;
		adminSettingsAvailable?: boolean;
		role: WishlistRole;
		isArchived: boolean;
		isAuthenticated: boolean;
		viewMode: GiftViewMode;
		sortOption: GiftSortOption;
		filters: GiftFilters;
		grouping: GiftGroupingOption;
		groupingAvailability: { priority: boolean; category: boolean };
		categoryFilterOptions: GiftFilterOption<GiftCategoryFilterValue>[];
		priorityFilterOptions: GiftFilterOption<GiftPriorityFilterValue>[];
		reorderMode: boolean;
		recipientViewPreview: boolean;
		onrecipientviewpreviewchange: (active: boolean) => void;
		onreordermodechange: (active: boolean) => void;
		onviewmodechange: (mode: GiftViewMode) => void;
		onsortchange: (sort: GiftSortOption) => void;
		onfilterchange: (filters: GiftFilters) => void;
		ongroupingchange: (grouping: GiftGroupingOption) => void;
		onsettings: () => void;
		onunfollow: () => void;
		onaddgift: () => void;
		onbatchadd: () => void;
		onselectionstart: () => void;
		selectionContent?: Snippet;
	}

	let {
		canManage,
		adminSettingsAvailable = false,
		role,
		isArchived,
		isAuthenticated,
		viewMode,
		sortOption,
		filters,
		grouping,
		groupingAvailability,
		categoryFilterOptions,
		priorityFilterOptions,
		reorderMode,
		recipientViewPreview,
		onrecipientviewpreviewchange,
		onreordermodechange,
		onviewmodechange,
		onsortchange,
		onfilterchange,
		ongroupingchange,
		onsettings,
		onunfollow,
		onaddgift,
		onbatchadd,
		onselectionstart,
		selectionContent,
	}: WishlistDetailToolbarProps = $props();

	const canPreviewRecipientView = $derived(
		role === WISHLIST_ROLES.visitor || role === WISHLIST_ROLES.moderator,
	);
	const showAvailableFilter = $derived(
		role !== WISHLIST_ROLES.recipient && !recipientViewPreview,
	);
	const noActiveFilters = $derived(
		!filters.availableOnly &&
			!filters.withLinkOnly &&
			!filters.likedOnly &&
			!filters.showReceived &&
			filters.categoryValues.length === 0 &&
			filters.priorityValues.length === 0,
	);
	const canReorder = $derived(
		canManage &&
			(role === WISHLIST_ROLES.recipient || role === WISHLIST_ROLES.moderator) &&
			!isArchived &&
			(viewMode === 'card' || viewMode === 'list') &&
			grouping === GIFT_GROUPING_OPTIONS.none,
	);
	const showLikedFilter = $derived(
		isAuthenticated && role !== WISHLIST_ROLES.recipient && !recipientViewPreview,
	);
	const showReset = $derived(
		!noActiveFilters ||
			sortOption !== GIFT_SORT_OPTIONS.ownerOrder ||
			grouping !== GIFT_GROUPING_OPTIONS.none,
	);
	const showManagementActions = $derived(canManage && !isArchived);
	const showSettingsAction = $derived(showManagementActions || adminSettingsAvailable);
	const showUnfollowAction = $derived(!canManage && !isArchived && isAuthenticated);
	const showActions = $derived(showManagementActions || showSettingsAction || showUnfollowAction);
	const showMobileMore = $derived(
		showReset || canPreviewRecipientView || showUnfollowAction || showManagementActions,
	);

	const GROUPING_LABELS = {
		none: () => m.gift_grouping_none(),
		priority: () => m.gift_grouping_priority(),
		category: () => m.gift_grouping_category(),
	} satisfies Record<GiftGroupingOption, () => string>;
	const groupingCombinedLabel = $derived(
		`${m.gift_grouping_label()}: ${GROUPING_LABELS[grouping]()}`,
	);

	function clearGiftFilters() {
		onfilterchange(emptyGiftFilters());
	}

	function resetDisplayControls() {
		onfilterchange(emptyGiftFilters());
		onsortchange(GIFT_SORT_OPTIONS.ownerOrder);
		ongroupingchange(GIFT_GROUPING_OPTIONS.none);
	}

	function updateCategoryFilter(value: GiftCategoryFilterValue, checked: boolean) {
		const values = checked
			? [...filters.categoryValues, value]
			: filters.categoryValues.filter((selected) => selected !== value);
		onfilterchange({ ...filters, categoryValues: [...new Set(values)] });
	}

	function isGroupingOptionAvailable(option: GiftGroupingOption) {
		return option === GIFT_GROUPING_OPTIONS.none || groupingAvailability[option];
	}

	function updatePriorityFilter(value: GiftPriorityFilterValue, checked: boolean) {
		const values = checked
			? [...filters.priorityValues, value]
			: filters.priorityValues.filter((selected) => selected !== value);
		onfilterchange({ ...filters, priorityValues: [...new Set(values)] });
	}

	const filterDefinitions = $derived<FilterDefinition[]>([
		...(showAvailableFilter
			? [
					{
						id: 'available-only',
						menuLabel: m.gift_filter_available_only(),
						checked: filters.availableOnly,
						onchange: (availableOnly: boolean) =>
							onfilterchange({ ...filters, availableOnly }),
					},
				]
			: []),
		{
			id: 'with-link-only',
			menuLabel: m.gift_filter_with_link(),
			checked: filters.withLinkOnly,
			onchange: (withLinkOnly: boolean) => onfilterchange({ ...filters, withLinkOnly }),
		},
		...(showLikedFilter
			? [
					{
						id: 'liked-only',
						menuLabel: m.gift_filter_liked(),
						checked: filters.likedOnly,
						onchange: (likedOnly: boolean) => onfilterchange({ ...filters, likedOnly }),
					},
				]
			: []),
		{
			id: 'show-received',
			menuLabel: m.gift_filter_show_received(),
			checked: filters.showReceived,
			onchange: (showReceived: boolean) => onfilterchange({ ...filters, showReceived }),
		},
	]);

	type OpenDisplayControl = 'sort' | 'grouping' | 'filter';

	let filterTriggerElement = $state<HTMLButtonElement | null>(null);
	let mobileReorderDoneButton = $state<HTMLButtonElement | null>(null);
	let mobileDisplayTrigger = $state<HTMLButtonElement | null>(null);
	let mobileMoreTrigger = $state<HTMLButtonElement | null>(null);
	let openDisplayControl = $state<OpenDisplayControl | null>(null);
	let mobileOpenDisplayControl = $state<OpenDisplayControl | null>(null);
	let mobileMoreOpen = $state(false);
	let mobileViewportMode = $state<boolean | null>(null);
	let mobileSheetScrollPosition = $state({ x: 0, y: 0 });
	let mobileSheetRestoreTrigger = $state<HTMLButtonElement | null>(null);
	let mobileSheetFocusRestorationScheduled = false;
	let mobileSheetScrollCapturedFromPointer = false;
	let mobileSheetFocusFrame: number | null = null;
	let mobileSheetScrollFrame: number | null = null;

	function resetMobileSheetState() {
		if (mobileSheetFocusFrame !== null) {
			cancelAnimationFrame(mobileSheetFocusFrame);
			mobileSheetFocusFrame = null;
		}
		if (mobileSheetScrollFrame !== null) {
			cancelAnimationFrame(mobileSheetScrollFrame);
			mobileSheetScrollFrame = null;
		}
		mobileOpenDisplayControl = null;
		mobileMoreOpen = false;
		mobileSheetRestoreTrigger = null;
		mobileSheetScrollCapturedFromPointer = false;
		mobileSheetFocusRestorationScheduled = false;
	}

	onMount(() => {
		const mobileViewportQuery = window.matchMedia('(max-width: 639px)');
		const updateMobileViewportMode = (event: MediaQueryListEvent) => {
			openDisplayControl = null;
			resetMobileSheetState();
			mobileViewportMode = event.matches;
		};

		flushSync(() => {
			mobileViewportMode = mobileViewportQuery.matches;
		});
		mobileViewportQuery.addEventListener('change', updateMobileViewportMode);

		return () => {
			mobileViewportQuery.removeEventListener('change', updateMobileViewportMode);
			resetMobileSheetState();
		};
	});

	$effect(() => {
		if (reorderMode) {
			openDisplayControl = null;
			resetMobileSheetState();
		}
	});

	function updateOpenDisplayControl(control: OpenDisplayControl, open: boolean) {
		if (open) {
			openDisplayControl = control;
		} else if (openDisplayControl === control) {
			openDisplayControl = null;
		}
	}

	function captureMobileSheetScrollPosition() {
		if (mobileOpenDisplayControl === null) {
			mobileSheetScrollPosition = { x: window.scrollX, y: window.scrollY };
			mobileSheetScrollCapturedFromPointer = true;
		}
	}

	function cancelMobileSheetPointerCapture() {
		mobileSheetScrollCapturedFromPointer = false;
	}

	function openMobileDisplaySheet(control: OpenDisplayControl = 'sort') {
		if (mobileOpenDisplayControl === null) {
			mobileMoreOpen = false;
			mobileSheetRestoreTrigger = mobileDisplayTrigger;
			if (!mobileSheetScrollCapturedFromPointer) {
				mobileSheetScrollPosition = { x: window.scrollX, y: window.scrollY };
			}
		}
		mobileSheetScrollCapturedFromPointer = false;
		mobileOpenDisplayControl = control;
	}

	function handleMobileMoreOpenChange(open: boolean) {
		mobileMoreOpen = open;
		if (!open) {
			requestAnimationFrame(() => mobileMoreTrigger?.focus({ preventScroll: true }));
		}
	}

	function runMobileMoreAction(action: () => void) {
		mobileMoreOpen = false;
		action();
	}

	function closeMobileDisplaySheet() {
		const trigger = mobileSheetRestoreTrigger;
		const scrollPosition = mobileSheetScrollPosition;
		if (mobileOpenDisplayControl === null || mobileSheetFocusRestorationScheduled) {
			return;
		}
		mobileSheetFocusRestorationScheduled = true;
		mobileOpenDisplayControl = null;
		mobileSheetFocusFrame = requestAnimationFrame(() => {
			mobileSheetFocusFrame = null;
			trigger?.focus({ preventScroll: true });
			window.scrollTo(scrollPosition.x, scrollPosition.y);
			mobileSheetScrollFrame = requestAnimationFrame(() => {
				window.scrollTo(scrollPosition.x, scrollPosition.y);
				mobileSheetScrollFrame = requestAnimationFrame(() => {
					mobileSheetScrollFrame = null;
					window.scrollTo(scrollPosition.x, scrollPosition.y);
					mobileSheetRestoreTrigger = null;
					mobileSheetFocusRestorationScheduled = false;
				});
			});
		});
	}

	function handleFilterRowClick(
		event: MouseEvent,
		checked: boolean,
		onchange: (checked: boolean) => void,
	) {
		if ((event.target as Element).closest("[data-slot='checkbox']")) {
			return;
		}
		onchange(!checked);
	}

	function filterRowActivation(
		node: HTMLElement,
		state: { checked: boolean; onchange: (checked: boolean) => void },
	) {
		let currentState = state;
		const handleClick = (event: MouseEvent) =>
			handleFilterRowClick(event, currentState.checked, currentState.onchange);
		node.addEventListener('click', handleClick);
		return {
			update(nextState: typeof state) {
				currentState = nextState;
			},
			destroy() {
				node.removeEventListener('click', handleClick);
			},
		};
	}

	function handleMobileSheetOpenChange(open: boolean) {
		if (!open) {
			closeMobileDisplaySheet();
		}
	}

	async function changeMobileReorderMode(active: boolean) {
		const scrollPosition = { x: window.scrollX, y: window.scrollY };
		onreordermodechange(active);
		await tick();
		const focusTarget = active ? mobileReorderDoneButton : mobileMoreTrigger;
		focusTarget?.focus({ preventScroll: true });
		window.scrollTo(scrollPosition.x, scrollPosition.y);
	}

	const filterFacets = $derived<FilterFacetGroup[]>([
		{
			id: 'category',
			label: m.gift_filter_category_heading(),
			options: categoryFilterOptions.map((option) => ({
				value: option.value,
				label: option.label,
				checked: filters.categoryValues.includes(option.value),
				onchange: (checked: boolean) => updateCategoryFilter(option.value, checked),
			})),
		},
		{
			id: 'priority',
			label: m.gift_filter_priority_heading(),
			options: priorityFilterOptions.map((option) => ({
				value: option.value,
				label: option.label,
				checked: filters.priorityValues.includes(option.value),
				onchange: (checked: boolean) => updatePriorityFilter(option.value, checked),
			})),
		},
	]);
	const activeFilters = $derived(normalizeActiveFilters(filterDefinitions, filterFacets));

	let previousReorderMode = $state<boolean | null>(null);
	let reorderAnnouncement = $state('');
	$effect(() => {
		if (previousReorderMode === null) {
			previousReorderMode = reorderMode;
		} else if (reorderMode !== previousReorderMode) {
			reorderAnnouncement = reorderMode
				? m.gift_reorder_mode_entered()
				: m.gift_reorder_mode_exited();
			previousReorderMode = reorderMode;
		}
	});
</script>

{#snippet viewControls()}
	<div class="toolbar-view-controls" data-testid="wishlist-toolbar-view-controls">
		{#if canPreviewRecipientView}
			<SimpleTooltip
				text={recipientViewPreview
					? m.recipient_view_preview_turn_off()
					: m.recipient_view_preview_turn_on()}
			>
				<Button
					size="icon"
					intent="ghost"
					aria-label={recipientViewPreview
						? m.recipient_view_preview_turn_off()
						: m.recipient_view_preview_turn_on()}
					aria-pressed={recipientViewPreview}
					disabled={reorderMode}
					aria-describedby="recipient-view-preview-description recipient-view-preview-status"
					onclick={() => onrecipientviewpreviewchange(!recipientViewPreview)}
				>
					{#if recipientViewPreview}<EyeOffIcon />{:else}<EyeIcon />{/if}
				</Button>
			</SimpleTooltip>
			<span id="recipient-view-preview-description" class="sr-only">
				{m.recipient_view_preview_description()}
			</span>
			<span id="recipient-view-preview-status" class="sr-only" aria-live="polite">
				{recipientViewPreview
					? m.recipient_view_preview_status_on()
					: m.recipient_view_preview_status_off()}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet groupingControl()}
	<Select.Root
		type="single"
		value={grouping}
		disabled={reorderMode}
		open={openDisplayControl === 'grouping'}
		onOpenChange={(open) => updateOpenDisplayControl('grouping', open)}
		onValueChange={(newValue) => {
			if (Object.values(GIFT_GROUPING_OPTIONS).includes(newValue as GiftGroupingOption)) {
				ongroupingchange(newValue as GiftGroupingOption);
			}
		}}
	>
		<Select.Trigger
			size="md"
			appearance="raised"
			class="toolbar-grouping-control min-w-0"
			surfaceClass="px-3 group-hover:bg-accent group-hover:text-accent-foreground"
			aria-label={groupingCombinedLabel}
			title={groupingCombinedLabel}
		>
			<LayersIcon
				class="size-4 shrink-0 text-muted-foreground"
				data-toolbar-icon="grouping"
			/>
			<span class="min-w-0 truncate">{GROUPING_LABELS[grouping]()}</span>
		</Select.Trigger>
		<Select.Content preventScroll={false}>
			<Select.Group>
				<Select.GroupHeading>{m.gift_grouping_label()}</Select.GroupHeading>
				<Select.Item value={GIFT_GROUPING_OPTIONS.none} label={m.gift_grouping_none()} />
				<Select.Item
					value={GIFT_GROUPING_OPTIONS.priority}
					label={m.gift_grouping_priority()}
					disabled={!groupingAvailability.priority}
				/>
				<Select.Item
					value={GIFT_GROUPING_OPTIONS.category}
					label={m.gift_grouping_category()}
					disabled={!groupingAvailability.category}
				/>
			</Select.Group>
		</Select.Content>
	</Select.Root>
{/snippet}

{#snippet filterControls()}
	<div class="toolbar-filter-controls">
		<FilterMenu
			class="toolbar-filter-control"
			triggerClass="w-full justify-between"
			bind:triggerElement={filterTriggerElement}
			definitions={filterDefinitions}
			disabled={reorderMode}
			facets={filterFacets}
			{activeFilters}
			showActivePills={false}
			alwaysShowClearAllInMenu
			triggerLabel={m.gift_filter()}
			menuHeading={m.gift_filter()}
			clearAllLabel={m.wishlist_detail_clear_filters()}
			onclearall={clearGiftFilters}
			removeFilterLabel={(label) => m.filter_remove({ label })}
			activeCountLabel={(count) => m.filter_active_count({ count })}
			align="end"
			open={openDisplayControl === 'filter'}
			onopenchange={(open) => updateOpenDisplayControl('filter', open)}
		/>
		{#if showReset}
			<div class="toolbar-reset-control">
				<SimpleTooltip text={m.gift_display_reset_tooltip()}>
					<Button
						size="icon"
						intent="ghost"
						aria-label={m.gift_display_reset_aria()}
						disabled={reorderMode}
						onclick={resetDisplayControls}
					>
						<RotateCcwIcon data-toolbar-icon="reset" />
					</Button>
				</SimpleTooltip>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet displayControls(includeSort = true)}
	<div class="toolbar-display-controls" data-testid="wishlist-toolbar-display-controls">
		{#if includeSort}
			<GiftSortSelect
				class="toolbar-sort-control"
				value={sortOption}
				disabled={reorderMode}
				onchange={onsortchange}
				open={openDisplayControl === 'sort'}
				onopenchange={(open) => updateOpenDisplayControl('sort', open)}
			/>
		{/if}
		{@render groupingControl()}
		{@render filterControls()}
	</div>
{/snippet}

{#snippet mobileDisplayControls()}
	<div class="mobile-browse-row" data-mobile-toolbar-row>
		<GiftViewSwitcher value={viewMode} onchange={onviewmodechange} disabled={reorderMode} />
		<div class="mobile-browse-spacer"></div>
		<SimpleTooltip text={m.gift_display_options()}>
			<Button
				bind:ref={mobileDisplayTrigger}
				size="icon"
				intent="outline"
				class="mobile-display-trigger"
				data-testid="mobile-display-trigger"
				aria-label={activeFilters.length > 0
					? `${m.gift_display_options()}: ${m.filter_active_count({ count: activeFilters.length })}`
					: m.gift_display_options()}
				aria-haspopup="dialog"
				aria-expanded={mobileOpenDisplayControl !== null}
				disabled={reorderMode}
				onpointerdown={captureMobileSheetScrollPosition}
				onpointercancel={cancelMobileSheetPointerCapture}
				onclick={() => openMobileDisplaySheet()}
			>
				<SlidersHorizontalIcon data-toolbar-icon="display" />
				{#if activeFilters.length > 0}
					<span class="mobile-filter-count" data-filter-count aria-hidden="true"
						>{activeFilters.length}</span
					>
				{/if}
			</Button>
		</SimpleTooltip>
		{#if showMobileMore}
			<SimpleTooltip text={m.wishlist_more_actions()}>
				<Button
					bind:ref={mobileMoreTrigger}
					size="icon"
					intent="outline"
					data-testid="mobile-more-trigger"
					aria-label={m.wishlist_more_actions()}
					aria-haspopup="dialog"
					aria-expanded={mobileMoreOpen}
					onclick={() => {
						mobileOpenDisplayControl = null;
						mobileMoreOpen = true;
					}}
				>
					<MoreHorizontalIcon />
				</Button>
			</SimpleTooltip>
		{/if}
		{#if showSettingsAction}
			<SimpleTooltip text={m.wishlist_settings_title()}>
				<Button
					size="icon"
					intent="outline"
					aria-label={m.wishlist_settings_title()}
					onclick={onsettings}
				>
					<SettingsIcon />
				</Button>
			</SimpleTooltip>
		{/if}
		{#if showManagementActions}
			<Button
				size="icon"
				intent="primary"
				aria-label={m.wishlist_detail_add_gift_label()}
				title={m.wishlist_detail_add_wish()}
				onclick={onaddgift}
			>
				<PlusIcon />
			</Button>
		{/if}
	</div>
{/snippet}

{#snippet mobileReorderControls()}
	<div class="mobile-reorder-row" data-mobile-toolbar-row>
		<strong class="mobile-mode-label">{m.gift_reorder_mode_label()}</strong>
		<Button
			bind:ref={mobileReorderDoneButton}
			size="md"
			intent="primary"
			class="mobile-reorder-done"
			aria-label={m.gift_reorder_done()}
			onclick={() => changeMobileReorderMode(false)}
		>
			<CheckIcon
				data-icon="inline-start"
				data-toolbar-icon="reorder-done"
				data-lucide="check"
			/>
			<span>{m.gift_reorder_done()}</span>
		</Button>
	</div>
{/snippet}

{#snippet mobileMoreSheet()}
	<Sheet.Root open={mobileMoreOpen} onOpenChange={handleMobileMoreOpenChange}>
		{#if mobileMoreOpen}
			<WishlistBottomSheet portalDisabled>
				<Sheet.Header class="border-border border-b px-4 py-3">
					<Sheet.Title>{m.wishlist_more_actions()}</Sheet.Title>
					<Sheet.Description>{m.wishlist_more_actions_description()}</Sheet.Description>
				</Sheet.Header>
				<div class="mobile-more-actions">
					{#if showReset}
						<Button
							intent="ghost"
							onclick={() => runMobileMoreAction(resetDisplayControls)}
						>
							<RotateCcwIcon
								data-icon="inline-start"
							/>{m.gift_display_reset_tooltip()}
						</Button>
					{/if}
					{#if canPreviewRecipientView}
						<Button
							intent="ghost"
							aria-pressed={recipientViewPreview}
							onclick={() =>
								runMobileMoreAction(() =>
									onrecipientviewpreviewchange(!recipientViewPreview),
								)}
						>
							{#if recipientViewPreview}<EyeOffIcon
									data-icon="inline-start"
								/>{:else}<EyeIcon data-icon="inline-start" />{/if}
							{recipientViewPreview
								? m.recipient_view_preview_turn_off()
								: m.recipient_view_preview_turn_on()}
						</Button>
					{/if}
					{#if showUnfollowAction}
						<Button intent="ghost" onclick={() => runMobileMoreAction(onunfollow)}>
							<BellOffIcon data-icon="inline-start" />{m.wishlist_detail_unfollow()}
						</Button>
					{/if}
					{#if showManagementActions}
						<Button
							intent="ghost"
							onclick={() => runMobileMoreAction(onselectionstart)}
						>
							<ListChecksIcon data-icon="inline-start" />{m.gift_selection_toolbar()}
						</Button>
						{#if canReorder}
							<Button
								intent="ghost"
								onclick={() =>
									runMobileMoreAction(() => void changeMobileReorderMode(true))}
							>
								<HandIcon data-icon="inline-start" />{m.gift_reorder_action()}
							</Button>
						{/if}
						<Button intent="ghost" onclick={() => runMobileMoreAction(onbatchadd)}>
							<ListPlusIcon data-icon="inline-start" />{m.batch_add_toolbar_label()}
						</Button>
					{/if}
				</div>
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{/snippet}

{#snippet mobileDisplaySheet()}
	<Sheet.Root open={mobileOpenDisplayControl !== null} onOpenChange={handleMobileSheetOpenChange}>
		{#if mobileOpenDisplayControl !== null}
			<WishlistBottomSheet
				class="mobile-display-sheet"
				portalDisabled
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<Sheet.Header class="border-border shrink-0 border-b px-4 py-3">
					<Sheet.Title>{m.gift_display_options()}</Sheet.Title>
					<Sheet.Description>
						{mobileOpenDisplayControl === 'sort'
							? `${m.gift_sort_by()}: ${GIFT_SORT_LABELS[sortOption]()}`
							: mobileOpenDisplayControl === 'grouping'
								? `${m.gift_grouping_label()}: ${GROUPING_LABELS[grouping]()}`
								: `${m.gift_filter()}: ${
										activeFilters.length > 0
											? m.filter_active_count({ count: activeFilters.length })
											: '0'
									}`}
					</Sheet.Description>
				</Sheet.Header>
				<div class="mobile-sheet-scroll" data-testid="mobile-sheet-scroll">
					{#if mobileOpenDisplayControl === 'sort'}
						{#each GIFT_SORT_KEYS as option (option)}
							<label class="mobile-sheet-choice">
								<input
									type="radio"
									name="mobile-gift-sort"
									value={option}
									checked={sortOption === option}
									onchange={() => {
										onsortchange(option);
										closeMobileDisplaySheet();
									}}
								/>
								<span>{GIFT_SORT_LABELS[option]()}</span>
							</label>
						{/each}
					{:else if mobileOpenDisplayControl === 'grouping'}
						{#each Object.values(GIFT_GROUPING_OPTIONS) as option (option)}
							<label
								class="mobile-sheet-choice"
								class:mobile-sheet-choice-disabled={!isGroupingOptionAvailable(
									option,
								)}
							>
								<input
									type="radio"
									name="mobile-gift-grouping"
									value={option}
									checked={grouping === option}
									disabled={!isGroupingOptionAvailable(option)}
									onchange={() => {
										ongroupingchange(option);
										closeMobileDisplaySheet();
									}}
								/>
								<span>{GROUPING_LABELS[option]()}</span>
							</label>
						{/each}
					{:else}
						{#each filterDefinitions as definition (definition.id)}
							<div
								class="mobile-sheet-choice"
								use:filterRowActivation={{
									checked: definition.checked,
									onchange: definition.onchange,
								}}
							>
								<Checkbox
									checked={definition.checked}
									onCheckedChange={definition.onchange}
									aria-label={definition.menuLabel}
								/>
								<span>{definition.menuLabel}</span>
							</div>
						{/each}
						{#each filterFacets as facet (facet.id)}
							<section class="mobile-filter-section">
								<h3>{facet.label}</h3>
								{#each facet.options as option (option.value)}
									<div
										class="mobile-sheet-choice"
										use:filterRowActivation={{
											checked: option.checked,
											onchange: option.onchange,
										}}
									>
										<Checkbox
											checked={option.checked}
											onCheckedChange={option.onchange}
											aria-label={option.label}
										/>
										<span>{option.label}</span>
									</div>
								{/each}
							</section>
						{/each}
						{#if activeFilters.length > 0}
							<Button class="m-3" intent="ghost" size="lg" onclick={clearGiftFilters}
								>{m.wishlist_detail_clear_filters()}</Button
							>
						{/if}
					{/if}
				</div>
				<div
					class="mobile-sheet-switcher"
					role="group"
					aria-label={m.gift_display_options()}
					data-testid="mobile-sheet-switcher"
				>
					<Button
						size="md"
						intent="ghost"
						aria-pressed={mobileOpenDisplayControl === 'sort'}
						data-testid="mobile-sheet-sort-switch"
						onclick={() => openMobileDisplaySheet('sort')}
						><ArrowUpDownIcon data-icon="inline-start" />{m.gift_sort_by()}</Button
					>
					<Button
						size="md"
						intent="ghost"
						aria-pressed={mobileOpenDisplayControl === 'grouping'}
						data-testid="mobile-sheet-grouping-switch"
						onclick={() => openMobileDisplaySheet('grouping')}
						><LayersIcon data-icon="inline-start" />{m.gift_grouping_label()}</Button
					>
					<Button
						size="md"
						intent="ghost"
						aria-pressed={mobileOpenDisplayControl === 'filter'}
						data-testid="mobile-sheet-filter-switch"
						onclick={() => openMobileDisplaySheet('filter')}
						><ListFilterPlusIcon data-icon="inline-start" />{m.gift_filter()}</Button
					>
				</div>
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{/snippet}

{#snippet activeFilterRegion()}
	{#if activeFilters.length > 0}
		<div class="toolbar-active-filters min-w-0" data-testid="wishlist-toolbar-active-filters">
			<ActiveFilterPills
				class="min-w-0"
				items={activeFilters}
				disabled={reorderMode}
				clearAllLabel={m.wishlist_detail_clear_filters()}
				onclearall={clearGiftFilters}
				removeFilterLabel={(label) => m.filter_remove({ label })}
				triggerElement={filterTriggerElement}
			/>
		</div>
	{/if}
{/snippet}

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{reorderAnnouncement}
</div>

<div class="wishlist-toolbar-sticky sticky top-3 z-(--z-sticky) min-w-0">
	<div class="wishlist-toolbar-mask" data-testid="wishlist-toolbar-mask" aria-hidden="true"></div>
	<div
		class="wishlist-toolbar relative z-[1] min-w-0 rounded-panel border-[2.5px] border-ink bg-card shadow-sticker"
		data-testid="wishlist-toolbar"
	>
		{#if selectionContent}
			<div class="toolbar-layout min-w-0 toolbar-layout-selection">
				<div class="toolbar-selection-content min-w-0">{@render selectionContent()}</div>
			</div>
		{:else}
			<div
				class="toolbar-responsive-carrier"
				class:toolbar-desktop={mobileViewportMode === false}
			>
				<div
					class="toolbar-layout min-w-0"
					class:toolbar-responsive-layout={mobileViewportMode !== false}
				>
					<div
						class="toolbar-controls min-w-0"
						class:toolbar-responsive-controls={mobileViewportMode !== false}
						data-testid={mobileViewportMode === false
							? 'wishlist-toolbar-controls'
							: undefined}
					>
						{#if mobileViewportMode === false}
							<div class="toolbar-responsive-view-switcher">
								<GiftViewSwitcher
									value={viewMode}
									onchange={onviewmodechange}
									disabled={reorderMode}
								/>
							</div>
						{/if}

						{#if mobileViewportMode === false}
							{@render viewControls()}
							{@render displayControls()}

							{#if canReorder}
								<div
									class="toolbar-edit-controls"
									data-testid="wishlist-toolbar-edit-controls"
								>
									<Button
										size="md"
										intent={reorderMode ? 'primary' : 'outline'}
										class="reorder-mode-action min-w-0 max-w-full"
										title={reorderMode
											? m.gift_reorder_done()
											: m.gift_reorder_action()}
										aria-label={reorderMode
											? m.gift_reorder_done()
											: m.gift_reorder_action()}
										onclick={() => onreordermodechange(!reorderMode)}
									>
										<span class="reorder-mode-icon-stack" aria-hidden="true">
											<HandIcon
												class={`reorder-mode-content${!reorderMode ? ' reorder-mode-content-active' : ''}`}
												data-icon="inline-start"
												data-toolbar-icon="reorder"
											/>
											<CheckIcon
												class={`reorder-mode-content${reorderMode ? ' reorder-mode-content-active' : ''}`}
												data-icon="inline-start"
												data-toolbar-icon="reorder-done"
											/>
										</span>
										<span
											class="reorder-mode-label-stack min-w-0"
											aria-hidden="true"
										>
											<span
												class="reorder-mode-content min-w-0 truncate"
												class:reorder-mode-content-active={!reorderMode}
											>
												{m.gift_reorder_action()}
											</span>
											<span
												class="reorder-mode-content min-w-0 truncate"
												class:reorder-mode-content-active={reorderMode}
												data-reorder-mode-label
											>
												{m.gift_reorder_done()}
											</span>
										</span>
									</Button>
								</div>
							{/if}
						{/if}
					</div>

					{#if mobileViewportMode === false}
						{@render activeFilterRegion()}

						{#if showActions}
							<div
								class="toolbar-actions min-w-0"
								data-testid="wishlist-toolbar-actions"
							>
								{#if showSettingsAction}
									<SimpleTooltip text={m.wishlist_settings_title()}>
										<Button
											size="icon"
											intent="outline"
											aria-label={m.wishlist_settings_title()}
											disabled={reorderMode}
											onclick={onsettings}
										>
											<SettingsIcon />
										</Button>
									</SimpleTooltip>
								{/if}
								{#if showUnfollowAction}
									<Button
										size="md"
										intent="ghost"
										class="min-w-0 max-w-48 shrink"
										title={m.wishlist_detail_unfollow()}
										disabled={reorderMode}
										onclick={onunfollow}
									>
										<span class="min-w-0 truncate"
											>{m.wishlist_detail_unfollow()}</span
										>
									</Button>
								{/if}
								{#if showManagementActions}
									<SimpleTooltip text={m.batch_add_toolbar_label()}>
										<Button
											size="icon"
											intent="outline"
											aria-label={m.batch_add_toolbar_label()}
											disabled={reorderMode}
											onclick={onbatchadd}
										>
											<ListPlusIcon />
										</Button>
									</SimpleTooltip>
									<Button
										size="md"
										class="min-w-0 max-w-44 shrink"
										aria-label={m.wishlist_detail_add_gift_label()}
										disabled={reorderMode}
										title={m.wishlist_detail_add_wish()}
										onclick={onaddgift}
									>
										<PlusIcon data-icon="inline-start" />
										<span class="min-w-0 truncate"
											>{m.wishlist_detail_add_wish()}</span
										>
									</Button>
								{/if}
							</div>
						{/if}
					{/if}
				</div>
			</div>

			{#if mobileViewportMode === null || mobileViewportMode}
				<div class="toolbar-mobile" data-testid="wishlist-toolbar-mobile">
					{#if reorderMode}
						{@render mobileReorderControls()}
					{:else}
						{@render mobileDisplayControls()}
					{/if}
				</div>
				{@render mobileDisplaySheet()}
				{@render mobileMoreSheet()}
			{/if}
		{/if}
	</div>
</div>

<style>
	.wishlist-toolbar-sticky {
		isolation: isolate;
		max-width: 100%;
	}

	.wishlist-toolbar-mask {
		position: absolute;
		z-index: 0;
		inset-block: -0.75rem 0;
		inset-inline-start: 50%;
		inline-size: 100cqw;
		transform: translateX(-50%);
		background: var(--app-page-background);
		backdrop-filter: blur(10px);
		pointer-events: auto;
	}

	.wishlist-toolbar-mask::after {
		position: absolute;
		inset-block-start: 100%;
		inset-inline: 0;
		block-size: 1.5rem;
		background: var(--app-page-background);
		backdrop-filter: blur(10px);
		content: '';
		mask-image: linear-gradient(to bottom, #000, transparent);
		pointer-events: none;
	}

	.wishlist-toolbar {
		container-name: wishlist-toolbar;
		container-type: inline-size;
		max-width: 100%;
		overflow: visible;
		padding: 4px 8px;
	}

	.toolbar-responsive-carrier,
	.toolbar-responsive-layout,
	.toolbar-controls.toolbar-responsive-controls {
		display: contents;
	}

	.toolbar-responsive-view-switcher {
		position: absolute;
		z-index: 1;
		inset-block-start: 4px;
		inset-inline-start: 8px;
	}

	.toolbar-mobile {
		display: grid;
		min-width: 0;
		grid-auto-rows: 46px;
		gap: 8px;
	}

	.toolbar-desktop {
		display: none;
	}

	.mobile-browse-row,
	.mobile-reorder-row {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.mobile-reorder-row {
		justify-content: space-between;
	}

	.mobile-mode-label {
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-heading);
		font-size: var(--text-sm);
		text-overflow: ellipsis;
	}

	.toolbar-mobile :global(.mobile-reorder-done) {
		width: auto;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
		padding-inline: 1rem;
	}

	.mobile-browse-spacer {
		min-width: 0;
		flex: 1 1 auto;
		margin-inline-end: -6px;
	}

	.toolbar-mobile :global(button),
	.toolbar-responsive-view-switcher :global([data-slot='toggle-group-item']) {
		width: 40px;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
		padding: 0;
	}

	:global(.mobile-display-trigger) {
		position: relative;
	}

	.mobile-filter-count {
		position: absolute;
		top: -5px;
		right: -5px;
		display: grid;
		min-width: 18px;
		height: 18px;
		place-items: center;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--status-warning);
		color: var(--ink);
		font-size: 0.625rem;
		font-weight: 800;
		line-height: 1;
	}

	:global(.wishlist-bottom-sheet.mobile-display-sheet) {
		height: 80dvh;
	}

	.mobile-sheet-switcher {
		display: flex;
		min-width: 0;
		flex: 0 0 auto;
		gap: 0.25rem;
		border-top: 1px solid var(--border);
		padding: 0.5rem;
	}

	.mobile-sheet-switcher :global(button) {
		min-width: 0;
		min-height: 40px;
		flex: 1 1 0;
		padding-inline: 0.375rem;
		font-size: 0.6875rem;
	}

	.mobile-sheet-switcher :global(button[aria-pressed='true']) {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
		background: var(--accent);
	}

	.mobile-sheet-scroll {
		min-height: 0;
		flex: 1 1 auto;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.5rem;
	}

	.mobile-sheet-choice {
		display: flex;
		min-height: 48px;
		align-items: center;
		gap: 0.75rem;
		border-radius: var(--radius-btn);
		padding: 0.5rem 0.75rem;
		font-weight: 650;
	}

	.mobile-sheet-choice:hover {
		background: var(--accent);
	}

	.mobile-sheet-choice input[type='radio'] {
		width: 20px;
		height: 20px;
		accent-color: var(--primary);
	}

	.mobile-sheet-choice-disabled {
		opacity: 0.5;
	}

	.mobile-filter-section {
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
	}

	.mobile-more-actions {
		display: flex;
		min-height: 0;
		flex-direction: column;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.mobile-more-actions :global(button) {
		min-height: 48px;
		width: 100%;
		justify-content: flex-start;
	}

	@media (width <= 639px) {
		.toolbar-selection-content :global(.selection-toolbar) {
			gap: 4px;
		}

		.toolbar-selection-content :global(button),
		.toolbar-selection-content :global([data-slot='checkbox']) {
			min-width: 40px;
			min-height: 40px;
		}
	}

	.mobile-filter-section h3 {
		padding: 0.25rem 0.75rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.toolbar-layout {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.625rem;
	}

	.toolbar-controls,
	.toolbar-actions,
	.toolbar-active-filters,
	.toolbar-view-controls,
	.toolbar-display-controls,
	.toolbar-edit-controls,
	.toolbar-selection-content {
		min-width: 0;
	}

	.toolbar-controls {
		display: grid;
		width: max-content;
		max-width: 100%;
		flex: 0 0 auto;
		grid-template-columns: minmax(0, 1fr);
		align-items: center;
		gap: 0.625rem;
	}

	.toolbar-view-controls,
	.toolbar-edit-controls {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.toolbar-display-controls {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.625rem;
	}

	:global(.toolbar-sort-control),
	:global(.toolbar-grouping-control) {
		width: fit-content;
		max-width: 100%;
	}

	.toolbar-filter-controls {
		display: flex;
		min-width: 0;
		max-width: 100%;
		align-items: center;
		gap: 0.625rem;
	}

	:global(.toolbar-filter-control) {
		width: min(9.5rem, 100%);
	}

	.toolbar-actions {
		display: flex;
		width: max-content;
		max-width: 100%;
		flex: 0 0 auto;
		flex-wrap: nowrap;
		order: 1;
		align-items: center;
		align-self: flex-end;
		margin-inline-start: auto;
		gap: 0.5rem;
	}

	.toolbar-active-filters {
		display: flex;
		width: 100%;
		max-width: 100%;
		flex: 0 0 100%;
		order: 2;
	}

	.toolbar-layout-selection {
		align-items: stretch;
		gap: 0.75rem;
	}

	.toolbar-selection-content {
		display: flex;
		min-width: 0;
		width: 100%;
		flex: 1 1 100%;
	}

	:global(.reorder-mode-action) {
		width: 8.5rem;
		transition-duration: 200ms;
	}

	.reorder-mode-icon-stack,
	.reorder-mode-label-stack {
		display: inline-grid;
		min-width: 0;
	}

	.reorder-mode-icon-stack {
		width: 1rem;
		flex: 0 0 1rem;
	}

	:global(.reorder-mode-content) {
		grid-area: 1 / 1;
		opacity: 0;
		transition: opacity 200ms ease;
	}

	:global(.reorder-mode-content-active) {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.reorder-mode-action),
		:global(.reorder-mode-content) {
			transition-duration: 0ms;
		}
	}

	@media (width >= 640px) {
		.wishlist-toolbar {
			padding: 0.375rem 0.875rem;
		}

		.toolbar-responsive-view-switcher {
			position: static;
			flex: 0 0 auto;
		}

		.toolbar-mobile {
			display: none;
		}

		.toolbar-desktop {
			display: block;
			min-width: 0;
			flex: 1 1 auto;
		}

		.toolbar-responsive-view-switcher :global([data-slot='toggle-group-item']) {
			width: auto;
			min-width: 32px;
			height: 32px;
			min-height: 32px;
			padding-inline: 0.5rem;
		}

		.toolbar-layout-selection {
			align-items: center;
		}

		.toolbar-controls {
			display: flex;
			flex-wrap: wrap;
			gap: 0.625rem 0.875rem;
		}

		.toolbar-display-controls {
			width: max-content;
			flex: 0 0 auto;
			flex-wrap: nowrap;
		}

		:global(.toolbar-sort-control),
		:global(.toolbar-grouping-control) {
			width: 11rem;
		}

		:global(.toolbar-filter-control) {
			width: 9.5rem;
		}

		.toolbar-edit-controls {
			margin-inline-start: 0.25rem;
			border-inline-start: 2px solid color-mix(in oklab, var(--ink) 25%, transparent);
			padding-inline-start: 0.75rem;
		}

		.toolbar-layout-selection .toolbar-selection-content {
			flex: 1 1 auto;
		}
	}
</style>
