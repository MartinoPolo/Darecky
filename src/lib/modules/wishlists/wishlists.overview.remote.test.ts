import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	expectWhereToContain,
	expectWhereNotToContain,
	expressionTreeReferences,
	findWhereContaining,
	expression,
} from './wishlists.remote.test-expressions.js';
import {
	mockDbInstance,
	RECIPIENT_ID,
	makeWishlistRow,
	makeForSomeoneWishlistRow,
	makeRecipientAuthContext,
	makeOtherAuthContext,
	makeModeratorAuthContext,
	callGetMyWishlists,
	callGetModeratedWishlists,
	callGetFollowedWishlists,
	callGetHomeOverview,
} from './wishlists.remote.test-setup.js';

function latestWherePayload(): unknown {
	const payloads = mockDbInstance.wherePayloads();
	const payload = payloads[payloads.length - 1];
	expect(payload).toBeDefined();
	return payload;
}

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

describe('dashboard role predicates', () => {
	it('attaches each role predicate while preserving archived dashboard history', async () => {
		mockDbInstance.pushResult([]);
		await callGetMyWishlists(makeRecipientAuthContext());
		const ownWhere = latestWherePayload();
		expectWhereToContain(ownWhere, 'eq', 'wishlist.recipientUserId', RECIPIENT_ID);
		expectWhereToContain(ownWhere, 'isNull', 'wishlist.deletedAt');
		expect(expressionTreeReferences(ownWhere, 'wishlist.status')).toBe(false);

		mockDbInstance.pushResult([]);
		await callGetModeratedWishlists(makeRecipientAuthContext());
		const moderatedWhere = latestWherePayload();
		expectWhereToContain(moderatedWhere, 'eq', 'moderatorAssignment.userId', RECIPIENT_ID);
		expectWhereToContain(moderatedWhere, 'isNull', 'moderatorAssignment.deletedAt');
		expectWhereToContain(moderatedWhere, 'isNull', 'wishlist.deletedAt');
		expect(expressionTreeReferences(moderatedWhere, 'wishlist.status')).toBe(false);

		mockDbInstance.pushResult([]);
		await callGetFollowedWishlists(makeRecipientAuthContext());
		const followedWhere = latestWherePayload();
		expectWhereToContain(followedWhere, 'eq', 'wishlistFollower.userId', RECIPIENT_ID);
		expectWhereToContain(
			followedWhere,
			'or',
			expression('isNull', 'wishlist.recipientUserId'),
			expression('ne', 'wishlist.recipientUserId', RECIPIENT_ID),
		);
		expectWhereToContain(followedWhere, 'isNull', 'wishlist.deletedAt');
		expectWhereNotToContain(followedWhere, 'isNull', 'wishlistFollower.unfollowedAt');
		expect(expressionTreeReferences(followedWhere, 'wishlist.status')).toBe(false);
	});
});

// ── getHomeOverview (issue #225) ─────────────────────────────────────────────

