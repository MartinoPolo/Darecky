import { describe, expect, it, vi } from 'vitest';
import {
	serverErrorFixture as SERVER_ERROR,
	singleFlightRefreshFixture as singleFlightRefresh,
	getGiftCategorySettingsRowsFixture as getGiftCategorySettingsRows,
	dispatchNotificationFixture as dispatchNotification,
	mockDbInstance,
	mockAppendGifts,
	mockCopyGifts,
	WISHLIST_ID,
	GIFT_ID,
	SHARED_AT,
	makeWishlistRow,
	makeGiftRow,
	makeRecipientAuthContext,
	makeModeratorAuthContext,
	callCreateGift,
	callBulkUpdate,
	callBulkCopy,
} from './gifts.remote.test-fixtures.js';

describe('gift category settings refresh dependencies', () => {
	it('refreshes category counts after creating a gift', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockAppendGifts.mockResolvedValueOnce([
			makeGiftRow({ categoryId: 'category-books' }),
		] as never);

		await callCreateGift(makeRecipientAuthContext(), {
			wishlistId: WISHLIST_ID,
			name: 'Book',
			categoryId: 'category-books',
		});

		expect(singleFlightRefresh).toHaveBeenCalledWith(getGiftCategorySettingsRows, WISHLIST_ID);
	});

	it('refreshes destination category counts after copying gifts', async () => {
		mockCopyGifts.mockResolvedValueOnce({
			created: [{ id: 'copied-gift' }],
			destinationShortId: 'destination-short-id',
		} as never);

		await callBulkCopy(makeRecipientAuthContext(), {
			sourceWishlistId: WISHLIST_ID,
			destinationWishlistId: 'destination-wishlist',
			giftIds: [GIFT_ID],
		});

		expect(singleFlightRefresh).toHaveBeenCalledWith(
			getGiftCategorySettingsRows,
			'destination-wishlist',
		);
	});
});

