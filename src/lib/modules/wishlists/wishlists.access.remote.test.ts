import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	mockDbInstance,
	RECIPIENT_ID,
	OTHER_USER_ID,
	MODERATOR_ID,
	WISHLIST_ID,
	WISHLIST_SHORT_ID,
	makeWishlistRow,
	makeForSomeoneWishlistRow,
	makeRecipientAuthContext,
	makeOtherAuthContext,
	makeModeratorAuthContext,
	callFollowWishlist,
	callGetWishlistByShortId,
	callUnfollowWishlist,
	callRefollowWishlist,
	callRecordWishlistVisit,
} from './wishlists.remote.test-setup.js';

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

describe('followWishlist', () => {
	describe('recipient cannot follow own wishlist', () => {
		it('returns { followed: false, alreadyFollowing: false } without creating a record', async () => {
			// DB call 1: wishlist lookup – the linked recipient is the caller
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);

			const result = await callFollowWishlist(makeRecipientAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: false });
		});
	});

	describe('new visitor follows for the first time', () => {
		it('creates a new follower record and returns { followed: true, alreadyFollowing: false }', async () => {
			// DB call 1: wishlist lookup – recipient is a different user
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
			// DB call 2: existing follower check – none found
			mockDbInstance.pushResult([]);
			// DB call 3: insert follower
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: true, alreadyFollowing: false });
		});
	});

	describe('returning visitor updates lastVisitedAt', () => {
		it('returns { followed: false, alreadyFollowing: true } when record exists with unfollowedAt=null', async () => {
			// DB call 1: wishlist lookup – recipient is a different user
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
			// DB call 2: existing follower check – record found, not unfollowed
			mockDbInstance.pushResult([
				{ unfollowedAt: null, lastVisitedAt: new Date('2024-01-01') },
			]);
			// DB call 3: update lastVisitedAt
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: true });
		});

		it('returns { followed: false, alreadyFollowing: false } when record exists but unfollowedAt is set', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
			// DB call 2: existing follower with unfollowedAt set (previously unfollowed)
			mockDbInstance.pushResult([
				{ unfollowedAt: new Date('2024-01-05'), lastVisitedAt: new Date('2024-01-01') },
			]);
			// DB call 3: update lastVisitedAt
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: false });
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when wishlist does not exist', async () => {
			// DB call 1: empty wishlist lookup
			mockDbInstance.pushResult([]);

			await expect(
				callFollowWishlist(makeOtherAuthContext(), 'ghost-wishlist'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getWishlistByShortId', () => {
	describe('recipient role', () => {
		it('returns role=recipient when the authed user is the linked recipient (self list, no správci)', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin → coalesced recipientDisplayName
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No mod query (recipient match)
			// DB call 2: managerNames query (fetched for ALL lists, 2026-07-14 decision) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string; recipientDisplayName: string; managerNames: string[] };

			expect(result.role).toBe('recipient');
			expect(result.recipientDisplayName).toBe('Recipient Alice');
			// No správci and no self-promotion → no manager names, no „Spravuje" line.
			expect(result.managerNames).toEqual([]);
		});
	});

	describe('recipientImage (issue #158)', () => {
		it('exposes the linked recipient’s avatar (e.g. a connected Google account picture)', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{
					wishlist: wishlistRow,
					recipientDisplayName: 'Recipient Alice',
					recipientImage: 'https://lh3.googleusercontent.com/a/abc123',
				},
			]);
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { recipientImage: string | null };

			expect(result.recipientImage).toBe('https://lh3.googleusercontent.com/a/abc123');
		});

		it('resolves to null for a free-text (for-someone-else) recipient with no linked account', async () => {
			const wishlistRow = makeForSomeoneWishlistRow();
			// leftJoin on `user` finds no row → recipientImage comes back undefined/null.
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Grandma', recipientImage: null },
			]);
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			mockDbInstance.pushResult([{ name: 'Martin' }]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { recipientImage: string | null };

			expect(result.recipientImage).toBeNull();
		});
	});

	describe('manager names on linked-recipient (self) lists — 2026-07-14 header decision', () => {
		it('fetches manager names even when recipientUserId is set (správci render on self lists too)', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No mod query (recipient match)
			// DB call 2: managerNames query — a správce exists on this self list
			mockDbInstance.pushResult([{ name: 'Jana' }]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { managerNames: string[] };

			expect(result.managerNames).toEqual(['Jana']);
		});

		it('includes the self-promoted recipient in managerNames despite no moderator_assignment row', async () => {
			const wishlistRow = makeWishlistRow({ recipientIsModerator: true });
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No mod query (recipient match)
			// DB call 2: managerNames query — one regular správce
			mockDbInstance.pushResult([{ name: 'Jana' }]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { managerNames: string[] };

			// recipientIsModerator=true counts the recipient as a správce in the header line.
			expect(result.managerNames).toEqual(['Recipient Alice', 'Jana']);
		});
	});

	describe('moderator role', () => {
		it('returns role=moderator when the user has an active moderator assignment', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// DB call 2: hasActiveModeratorAssignment → found
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: managerNames query (runs for all lists) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('moderator');
		});
	});

	describe('for-someone list exposes managerNames', () => {
		it('returns coalesced recipientName as recipientDisplayName and the manager names list', async () => {
			const wishlistRow = makeForSomeoneWishlistRow();
			// DB call 1: wishlist + user leftJoin (no linked user → recipientName wins)
			mockDbInstance.pushResult([{ wishlist: wishlistRow, recipientDisplayName: 'Grandma' }]);
			// DB call 2: hasActiveModeratorAssignment → found (caller is a správce)
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: managerNames query (runs for all lists)
			mockDbInstance.pushResult([{ name: 'Martin' }, { name: 'Jana' }]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string; recipientDisplayName: string; managerNames: string[] };

			expect(result.role).toBe('moderator');
			expect(result.recipientDisplayName).toBe('Grandma');
			expect(result.managerNames).toEqual(['Martin', 'Jana']);
		});
	});

	/**
	 * Issue #213, REQ-7: the release affordance must be decided on the server and shipped as a
	 * capability, because the administrator identity (`ADMIN_EMAILS`) is a private secret that
	 * must never reach the client. No `ADMIN_EMAILS` is configured in this suite, so these cases
	 * pin the non-administrator reach: a správce gets guest-only, everyone else nothing.
	 */
	describe('reservationReleaseCapability (issue #213)', () => {
		it('a správce gets guestOnly — today’s reach, computed server-side', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			mockDbInstance.pushResult([{ id: 'assignment-1' }]); // moderator assignment
			mockDbInstance.pushResult([]); // managerNames

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { reservationReleaseCapability: string };

			expect(result.reservationReleaseCapability).toBe('guestOnly');
		});

		it('the obdarovaný gets none', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			mockDbInstance.pushResult([]); // managerNames

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { reservationReleaseCapability: string };

			expect(result.reservationReleaseCapability).toBe('none');
		});

		it('a plain visitor gets none', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			mockDbInstance.pushResult([]); // no moderator assignment
			mockDbInstance.pushResult([]); // managerNames

			const result = (await callGetWishlistByShortId(
				makeOtherAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { reservationReleaseCapability: string };

			expect(result.reservationReleaseCapability).toBe('none');
		});
	});

	describe('visitor role – authenticated non-recipient/non-moderator', () => {
		it('returns role=visitor when the authed user has no special assignment', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);
			// DB call 3: managerNames query (runs for all lists) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeOtherAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('visitor');
		});
	});

	describe('visitor role – unauthenticated', () => {
		it('returns role=visitor when authContext is null', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No moderator check when unauthenticated
			// DB call 2: managerNames query (runs for all lists) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(null, WISHLIST_SHORT_ID)) as {
				role: string;
			};

			expect(result.role).toBe('visitor');
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when no wishlist matches the shortId', async () => {
			// DB call 1: empty result
			mockDbInstance.pushResult([]);

			await expect(
				callGetWishlistByShortId(makeRecipientAuthContext(), 'nonexistent'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('unfollowWishlist', () => {
	describe('sets unfollowedAt on the follower record (no-op when no record matches)', () => {
		it('resolves without error regardless of whether a follower record matched', async () => {
			// DB call 1: update wishlistFollower – resolves whether or not a row matched
			mockDbInstance.pushResult([]);

			await expect(
				callUnfollowWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).resolves.not.toThrow();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('refollowWishlist', () => {
	describe('clears unfollowedAt and updates lastVisitedAt (no-op when no record matches)', () => {
		it('resolves without error regardless of whether a follower record matched', async () => {
			// DB call 1: update wishlistFollower – resolves whether or not a row matched
			mockDbInstance.pushResult([]);

			await expect(
				callRefollowWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).resolves.not.toThrow();
		});
	});
});

// ── Statement budgets (issue #108, REQ-7) ─────────────────────────────────────

describe('statement budgets (issue #108, REQ-7)', () => {
	it('getWishlistByShortId (authed manager, self list) stays within 3 statements', async () => {
		// wishlist + user leftJoin, the moderator-assignment role check, and the manager-names
		// query (fetched for ALL lists — issue #158 "Spravuje {name}" header line). A draft list
		// skips the revert-capability reservation count (issue #150), so this is the floor.
		mockDbInstance.pushResult([
			{ wishlist: makeWishlistRow(), recipientDisplayName: 'Recipient Alice' },
		]);
		mockDbInstance.pushResult([{ id: 'assignment-1' }]);
		mockDbInstance.pushResult([]);

		await callGetWishlistByShortId(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

		expect(mockDbInstance.statementCount()).toBeLessThanOrEqual(3);
	});
});

// ── recordWishlistVisit (issue #225) ─────────────────────────────────────────

describe('recordWishlistVisit', () => {
	it('throws 404 when the wishlist does not exist', async () => {
		mockDbInstance.pushResult([]); // wishlist lookup → none

		await expect(
			callRecordWishlistVisit(makeOtherAuthContext(), 'ghost'),
		).rejects.toMatchObject({ status: 404 });
	});

	it('upserts a visit for the linked recipient and never creates a follower row', async () => {
		// DB 1: wishlist lookup — caller IS the linked recipient
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);

		await callRecordWishlistVisit(makeRecipientAuthContext(), WISHLIST_ID);

		// The visit is the ONLY insert — the recipient must never gain a follower row.
		expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({
			userId: RECIPIENT_ID,
			wishlistId: WISHLIST_ID,
		});
		expect(mockDbInstance.valuesPayloadAt(1)).toBeUndefined();
	});

	it('records a visit for a moderator without auto-following', async () => {
		// DB 1: wishlist lookup — caller is not the recipient
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);
		// DB 3: active moderator-assignment check → found → manager
		mockDbInstance.pushResult([{ id: 'assignment-1' }]);

		await callRecordWishlistVisit(makeModeratorAuthContext(), WISHLIST_ID);

		// Visit recorded, but no follower insert for a manager.
		expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({
			userId: MODERATOR_ID,
			wishlistId: WISHLIST_ID,
		});
		expect(mockDbInstance.valuesPayloadAt(1)).toBeUndefined();
	});

	it('auto-follows a first-time visitor after recording the visit', async () => {
		// DB 1: wishlist lookup — caller is not the recipient
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);
		// DB 3: moderator-assignment check → none
		mockDbInstance.pushResult([]);
		// DB 4: existing follower check → none
		mockDbInstance.pushResult([]);
		// DB 5: follower insert
		mockDbInstance.pushResult([]);

		await callRecordWishlistVisit(makeOtherAuthContext(), WISHLIST_ID);

		// First values() is the visit, second is the auto-follow follower row.
		expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({ userId: OTHER_USER_ID });
		expect(mockDbInstance.valuesPayloadAt(1)).toMatchObject({
			wishlistId: WISHLIST_ID,
			userId: OTHER_USER_ID,
		});
	});

	it('records a visit for an existing follower without inserting a duplicate follower', async () => {
		// DB 1: wishlist lookup
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);
		// DB 3: moderator check → none
		mockDbInstance.pushResult([]);
		// DB 4: existing follower check → found
		mockDbInstance.pushResult([{ unfollowedAt: null }]);

		await callRecordWishlistVisit(makeOtherAuthContext(), WISHLIST_ID);

		// Only the visit insert ran — no second follower insert.
		expect(mockDbInstance.valuesPayloadAt(1)).toBeUndefined();
	});
});

// ── Dashboard role predicates ────────────────────────────────────────────────
