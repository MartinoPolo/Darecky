import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
	serverErrorFixture as SERVER_ERROR,
	singleFlightRefreshFixture as singleFlightRefresh,
	getGiftCategorySettingsRowsFixture as getGiftCategorySettingsRows,
	mockDbInstance,
	mockDeleteObjects,
	WISHLIST_ID,
	WISHLIST_SHORT_ID,
	GIFT_ID,
	SHARED_AT,
	BEFORE_SHARING,
	makeWishlistRow,
	makeGiftRow,
	makeRecipientAuthContext,
	makeVisitorAuthContext,
	callGetGifts,
	callDeleteGift,
	callReorderGifts,
	callMarkReceived,
} from './gifts.remote.test-fixtures.js';

describe('deleteGift', () => {
	describe('recipient can delete unreserved gifts created after sharing only during creation grace', () => {
		const nowFake = new Date('2024-03-01T12:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('soft-deletes a post-share-created gift within 2 minutes of creation', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: new Date(nowFake.getTime() - 60_000) }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
			]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeRecipientAuthContext(), GIFT_ID),
			).resolves.not.toThrow();
			expect(singleFlightRefresh).toHaveBeenCalledWith(
				getGiftCategorySettingsRows,
				WISHLIST_ID,
			);
		});

		it('deletes the uploaded image from storage on delete (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: new Date(nowFake.getTime() - 60_000),
					imageKey: 'gifts/img.jpg',
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
			]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([]);

			await callDeleteGift(makeRecipientAuthContext(), GIFT_ID);

			expect(mockDeleteObjects).toHaveBeenCalledWith(['gifts/img.jpg']);
		});

		it('blocks a post-share-created gift after its creation grace closes', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: new Date(nowFake.getTime() - 3 * 60_000) }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
			]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});
	});

	describe('recipient CANNOT delete gifts created before sharing (edit lock)', () => {
		it('throws 403 when gift was created before wishlist was shared', async () => {
			// gift lookup – created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyManagerAccess: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});
	});

	describe('recipient CAN delete a pre-share gift within the share grace window (issue #83)', () => {
		const nowFake = new Date('2024-03-01T12:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('soft-deletes a pre-share gift when the window is still open', async () => {
			// gift lookup – created BEFORE sharing, shared 60s ago → window open
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, editedAfterShareAt: null }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 60_000) }),
			]);
			// reservation check – none
			mockDbInstance.pushResult([]);
			// soft-delete update
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeRecipientAuthContext(), GIFT_ID),
			).resolves.not.toThrow();
		});

		it('blocks deletion once the window has closed (stale client cannot bypass server)', async () => {
			// shared 3 min ago, never re-edited → window closed
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, editedAfterShareAt: null }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 3 * 60_000) }),
			]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});

		it('does not reopen pre-share gift deletion via a recent post-share edit', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: BEFORE_SHARING,
					editedAfterShareAt: new Date(nowFake.getTime() - 60_000),
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 3 * 60_000) }),
			]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});

		it('still blocks deleting a reserved gift even within the window', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, editedAfterShareAt: null }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 60_000) }),
			]);
			// reservation check – has a reservation
			mockDbInstance.pushResult([{ id: 'reservation-1' }]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 400,
					message: 'CANNOT_DELETE_RESERVED_GIFT',
				},
			);
		});
	});

	describe('cannot delete reserved gifts', () => {
		it('throws 400 when gift has active reservations', async () => {
			const nowFake = new Date('2024-03-01T12:00:00.000Z');
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);

			try {
				mockDbInstance.pushResult([
					makeGiftRow({ createdAt: new Date(nowFake.getTime() - 60_000) }),
				]);
				mockDbInstance.pushResult([
					makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
				]);
				mockDbInstance.pushResult([{ id: 'reservation-1' }]);

				await expect(
					callDeleteGift(makeRecipientAuthContext(), GIFT_ID),
				).rejects.toMatchObject({
					status: 400,
					message: 'CANNOT_DELETE_RESERVED_GIFT',
				});
			} finally {
				vi.useRealTimers();
			}
		});
	});

	describe('returns 404 for non-existent gift', () => {
		it('throws 404 when gift does not exist', async () => {
			// gift lookup – empty
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeRecipientAuthContext(), 'ghost-gift'),
			).rejects.toMatchObject({
				status: 404,
				message: 'GIFT_NOT_FOUND',
			});
		});
	});

	describe('archived wishlist', () => {
		it('rejects deleting gifts from archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 400,
					message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
				},
			);
		});
	});
});