describe('getHomeOverview', () => {
	it('starts all three independent role queries before any query settles', async () => {
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([]);
		mockDbInstance.deferStatements();

		const overviewPromise = callGetHomeOverview(RECIPIENT_ID);
		await vi.waitFor(() => expect(mockDbInstance.statementCount()).toBe(3));
		mockDbInstance.releaseStatements();

		await expect(overviewPromise).resolves.toMatchObject({
			own: { total: 0 },
			moderated: { total: 0 },
			followed: { total: 0 },
		});
	});
	it('omits every reservation field from own dashboard and home results', async () => {
		const unsafeWishlist = makeWishlistRow({
			reservedGifts: 9,
			availableGifts: 8,
			myReservations: 7,
			myPurchased: 6,
		});
		mockDbInstance.pushResult([{ wishlist: unsafeWishlist, totalGifts: '3' }]); // dashboard own
		mockDbInstance.pushResult([
			{ wishlist: unsafeWishlist, totalGifts: '3', lastVisitedAt: null },
		]); // home own
		mockDbInstance.pushResult([]); // home moderated
		mockDbInstance.pushResult([]); // home followed

		const dashboard = await callGetMyWishlists(makeRecipientAuthContext());
		const home = await callGetHomeOverview(RECIPIENT_ID);

		for (const item of [dashboard[0]!, home.own.items[0]!]) {
			expect(item).not.toHaveProperty('reservedGifts');
			expect(item).not.toHaveProperty('availableGifts');
			expect(item).not.toHaveProperty('myReservations');
			expect(item).not.toHaveProperty('myPurchased');
		}
	});

	it('normalizes every role count to numbers in dashboard and home paths', async () => {
		const ownDbRow = { wishlist: makeWishlistRow(), totalGifts: '3' };
		const moderatedDbRow = {
			wishlist: makeForSomeoneWishlistRow(),
			recipientDisplayName: 'Grandma',
			totalGifts: '5',
			reservedGifts: '2',
		};
		const followedDbRow = {
			wishlist: makeForSomeoneWishlistRow(),
			recipientDisplayName: 'Grandma',
			availableGifts: '4',
			myReservations: '2',
			myPurchased: '1',
			unfollowedAt: null,
		};
		mockDbInstance.pushResult([ownDbRow]);
		mockDbInstance.pushResult([moderatedDbRow]);
		mockDbInstance.pushResult([followedDbRow]);
		mockDbInstance.pushResult([{ ...ownDbRow, lastVisitedAt: null }]);
		mockDbInstance.pushResult([{ ...moderatedDbRow, lastVisitedAt: null }]);
		mockDbInstance.pushResult([{ ...followedDbRow, followDate: null, lastVisitedAt: null }]);

		const dashboardOwn = await callGetMyWishlists(makeRecipientAuthContext());
		const dashboardModerated = await callGetModeratedWishlists(makeModeratorAuthContext());
		const dashboardFollowed = await callGetFollowedWishlists(makeOtherAuthContext());
		const home = await callGetHomeOverview(RECIPIENT_ID);

		expect(dashboardOwn[0]).toMatchObject({ totalGifts: 3 });
		expect(dashboardModerated[0]).toMatchObject({ totalGifts: 5, reservedGifts: 2 });
		expect(dashboardFollowed[0]).toMatchObject({
			availableGifts: 4,
			myReservations: 2,
			myPurchased: 1,
		});
		expect(home.own.items[0]).toMatchObject({ totalGifts: 3 });
		expect(home.moderated.items[0]).toMatchObject({ totalGifts: 5, reservedGifts: 2 });
		expect(home.followed.items[0]).toMatchObject({
			availableGifts: 4,
			myReservations: 2,
			myPurchased: 1,
		});
	});

	it('attaches each shared role predicate and home-only filter to its outer query', async () => {
		mockDbInstance.pushResult([]); // own
		mockDbInstance.pushResult([]); // moderated
		mockDbInstance.pushResult([]); // followed

		await callGetHomeOverview(RECIPIENT_ID);

		const wherePayloads = mockDbInstance.wherePayloads();
		const ownWhere = findWhereContaining(
			wherePayloads,
			'eq',
			'wishlist.recipientUserId',
			RECIPIENT_ID,
		);
		const moderatedWhere = findWhereContaining(
			wherePayloads,
			'eq',
			'moderatorAssignment.userId',
			RECIPIENT_ID,
		);
		const followedWhere = findWhereContaining(
			wherePayloads,
			'eq',
			'wishlistFollower.userId',
			RECIPIENT_ID,
		);

		expectWhereToContain(ownWhere, 'isNull', 'wishlist.deletedAt');
		expectWhereToContain(moderatedWhere, 'isNull', 'moderatorAssignment.deletedAt');
		expectWhereToContain(moderatedWhere, 'isNull', 'wishlist.deletedAt');
		expectWhereToContain(
			followedWhere,
			'or',
			expression('isNull', 'wishlist.recipientUserId'),
			expression('ne', 'wishlist.recipientUserId', RECIPIENT_ID),
		);
		expectWhereToContain(followedWhere, 'isNull', 'wishlistFollower.unfollowedAt');
		expectWhereToContain(followedWhere, 'isNull', 'wishlist.deletedAt');
	});

	function ownRow(overrides: Record<string, unknown> = {}) {
		return {
			wishlist: makeWishlistRow(overrides),
			totalGifts: 3,
			lastVisitedAt: null,
			...overrides,
		};
	}

	it('keeps dashboard history while home applies active-follow and non-archived filters', async () => {
		const archivedOwn = { wishlist: makeWishlistRow({ status: 'archived' }), totalGifts: '3' };
		const historicalFollow = {
			wishlist: makeForSomeoneWishlistRow({ status: 'archived' }),
			recipientDisplayName: 'Grandma',
			availableGifts: '1',
			myReservations: '0',
			myPurchased: '0',
			unfollowedAt: new Date('2026-01-01'),
		};
		mockDbInstance.pushResult([archivedOwn]);
		mockDbInstance.pushResult([historicalFollow]);

		const ownDashboard = await callGetMyWishlists(makeRecipientAuthContext());
		const ownDashboardWhere = latestWherePayload();
		expect(expressionTreeReferences(ownDashboardWhere, 'wishlist.status')).toBe(false);
		const followedDashboard = await callGetFollowedWishlists(makeRecipientAuthContext());
		const followedDashboardWhere = latestWherePayload();
		expect(ownDashboard).toHaveLength(1);
		expect(followedDashboard).toHaveLength(1);
		expectWhereNotToContain(followedDashboardWhere, 'isNull', 'wishlistFollower.unfollowedAt');
		expect(expressionTreeReferences(followedDashboardWhere, 'wishlist.status')).toBe(false);

		const homeWhereStart = mockDbInstance.wherePayloads().length;
		mockDbInstance.pushResult([{ ...archivedOwn, lastVisitedAt: null }]);
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([]);
		const home = await callGetHomeOverview(RECIPIENT_ID);
		const homeWherePayloads = mockDbInstance.wherePayloads().slice(homeWhereStart);
		const followedHomeWhere = findWhereContaining(
			homeWherePayloads,
			'eq',
			'wishlistFollower.userId',
			RECIPIENT_ID,
		);

		expect(home.own.total).toBe(0);
		expectWhereToContain(followedHomeWhere, 'isNull', 'wishlistFollower.unfollowedAt');
	});

	it('caps each category at 10 items while reporting the true total, excluding archived', async () => {
		// Own: 11 active + 1 archived → total 11, items capped at 10.
		const ownRows = [
			...Array.from({ length: 11 }, (_unused, index) =>
				ownRow({ id: `own-${index}`, status: 'active' }),
			),
			ownRow({ id: 'own-archived', status: 'archived' }),
		];
		mockDbInstance.pushResult(ownRows); // own select
		mockDbInstance.pushResult([]); // moderated select
		mockDbInstance.pushResult([]); // followed select

		const result = await callGetHomeOverview(RECIPIENT_ID);

		expect(result.own.total).toBe(11);
		expect(result.own.items).toHaveLength(10);
	});

	it('own rows expose a gift count', async () => {
		mockDbInstance.pushResult([ownRow({ id: 'own-1', status: 'active' })]); // own
		mockDbInstance.pushResult([]); // moderated
		mockDbInstance.pushResult([]); // followed

		const result = await callGetHomeOverview(RECIPIENT_ID);

		expect(result.own.items[0]).toHaveProperty('totalGifts');
	});

	it('builds the Nedávné row across all roles, capped at 6', async () => {
		const ownRows = Array.from({ length: 4 }, (_unused, index) =>
			ownRow({
				id: `own-${index}`,
				status: 'active',
				lastVisitedAt: new Date(2026, 0, index + 1),
			}),
		);
		const moderatedRows = Array.from({ length: 4 }, (_unused, index) => ({
			wishlist: makeForSomeoneWishlistRow({ id: `mod-${index}`, status: 'active' }),
			recipientDisplayName: 'Grandma',
			totalGifts: 5,
			reservedGifts: 2,
			lastVisitedAt: new Date(2026, 1, index + 1),
		}));
		mockDbInstance.pushResult(ownRows); // own
		mockDbInstance.pushResult(moderatedRows); // moderated
		mockDbInstance.pushResult([]); // followed

		const result = await callGetHomeOverview(RECIPIENT_ID);

		// 8 candidates across two roles, Nedávné caps at 6.
		// Moderated rows (Feb) are strictly more recent than own rows (Jan), so all four
		// moderated survive plus the two most-recent own; least-recent own drop off.
		expect(result.recent).toHaveLength(6);
		expect(result.recent.map((item) => (item as { id: string }).id)).toEqual([
			'mod-3',
			'mod-2',
			'mod-1',
			'mod-0',
			'own-3',
			'own-2',
		]);
	});

	it('shows a wishlist held in multiple roles only once in Nedávné, keeping the higher-priority role', async () => {
		const shared = { id: 'wl-shared', status: 'active' };
		const visitedAt = new Date(2026, 5, 1);
		mockDbInstance.pushResult([]); // own
		mockDbInstance.pushResult([
			{
				wishlist: makeForSomeoneWishlistRow(shared),
				recipientDisplayName: 'Grandma',
				totalGifts: 5,
				reservedGifts: 2,
				lastVisitedAt: visitedAt,
			},
		]); // moderated
		mockDbInstance.pushResult([
			{
				wishlist: makeForSomeoneWishlistRow(shared),
				recipientDisplayName: 'Grandma',
				availableGifts: 3,
				myReservations: 1,
				myPurchased: 0,
				unfollowedAt: null,
				followDate: new Date(2026, 0, 1),
				lastVisitedAt: visitedAt,
			},
		]); // followed

		const result = await callGetHomeOverview(RECIPIENT_ID);

		// Nedávné is a per-list recency shortcut: one card per wishlist, even when the
		// caller both moderates and follows it. Moderator outranks follower.
		const sharedRecent = result.recent.filter(
			(item) => (item as { id: string }).id === 'wl-shared',
		);
		expect(sharedRecent).toHaveLength(1);
		expect((sharedRecent[0] as { role: string }).role).toBe('moderated');
		// The category rows still list it under each role independently.
		expect(result.moderated.total).toBe(1);
		expect(result.followed.total).toBe(1);
	});
});