describe('bulkUpdateGifts presentation parity', () => {
	it('revalidates archived status inside the mutation transaction', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

		await expect(
			callBulkUpdate(makeRecipientAuthContext(), {
				wishlistId: WISHLIST_ID,
				giftIds: [GIFT_ID],
				action: 'priority',
				priorityLevelId: null,
			}),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		});
		expect(mockDbInstance.calls).toContainEqual({ method: 'transaction', args: [] });
		expect(mockDbInstance.calls.filter((call) => call.method === 'update')).toHaveLength(0);
	});

	it('revalidates a revoked manager assignment inside the mutation transaction', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ recipientUserId: null, status: 'active' })]);
		mockDbInstance.pushResult([]);

		await expect(
			callBulkUpdate(makeModeratorAuthContext(), {
				wishlistId: WISHLIST_ID,
				giftIds: [GIFT_ID],
				action: 'received',
				received: true,
			}),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.ACCESS_DENIED });
		expect(mockDbInstance.calls).toContainEqual({ method: 'transaction', args: [] });
		expect(mockDbInstance.calls.filter((call) => call.method === 'update')).toHaveLength(0);
	});

	it('refreshes category counts when clearing categories in bulk', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ status: 'active' })]);
		mockDbInstance.pushResult([makeGiftRow({ categoryId: 'category-books' })]);
		mockDbInstance.pushResult([{ id: GIFT_ID }]);

		await callBulkUpdate(makeRecipientAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID],
			action: 'category',
			categoryId: null,
		});

		expect(singleFlightRefresh).toHaveBeenCalledWith(getGiftCategorySettingsRows, WISHLIST_ID);
	});

	it('applies post-share edit transparency to every changed presentation gift in one update statement', async () => {
		const secondGiftId = 'gift-2';
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT, status: 'active' })]);
		mockDbInstance.pushResult([
			makeGiftRow({ id: GIFT_ID, priorityLevelId: 'old-priority' }),
			makeGiftRow({ id: secondGiftId, name: 'Second Gift', priorityLevelId: 'old-priority' }),
		]);
		mockDbInstance.pushResult([{ id: GIFT_ID }, { id: secondGiftId }]); // one atomic update

		await callBulkUpdate(makeRecipientAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID, secondGiftId],
			action: 'priority',
			priorityLevelId: null,
		});

		const updates = mockDbInstance.calls.filter((call) => call.method === 'update');
		const sets = mockDbInstance.calls.filter((call) => call.method === 'set');
		const setValues = sets.at(0)?.args[0] as Record<string, unknown>;
		const transparencyCase = setValues.editedAfterShareAt as {
			kind: string;
			values: Array<{ parts?: Array<{ values: unknown[] }> }>;
		};
		const snapshotCase = setValues.preEditShareSnapshot as {
			kind: string;
			values: Array<{ parts?: Array<{ values: unknown[] }> }>;
		};
		const touchedIds = (transparencyCase.values[0]?.parts ?? []).map((part) => part.values[1]);
		const snapshotTouchedIds = (snapshotCase.values[0]?.parts ?? []).map(
			(part) => part.values[1],
		);

		expect(updates).toHaveLength(1);
		expect(sets).toHaveLength(1);
		expect(setValues.priorityLevelId).toBeNull();
		expect(transparencyCase.kind).toBe('sql');
		expect(touchedIds).toEqual([GIFT_ID, secondGiftId]);
		expect(snapshotTouchedIds).toEqual([GIFT_ID, secondGiftId]);
	});

	it('notifies reservers for multiple changed gifts from one reservation select in bulk', async () => {
		const secondGiftId = 'gift-2';
		mockDbInstance.pushResult([
			makeWishlistRow({ recipientUserId: null, sharedAt: SHARED_AT, status: 'active' }),
		]);
		mockDbInstance.pushResult([{ id: 'moderator-assignment' }]);
		mockDbInstance.pushResult([
			makeGiftRow({ id: GIFT_ID, priorityLevelId: 'old-priority' }),
			makeGiftRow({ id: secondGiftId, name: 'Second Gift', priorityLevelId: 'old-priority' }),
		]);
		mockDbInstance.pushResult([{ id: GIFT_ID }, { id: secondGiftId }]); // one atomic update
		mockDbInstance.pushResult([
			{ giftId: GIFT_ID, userId: 'reserver-1', anonymousEmail: null },
			{ giftId: secondGiftId, userId: null, anonymousEmail: 'guest@example.com' },
		]);

		await callBulkUpdate(makeModeratorAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID, secondGiftId],
			action: 'priority',
			priorityLevelId: null,
		});

		const reservationQueries = mockDbInstance.calls.filter(
			(call) =>
				call.method === 'from' &&
				typeof call.args[0] === 'object' &&
				call.args[0] !== null &&
				(call.args[0] as Record<string, unknown>).anonymousEmail ===
					'reservation.anonymousEmail',
		);
		const updates = mockDbInstance.calls.filter((call) => call.method === 'update');
		expect(updates).toHaveLength(1);
		expect(reservationQueries).toHaveLength(1);
		expect(dispatchNotification).toHaveBeenCalledTimes(2);
		const payloads = vi.mocked(dispatchNotification).mock.calls.map(([payload]) => payload);
		for (const expected of [
			expect.objectContaining({
				type: 'reserved_gift_edited',
				giftId: GIFT_ID,
				targetUserIds: ['reserver-1'],
				targetEmails: [],
			}),
			expect.objectContaining({
				type: 'reserved_gift_edited',
				giftId: secondGiftId,
				targetUserIds: [],
				targetEmails: ['guest@example.com'],
			}),
		]) {
			expect(payloads).toContainEqual(expected);
		}
	});

	it('rejects the transaction when the update does not affect the exact locked gift set', async () => {
		const secondGiftId = 'gift-2';
		mockDbInstance.pushResult([makeWishlistRow({ status: 'active' })]);
		mockDbInstance.pushResult([
			makeGiftRow({ id: GIFT_ID }),
			makeGiftRow({ id: secondGiftId, name: 'Second Gift' }),
		]);
		mockDbInstance.pushResult([{ id: GIFT_ID }, { id: 'gift-from-another-set' }]);

		await expect(
			callBulkUpdate(makeRecipientAuthContext(), {
				wishlistId: WISHLIST_ID,
				giftIds: [GIFT_ID, secondGiftId],
				action: 'received',
				received: true,
			}),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
		});

		expect(mockDbInstance.calls).toContainEqual({ method: 'for', args: ['update'] });
		expect(singleFlightRefresh).not.toHaveBeenCalled();
	});

	it('returns the committed result and refreshes when notification delivery fails', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mockDbInstance.pushResult([
			makeWishlistRow({ recipientUserId: null, sharedAt: SHARED_AT, status: 'active' }),
		]);
		mockDbInstance.pushResult([{ id: 'moderator-assignment' }]);
		mockDbInstance.pushResult([makeGiftRow({ priorityLevelId: 'old-priority' })]);
		mockDbInstance.pushResult([{ id: GIFT_ID }]);
		mockDbInstance.pushResult([
			{ giftId: GIFT_ID, userId: 'reserver-1', anonymousEmail: null },
		]);
		vi.mocked(dispatchNotification).mockRejectedValueOnce(new Error('provider unavailable'));

		const result = await callBulkUpdate(makeModeratorAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID],
			action: 'priority',
			priorityLevelId: null,
		});

		expect(result).toEqual({
			updatedIds: [GIFT_ID],
			priorReceived: { [GIFT_ID]: false },
		});
		expect(log).toHaveBeenCalledWith(
			'[Notification] reserver edit notification failed',
			expect.any(Error),
		);
		expect(singleFlightRefresh).toHaveBeenCalled();
		log.mockRestore();
	});

	it('dispatches a large notification fan-out concurrently with a bounded worker count', async () => {
		const giftIds = Array.from({ length: 8 }, (_, index) => `gift-${index + 1}`);
		mockDbInstance.pushResult([
			makeWishlistRow({ recipientUserId: null, sharedAt: SHARED_AT, status: 'active' }),
		]);
		mockDbInstance.pushResult([{ id: 'moderator-assignment' }]);
		mockDbInstance.pushResult(
			giftIds.map((id, index) =>
				makeGiftRow({ id, name: `Gift ${index + 1}`, priorityLevelId: 'old-priority' }),
			),
		);
		mockDbInstance.pushResult(giftIds.map((id) => ({ id })));
		mockDbInstance.pushResult(
			giftIds.map((giftId) => ({
				giftId,
				userId: `reserver-${giftId}`,
				anonymousEmail: null,
			})),
		);

		let active = 0;
		let maximumActive = 0;
		const releases: Array<() => void> = [];
		vi.mocked(dispatchNotification).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					active += 1;
					maximumActive = Math.max(maximumActive, active);
					releases.push(() => {
						active -= 1;
						resolve();
					});
				}),
		);

		const command = callBulkUpdate(makeModeratorAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds,
			action: 'priority',
			priorityLevelId: null,
		});
		await vi.waitFor(() => expect(releases.length).toBeGreaterThan(1));

		while (vi.mocked(dispatchNotification).mock.calls.length < giftIds.length) {
			const pending = releases.splice(0);
			pending.forEach((release) => release());
			await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
		}
		releases.splice(0).forEach((release) => release());
		await command;

		expect(maximumActive).toBeGreaterThan(1);
		expect(maximumActive).toBeLessThan(giftIds.length);
	});
});
