import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
	toPreShareGiftSnapshotFixture as toPreShareGiftSnapshot,
	mockDbInstance,
	GIFT_ID,
	BEFORE_SHARING,
	makeWishlistRow,
	makeGiftRow,
	makeRecipientAuthContext,
	makeModeratorAuthContext,
	callUpdateGift,
} from './gifts.remote.test-fixtures.js';

describe('updateGift – net-zero grace-window revert clears the badge (issue #124)', () => {
	// Server `now` is fixed so grace-window math is deterministic. Gift created 60s before "now" =
	// grace open (isOwnerSharedGiftDeleteGraceOpen uses giftCreatedAt for post-share-created gifts);
	// 3 min before "now" = grace closed.
	const nowFake = new Date('2024-03-01T12:00:00.000Z');
	const createdAt60sAgo = new Date(nowFake.getTime() - 60_000);
	const createdAt3MinAgo = new Date(nowFake.getTime() - 3 * 60_000);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(nowFake);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('REQ-1: first in-grace edit sets the badge and captures the snapshot', () => {
		it('moderator edit within grace sets editedAfterShareAt and snapshots the pre-edit state', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo',
					editedAfterShareAt: null,
					preEditShareSnapshot: null,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: nowFake, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo horské' }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, name: 'Kolo horské' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo horské');
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			expect(setValues.preEditShareSnapshot).toMatchObject({ name: 'Kolo' });
		});
	});

	describe('REQ-2: net-zero revert within grace clears the badge', () => {
		it('"Kolo" -> "Kolo horské" -> "Kolo" within grace clears editedAfterShareAt on the revert', async () => {
			// Second edit: gift row already carries the badge + snapshot from the first in-grace edit.
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo horské',
					editedAfterShareAt: createdAt60sAgo,
					preEditShareSnapshot: toPreShareGiftSnapshot(makeGiftRow({ name: 'Kolo' })),
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: nowFake, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo' }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, name: 'Kolo' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo');
			expect(setValues.editedAfterShareAt).toBeNull();
			expect(setValues.preEditShareSnapshot).toBeNull();
		});

		it('net-nonzero in-grace edit keeps the badge set and preserves the original snapshot', async () => {
			const shareTimeSnapshot = toPreShareGiftSnapshot(makeGiftRow({ name: 'Kolo' }));
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo horské',
					editedAfterShareAt: createdAt60sAgo,
					preEditShareSnapshot: shareTimeSnapshot,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: nowFake, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo elektrické' }]);

			await callUpdateGift(makeModeratorAuthContext(), {
				id: GIFT_ID,
				name: 'Kolo elektrické',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo elektrické');
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			// Original share-time snapshot preserved (not the intermediate "Kolo horské" state).
			expect(setValues.preEditShareSnapshot).toMatchObject({ name: 'Kolo' });
		});
	});

	describe('REQ-3: post-grace edits always badge permanently, even if later reverted', () => {
		it('a post-grace edit sets the badge with no snapshot bookkeeping', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt3MinAgo,
					name: 'Kolo',
					editedAfterShareAt: null,
					preEditShareSnapshot: null,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: createdAt3MinAgo, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 1500 }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, price: 1500 });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.price).toBe(1500);
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			expect(setValues.preEditShareSnapshot).toBeNull();
		});

		it('a post-grace revert to the original price still badges permanently (no net-zero exception)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt3MinAgo,
					price: 1500,
					editedAfterShareAt: createdAt3MinAgo,
					preEditShareSnapshot: null,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: createdAt3MinAgo, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 1000 }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, price: 1000 });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.price).toBe(1000);
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			expect(setValues.preEditShareSnapshot).toBeNull();
		});
	});

	describe('net-zero revert via the recipient full-edit path (name, during share grace)', () => {
		it('recipient reverting the name within share grace clears the badge', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo horské',
					editedAfterShareAt: createdAt60sAgo,
					preEditShareSnapshot: toPreShareGiftSnapshot(makeGiftRow({ name: 'Kolo' })),
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: nowFake })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo' }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Kolo' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo');
			expect(setValues.editedAfterShareAt).toBeNull();
			expect(setValues.preEditShareSnapshot).toBeNull();
		});
	});
});

describe('updateGift – share grace window (issue #83)', () => {
	// Server `now` is fixed so the window math is deterministic. sharedAt 60s ago = window open;
	// 3 min ago = window closed.
	const nowFake = new Date('2024-03-01T12:00:00.000Z');
	const shared60sAgo = new Date(nowFake.getTime() - 60_000);
	const shared3MinAgo = new Date(nowFake.getTime() - 3 * 60_000);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(nowFake);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('lets the recipient change the name of a pre-share gift while the window is open', async () => {
		mockDbInstance.pushResult([
			makeGiftRow({
				createdAt: BEFORE_SHARING,
				name: 'Original',
				editedAfterShareAt: null,
			}),
		]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: shared60sAgo })]);
		mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Renamed' }]);

		await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' });

		const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
			?.args[0] as Record<string, unknown>;
		// Full-edit path: the name is written (not rejected) and the transparency timestamp bumps.
		expect(setValues.name).toBe('Renamed');
		expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
	});

	it('does not keep full edit open via a recent editedAfterShareAt when sharedAt is old', async () => {
		mockDbInstance.pushResult([
			makeGiftRow({
				createdAt: BEFORE_SHARING,
				name: 'Original',
				editedAfterShareAt: shared60sAgo,
			}),
		]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: shared3MinAgo })]);

		await expect(
			callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' }),
		).rejects.toMatchObject({ status: 403, message: 'CANNOT_EDIT_AFTER_SHARING' });
	});

	it('rejects a name change once the window has closed (stale client cannot bypass server)', async () => {
		mockDbInstance.pushResult([
			makeGiftRow({
				createdAt: BEFORE_SHARING,
				name: 'Original',
				editedAfterShareAt: null,
			}),
		]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: shared3MinAgo })]);

		await expect(
			callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' }),
		).rejects.toMatchObject({ status: 403, message: 'CANNOT_EDIT_AFTER_SHARING' });
	});
});
