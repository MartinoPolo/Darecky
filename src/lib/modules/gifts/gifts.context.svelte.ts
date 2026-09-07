import { browser } from '$app/environment';
import { createContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { Persisted, jsonSerde } from '$lib/reactivity/persisted.svelte.js';
import {
	GIFT_GROUPING_OPTIONS,
	GIFT_SORT_OPTIONS,
	GIFT_VIEW_MODES,
	NO_PRIORITY_GIFT_PRIORITY_FILTER_VALUE,
	UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE,
	type GiftByRole,
	type GiftCategoryFilterValue,
	type GiftFilterOption,
	type GiftFilters,
	type GiftForVisitor,
	type GiftGroupingOption,
	type GiftPriorityFilterValue,
	type GiftSortOption,
	type GiftViewMode,
} from './types.js';
import { computeGiftSections } from './gift_ordering.js';
import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';

type GiftsContext = ReturnType<typeof createGiftsContext>;

const LEGACY_PRIORITY_GROUPING_KEY = 'prejemesi-gift-priority-grouping';

export function wishlistGiftSortStorageKey(wishlistId: string): string {
	return `prejemesi-wishlist:${wishlistId}:gift-sort`;
}

export function wishlistGiftGroupingStorageKey(wishlistId: string): string {
	return `prejemesi-wishlist:${wishlistId}:gift-grouping`;
}

interface Serde<T> {
	serialize: (value: T) => string;
	deserialize: (value: string) => { success: true; data: T } | { success: false };
}

class ScopedPersisted<T> {
	#getDefaultValue: () => T;
	#getKey: () => string;
	#onBeforeRead: ((key: string) => void) | undefined;
	#revision = new StateRaw(0);
	#serde: Serde<T>;

	constructor(options: {
		getKey: () => string;
		serde: Serde<T>;
		defaultValue: T;
		getDefaultValue?: () => T;
		onBeforeRead?: (key: string) => void;
	}) {
		this.#getKey = options.getKey;
		this.#serde = options.serde;
		this.#getDefaultValue = options.getDefaultValue ?? (() => options.defaultValue);
		this.#onBeforeRead = options.onBeforeRead;
	}

	get current(): T {
		void this.#revision.current;
		const defaultValue = this.#getDefaultValue();
		if (!browser) {
			return defaultValue;
		}
		const key = this.#getKey();
		this.#onBeforeRead?.(key);
		let value: string | null;
		try {
			value = localStorage.getItem(key);
		} catch {
			return defaultValue;
		}
		if (value === null) {
			return defaultValue;
		}
		const parsed = this.#serde.deserialize(value);
		if (!parsed.success) {
			try {
				localStorage.setItem(key, this.#serde.serialize(defaultValue));
			} catch {
				// Repair is best effort when browser storage is unavailable.
			}
			return defaultValue;
		}
		return parsed.data;
	}

	set current(value: T) {
		if (browser) {
			try {
				localStorage.setItem(this.#getKey(), this.#serde.serialize(value));
			} catch {
				// Persisted preferences are best effort when browser storage is unavailable.
			}
		}
		this.#revision.current += 1;
	}
}

export function emptyGiftFilters(): GiftFilters {
	return {
		availableOnly: false,
		withLinkOnly: false,
		likedOnly: false,
		showReceived: false,
		categoryValues: [],
		priorityValues: [],
	};
}

export function shouldApplyLikedOnly(likedOnly: boolean, role: WishlistRole): boolean {
	return likedOnly && role !== 'recipient';
}

const [useGifts, setGiftsInternal] = createContext<GiftsContext>();
/** @public */
export { useGifts };

export function setGiftsContext(
	getWishlistId: () => string,
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	getIsArchived: () => boolean,
	getIsAuthenticated: () => boolean,
	getLikedIds: () => string[],
	getIsGiftDataLoading: () => boolean = () => false,
) {
	const context = createGiftsContext(
		getWishlistId,
		getGifts,
		getRole,
		getIsArchived,
		getIsAuthenticated,
		getLikedIds,
		getIsGiftDataLoading,
	);
	setGiftsInternal(context);
	return context;
}

function isGiftViewMode(value: unknown): value is GiftViewMode {
	return (
		typeof value === 'string' && Object.values(GIFT_VIEW_MODES).includes(value as GiftViewMode)
	);
}

function isGiftSortOption(value: unknown): value is GiftSortOption {
	return (
		typeof value === 'string' &&
		Object.values(GIFT_SORT_OPTIONS).includes(value as GiftSortOption)
	);
}

function isGiftGroupingOption(value: unknown): value is GiftGroupingOption {
	return (
		typeof value === 'string' &&
		Object.values(GIFT_GROUPING_OPTIONS).includes(value as GiftGroupingOption)
	);
}

function migrateLegacyPriorityGrouping(groupingKey: string) {
	if (!browser) {
		return;
	}
	try {
		if (localStorage.getItem(groupingKey) !== null) {
			localStorage.removeItem(LEGACY_PRIORITY_GROUPING_KEY);
			return;
		}
		if (JSON.parse(localStorage.getItem(LEGACY_PRIORITY_GROUPING_KEY) ?? 'false') === true) {
			localStorage.setItem(groupingKey, JSON.stringify(GIFT_GROUPING_OPTIONS.priority));
		}
		localStorage.removeItem(LEGACY_PRIORITY_GROUPING_KEY);
	} catch {
		// Migration is best effort when legacy state is invalid or storage is unavailable.
	}
}

function hasPriorityValue(gift: GiftByRole): boolean {
	return gift.priorityLevelId !== null && gift.prioritySortOrder !== null;
}

function hasCategoryValue(gift: GiftByRole): boolean {
	return gift.categoryId != null && gift.category != null;
}

function priorityFilterValue(gift: GiftByRole): GiftPriorityFilterValue {
	return hasPriorityValue(gift) ? gift.priorityLevelId! : NO_PRIORITY_GIFT_PRIORITY_FILTER_VALUE;
}

function categoryFilterValue(gift: GiftByRole): GiftCategoryFilterValue {
	return hasCategoryValue(gift) ? gift.categoryId! : UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE;
}

export function giftMatchesFacetFilters(gift: GiftByRole, filters: GiftFilters): boolean {
	const categoryMatches =
		filters.categoryValues.length === 0 ||
		filters.categoryValues.includes(categoryFilterValue(gift));
	const priorityMatches =
		filters.priorityValues.length === 0 ||
		filters.priorityValues.includes(priorityFilterValue(gift));
	return categoryMatches && priorityMatches;
}

function createGiftsContext(
	getWishlistId: () => string,
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	getIsArchived: () => boolean,
	getIsAuthenticated: () => boolean,
	getLikedIds: () => string[],
	getIsGiftDataLoading: () => boolean,
) {
	const gifts = new Derived(getGifts);
	const viewerRole = new Derived(getRole);
	const archived = new Derived(getIsArchived);
	const isAuthenticated = new Derived(getIsAuthenticated);
	const likedIdSet = new Derived(() => new SvelteSet(getLikedIds()));

	const reorderOverride = new StateRaw<GiftByRole[] | null>(null);
	const effectiveGifts = new Derived<GiftByRole[]>(
		() => reorderOverride.current ?? gifts.current,
	);

	const viewMode = new Persisted<GiftViewMode>({
		key: 'prejemesi-gift-view-mode',
		serde: jsonSerde(isGiftViewMode),
		defaultValue: 'card',
	});

	const sortOption = new ScopedPersisted<GiftSortOption>({
		getKey: () => wishlistGiftSortStorageKey(getWishlistId()),
		serde: jsonSerde(isGiftSortOption),
		defaultValue: GIFT_SORT_OPTIONS.ownerOrder,
	});

	const grouping = new ScopedPersisted<GiftGroupingOption>({
		getKey: () => wishlistGiftGroupingStorageKey(getWishlistId()),
		serde: jsonSerde(isGiftGroupingOption),
		defaultValue: GIFT_GROUPING_OPTIONS.none,
		getDefaultValue: () =>
			effectiveGifts.current.some(hasPriorityValue)
				? GIFT_GROUPING_OPTIONS.priority
				: GIFT_GROUPING_OPTIONS.none,
		onBeforeRead: migrateLegacyPriorityGrouping,
	});

	const filters = new StateRaw<GiftFilters>(emptyGiftFilters());

	const hasActiveFilters = new Derived(
		() =>
			filters.current.availableOnly ||
			filters.current.withLinkOnly ||
			filters.current.likedOnly ||
			filters.current.showReceived ||
			filters.current.categoryValues.length > 0 ||
			filters.current.priorityValues.length > 0,
	);

	const categoryFilterOptions = new Derived<GiftFilterOption<GiftCategoryFilterValue>[]>(() => {
		const language = getLocale().startsWith('en') ? 'en' : 'cs';
		const optionsByCategoryId: Array<
			GiftFilterOption<GiftCategoryFilterValue> & { sortOrder: number }
		> = [];
		let hasUncategorized = false;

		for (const gift of effectiveGifts.current) {
			if (hasCategoryValue(gift)) {
				if (!optionsByCategoryId.some((option) => option.value === gift.categoryId)) {
					optionsByCategoryId.push({
						value: gift.categoryId!,
						label: labelForGiftCategory(gift.category!, language),
						sortOrder: gift.category!.sortOrder,
					});
				}
			} else {
				hasUncategorized = true;
			}
		}

		const options: GiftFilterOption<GiftCategoryFilterValue>[] = optionsByCategoryId
			.toSorted((a, b) => a.sortOrder - b.sortOrder)
			.map(({ value, label }) => ({ value, label }));
		if (hasUncategorized) {
			options.push({
				value: UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE,
				label: m.gift_category_uncategorized(),
			});
		}
		return options;
	});

	const priorityFilterOptions = new Derived<GiftFilterOption<GiftPriorityFilterValue>[]>(() => {
		const optionsByPriorityId: Array<
			GiftFilterOption<GiftPriorityFilterValue> & { sortOrder: number }
		> = [];
		let hasNoPriority = false;

		for (const gift of effectiveGifts.current) {
			if (hasPriorityValue(gift)) {
				if (!optionsByPriorityId.some((option) => option.value === gift.priorityLevelId)) {
					optionsByPriorityId.push({
						value: gift.priorityLevelId!,
						label: gift.priorityLabel ?? '',
						sortOrder: gift.prioritySortOrder!,
					});
				}
			} else {
				hasNoPriority = true;
			}
		}

		const options: GiftFilterOption<GiftPriorityFilterValue>[] = optionsByPriorityId
			.toSorted((a, b) => a.sortOrder - b.sortOrder)
			.map(({ value, label }) => ({ value, label }));
		if (hasNoPriority) {
			options.push({
				value: NO_PRIORITY_GIFT_PRIORITY_FILTER_VALUE,
				label: m.gift_priority_none(),
			});
		}
		return options;
	});

	const hasAnyPriority = new Derived(() => effectiveGifts.current.some(hasPriorityValue));
	const hasAnyCategory = new Derived(() => effectiveGifts.current.some(hasCategoryValue));
	const groupingAvailability = new Derived(() => ({
		priority: hasAnyPriority.current,
		category: hasAnyCategory.current,
	}));
	const effectiveGrouping = new Derived(() => {
		const current = grouping.current;
		return (current === GIFT_GROUPING_OPTIONS.priority &&
			!groupingAvailability.current.priority) ||
			(current === GIFT_GROUPING_OPTIONS.category && !groupingAvailability.current.category)
			? GIFT_GROUPING_OPTIONS.none
			: current;
	});

	$effect(() => {
		if (getIsGiftDataLoading()) {
			return;
		}
		const effective = effectiveGrouping.current;
		if (browser && grouping.current !== effective) {
			grouping.current = effective;
		}
	});

	const filteredGifts = new Derived<GiftByRole[]>(() => {
		let result = [...effectiveGifts.current];

		const currentFilters = filters.current;
		if (!currentFilters.showReceived) {
			result = result.filter((giftItem) => !giftItem.received);
		}
		if (currentFilters.availableOnly && viewerRole.current !== 'recipient') {
			result = result.filter((giftItem) => {
				const visitorGift = giftItem as GiftForVisitor;
				return !visitorGift.isFullyReserved;
			});
		}
		if (currentFilters.withLinkOnly) {
			result = result.filter((giftItem) => giftItem.links.length > 0);
		}
		if (shouldApplyLikedOnly(currentFilters.likedOnly, viewerRole.current)) {
			result = result.filter((giftItem) => likedIdSet.current.has(giftItem.id));
		}
		result = result.filter((giftItem) => giftMatchesFacetFilters(giftItem, currentFilters));

		return result;
	});

	const giftSections = new Derived(() =>
		computeGiftSections(
			filteredGifts.current,
			viewerRole.current,
			sortOption.current,
			effectiveGrouping.current,
			getLocale(),
		),
	);

	const sortedAndFilteredGifts = new Derived<GiftByRole[]>(() =>
		giftSections.current.flatMap((section) => section.gifts),
	);

	const giftCount = new Derived(() => effectiveGifts.current.length);
	const filteredCount = new Derived(() => sortedAndFilteredGifts.current.length);

	function setActiveGiftOrder(orderedActiveIds: readonly string[]) {
		reorderOverride.current = effectiveGifts.current.map((giftItem) => {
			const activeSortOrder = orderedActiveIds.indexOf(giftItem.id);
			return activeSortOrder === -1 ? giftItem : { ...giftItem, sortOrder: activeSortOrder };
		});
	}

	function clearReorderOverride() {
		reorderOverride.current = null;
	}

	return {
		gifts,
		effectiveGifts,
		viewerRole,
		archived,
		isAuthenticated,
		viewMode,
		grouping,
		effectiveGrouping,
		groupingAvailability,
		sortOption,
		filters,
		hasActiveFilters,
		categoryFilterOptions,
		priorityFilterOptions,
		hasAnyPriority,
		hasAnyCategory,
		giftSections,
		sortedAndFilteredGifts,
		giftCount,
		filteredCount,
		setActiveGiftOrder,
		clearReorderOverride,
	};
}