describe('reorderGifts', () => {
	it('rejects cross-wishlist reorder items', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([
			{ id: GIFT_ID, wishlistId: WISHLIST_ID },
			{ id: 'gift-from-other-wishlist', wishlistId: 'other-wishlist' },
		]);

		await expect(
			callReorderGifts(makeRecipientAuthContext(), [
				{ id: GIFT_ID, sortOrder: 0 },
				{ id: 'gift-from-other-wishlist', sortOrder: 1 },
			]),
		).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
		});
	});

	it('rejects reorders on archived wishlists', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

		await expect(
			callReorderGifts(makeRecipientAuthContext(), [{ id: GIFT_ID, sortOrder: 0 }]),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		});
	});

	it('never sets editedAfterShareAt (regression)', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
		mockDbInstance.pushResult([{ id: GIFT_ID, wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([]);

		await callReorderGifts(makeRecipientAuthContext(), [{ id: GIFT_ID, sortOrder: 2 }]);

		const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
			?.args[0] as Record<string, unknown>;
		expect('editedAfterShareAt' in setValues).toBe(false);
	});
});

describe('markGiftReceived', () => {
	const markInput = { giftId: GIFT_ID, received: true };

	describe('recipient can mark as received', () => {
		it('returns updated gift with received=true', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow()]);
			// verifyManagerAccess: wishlist lookup (recipientUserId matches → recipient)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, received: true }]);

			const result = await callMarkReceived(makeRecipientAuthContext(), markInput);

			expect(result).toMatchObject({ id: GIFT_ID, received: true });
		});

		it('never sets editedAfterShareAt (regression)', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, received: true }]);

			await callMarkReceived(makeRecipientAuthContext(), markInput);

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect('editedAfterShareAt' in setValues).toBe(false);
		});
	});

	describe('non-manager gets 403 ACCESS_DENIED', () => {
		it('throws 403 when caller is neither recipient nor moderator', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow()]);
			// verifyManagerAccess: wishlist lookup (recipient is RECIPIENT_ID, caller is VISITOR_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// moderator check returns empty → role resolves to visitor → ACCESS_DENIED
			mockDbInstance.pushResult([]);

			await expect(
				callMarkReceived(makeVisitorAuthContext(), markInput),
			).rejects.toMatchObject({
				status: 403,
				message: SERVER_ERROR.ACCESS_DENIED,
			});
		});
	});

	describe('archived wishlist', () => {
		it('rejects marking gifts as received on archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callMarkReceived(makeRecipientAuthContext(), markInput),
			).rejects.toMatchObject({
				status: 400,
				message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			});
		});
	});
});

// ── Statement budgets (issue #108, REQ-7) ─────────────────────────────────────

describe('statement budgets (issue #108, REQ-7)', () => {
	/** Statements = top-level select/insert/update/delete chains started on the db. */
	function statementCount(): number {
		return mockDbInstance.calls.filter((call) =>
			['select', 'insert', 'update', 'delete'].includes(call.method),
		).length;
	}

	it('getGiftsByWishlistShortId (authed visitor) stays within 6 statements', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]); // wishlist lookup
		mockDbInstance.pushResult([]); // moderator check → visitor
		mockDbInstance.pushResult([makeGiftRow()]); // gift rows
		mockDbInstance.pushResult([]); // reservations
		mockDbInstance.pushResult([]); // like counts
		mockDbInstance.pushResult([]); // my reservations

		await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

		expect(statementCount()).toBeLessThanOrEqual(6);
	});
});
