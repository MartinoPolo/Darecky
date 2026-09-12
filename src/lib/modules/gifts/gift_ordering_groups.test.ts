import { describe, it, expect } from 'vitest';
import { GIFT_GROUPING_OPTIONS, GIFT_SORT_OPTIONS } from './types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	GIFT_SECTION_KINDS,
	computeGiftSections,
	computeUnprioritizedRank,
	giftSectionHasHeader,
	sortGifts,
} from './gift_ordering.js';
import { flatIds, LOCALE, makeGift } from './gift_ordering.test_fixtures.js';

describe('computeGiftSections — priority grouping (grouping on)', () => {
	const high = { priorityLevelId: 'lvl-high', priorityLabel: 'Vysoká', prioritySortOrder: 1 };
	const medium = { priorityLevelId: 'lvl-med', priorityLabel: 'Střední', prioritySortOrder: 2 };
	const low = { priorityLevelId: 'lvl-low', priorityLabel: 'Nízká', prioritySortOrder: 3 };

	it('orders groups by level order with Bez priority last (issue #246)', () => {
		const gHigh = makeGift({ id: 'h', ...high });
		const gMed = makeGift({ id: 'm', ...medium });
		const gLow = makeGift({ id: 'l', ...low });
		const gNone = makeGift({ id: 'n' });
		const sections = computeGiftSections(
			[gLow, gNone, gHigh, gMed],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			GIFT_GROUPING_OPTIONS.priority,
			LOCALE,
		);

		const kinds = sections.map((s) => s.kind);
		const labels = sections.map((s) => s.label);
		expect(kinds).toEqual([
			GIFT_SECTION_KINDS.priorityGroup,
			GIFT_SECTION_KINDS.priorityGroup,
			GIFT_SECTION_KINDS.priorityGroup,
			GIFT_SECTION_KINDS.noPriority,
		]);
		// High, Medium, Low, then Bez priority last.
		expect(labels[0]).toBe('Vysoká');
		expect(labels[1]).toBe('Střední');
		expect(labels[2]).toBe('Nízká');
		expect(flatIds(sections)).toEqual(['h', 'm', 'l', 'n']);
	});

	it('carries the stable priority key for localization without changing the stored label', () => {
		const sections = computeGiftSections(
			[
				makeGift({
					id: 'h',
					priorityLevelId: 'lvl-high',
					priorityLabel: 'Vysoka',
					prioritySortOrder: 1,
				}),
			],
			WISHLIST_ROLES.recipient,
			GIFT_SORT_OPTIONS.priority,
			GIFT_GROUPING_OPTIONS.priority,
			LOCALE,
		);

		expect(sections[0]).toMatchObject({ label: 'Vysoka', priorityKey: 'Vysoka' });
	});

	it('keeps the own-reservation band above all priority groups (behavior 6)', () => {
		const mine = makeGift({ id: 'mine', myReservationId: 'res-1', ...high });
		const gMed = makeGift({ id: 'm', ...medium });
		const sections = computeGiftSections(
			[gMed, mine],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			GIFT_GROUPING_OPTIONS.priority,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		expect(sections[0].gifts.map((g) => g.id)).toEqual(['mine']);
		expect(sections.slice(1).every((s) => s.kind === GIFT_SECTION_KINDS.priorityGroup)).toBe(
			true,
		);
	});

	it('sinks fully-reserved-not-mine gifts within each group for a visitor (behavior 7)', () => {
		const availHigh = makeGift({ id: 'ah', ...high });
		const resHigh = makeGift({ id: 'rh', ...high, isFullyReserved: true });
		const sections = computeGiftSections(
			[resHigh, availHigh],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.ownerOrder,
			GIFT_GROUPING_OPTIONS.priority,
			LOCALE,
		);

		const highGroup = sections.find((s) => s.label === 'Vysoká');
		expect(highGroup?.gifts.map((g) => g.id)).toEqual(['ah', 'rh']);
	});

	it('does NOT sink reserved gifts within groups for a moderator (behavior 7, moderator excepted)', () => {
		const availHigh = makeGift({ id: 'ah', ...high, sortOrder: 2 });
		const resHigh = makeGift({ id: 'rh', ...high, sortOrder: 1, isFullyReserved: true });
		const sections = computeGiftSections(
			[resHigh, availHigh],
			WISHLIST_ROLES.moderator,
			GIFT_SORT_OPTIONS.ownerOrder,
			GIFT_GROUPING_OPTIONS.priority,
			LOCALE,
		);

		const highGroup = sections.find((s) => s.label === 'Vysoká');
		// Owner order preserved (sortOrder 1 then 2) — no sinking.
		expect(highGroup?.gifts.map((g) => g.id)).toEqual(['rh', 'ah']);
	});
});

describe('computeGiftSections — category grouping (issue #246)', () => {
	const books = {
		categoryId: 'category-books',
		category: {
			id: 'category-books',
			presetKey: null,
			customLabel: 'Knihy',
			color: '#2563EB',
			sortOrder: 2,
		},
	};
	const toys = {
		categoryId: 'category-toys',
		category: {
			id: 'category-toys',
			presetKey: null,
			customLabel: 'Hračky',
			color: '#D97706',
			sortOrder: 1,
		},
	};

	it('orders category groups by manager sort order and uncategorized last', () => {
		const book = makeGift({ id: 'book', ...books });
		const toy = makeGift({ id: 'toy', ...toys });
		const none = makeGift({ id: 'none' });
		const sections = computeGiftSections(
			[book, none, toy],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.ownerOrder,
			GIFT_GROUPING_OPTIONS.category,
			LOCALE,
		);

		expect(sections.map((section) => section.kind)).toEqual([
			GIFT_SECTION_KINDS.categoryGroup,
			GIFT_SECTION_KINDS.categoryGroup,
			GIFT_SECTION_KINDS.uncategorized,
		]);
		expect(sections.map((section) => section.label)).toEqual(['Hračky', 'Knihy', null]);
		expect(flatIds(sections)).toEqual(['toy', 'book', 'none']);
	});

	it('applies the selected sort inside every category group', () => {
		const expensive = makeGift({ id: 'expensive', ...books, price: 300, sortOrder: 1 });
		const cheap = makeGift({ id: 'cheap', ...books, price: 100, sortOrder: 2 });
		const sections = computeGiftSections(
			[expensive, cheap],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priceAsc,
			GIFT_GROUPING_OPTIONS.category,
			LOCALE,
		);

		expect(sections[0].gifts.map((gift) => gift.id)).toEqual(['cheap', 'expensive']);
	});
});

describe('computeGiftSections — received partition (#240)', () => {
	it('always emits one final received section under every sort, role, and grouping mode', () => {
		const active = makeGift({ id: 'active', sortOrder: 3, isFullyReserved: true });
		const receivedA = makeGift({ id: 'received-a', received: true, sortOrder: 2, price: 200 });
		const receivedB = makeGift({ id: 'received-b', received: true, sortOrder: 1, price: 100 });

		for (const role of Object.values(WISHLIST_ROLES)) {
			for (const sortOption of Object.values(GIFT_SORT_OPTIONS)) {
				for (const grouping of [
					GIFT_GROUPING_OPTIONS.none,
					GIFT_GROUPING_OPTIONS.priority,
					GIFT_GROUPING_OPTIONS.category,
				]) {
					const sections = computeGiftSections(
						[receivedA, active, receivedB],
						role,
						sortOption,
						grouping,
						LOCALE,
					);
					const received = sections.at(-1);
					expect(received?.kind).toBe(GIFT_SECTION_KINDS.received);
					expect(received?.gifts.map((gift) => gift.id).sort()).toEqual([
						'received-a',
						'received-b',
					]);
					expect(sections.slice(0, -1).flatMap((section) => section.gifts)).toEqual([
						active,
					]);
					expect(giftSectionHasHeader(received!)).toBe(true);
				}
			}
		}
	});

	it('sorts received gifts within their final section with owner order as the stable tie-breaker', () => {
		const later = makeGift({ id: 'later', received: true, name: 'Same', sortOrder: 2 });
		const earlier = makeGift({ id: 'earlier', received: true, name: 'Same', sortOrder: 1 });
		const sections = computeGiftSections(
			[later, earlier],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.name,
			GIFT_GROUPING_OPTIONS.none,
			LOCALE,
		);
		expect(flatIds(sections)).toEqual(['earlier', 'later']);
	});
});

describe('priority rank for unprioritized gifts', () => {
	const high = { priorityLevelId: 'lvl-high', priorityLabel: 'Vysoká', prioritySortOrder: 1 };
	const medium = { priorityLevelId: 'lvl-med', priorityLabel: 'Střední', prioritySortOrder: 2 };
	const low = { priorityLevelId: 'lvl-low', priorityLabel: 'Nízká', prioritySortOrder: 3 };

	it('ranks unprioritized last (issue #246)', () => {
		const gifts = [
			makeGift({ id: 'h', ...high }),
			makeGift({ id: 'm', ...medium }),
			makeGift({ id: 'l', ...low }),
			makeGift({ id: 'n' }),
		];
		const sorted = sortGifts(gifts, GIFT_SORT_OPTIONS.priority, LOCALE);
		expect(sorted.map((g) => g.id)).toEqual(['h', 'm', 'l', 'n']);
	});

	it('computeUnprioritizedRank returns after the max present sort order', () => {
		const gifts = [makeGift({ ...high }), makeGift({ ...medium }), makeGift({ ...low })];
		expect(computeUnprioritizedRank(gifts)).toBe(4);
	});

	it('returns 0 when no gift carries a priority', () => {
		expect(computeUnprioritizedRank([makeGift(), makeGift()])).toBe(0);
	});
});
