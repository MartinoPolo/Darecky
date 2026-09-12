import { describe, expect, it } from 'vitest';
import {
	serverErrorFixture as SERVER_ERROR,
	singleFlightRefreshFixture as singleFlightRefresh,
	getGiftCategorySettingsRowsFixture as getGiftCategorySettingsRows,
	mockDbInstance,
	mockDeleteObjects,
	WISHLIST_ID,
	GIFT_ID,
	SHARED_AT,
	BEFORE_SHARING,
	AFTER_SHARING,
	makeWishlistRow,
	makeGiftRow,
	makeRecipientAuthContext,
	makeModeratorAuthContext,
	callUpdateGift,
} from './gifts.remote.test-fixtures.js';

describe('updateGift', () => {
	const updateInput = { id: GIFT_ID, name: 'Updated Name' };

	describe('recipient can update gifts created after sharing (or unshared)', () => {
		it('returns updated gift when wishlist is not yet shared', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyManagerAccess: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID, name: 'Updated Name' });
		});

		it('refreshes category counts when clearing a category', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, categoryId: 'category-books' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, categoryId: null }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, categoryId: null });

			expect(singleFlightRefresh).toHaveBeenCalledWith(
				getGiftCategorySettingsRows,
				WISHLIST_ID,
			);
		});

		it('persists updated image metadata', async () => {
			const imageMeta = { fitMode: 'contain-padded', bgColor: '#222222' };
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageMeta }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				imageMeta,
			});

			expect(result).toMatchObject({ id: GIFT_ID, imageMeta });
		});

		it('persists updated priceMax', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 1200, priceMax: 1500 }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				price: 1200,
				priceMax: 1500,
			});

			expect(result).toMatchObject({ id: GIFT_ID, price: 1200, priceMax: 1500 });
			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues).toMatchObject({ price: 1200, priceMax: 1500 });
		});

		it('persists decimal price range bounds (issue #250 REQ-2, REQ-4)', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 19.5, priceMax: 29.95 }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				price: 19.5,
				priceMax: 29.95,
			});

			expect(result).toMatchObject({ id: GIFT_ID, price: 19.5, priceMax: 29.95 });
			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues).toMatchObject({ price: 19.5, priceMax: 29.95 });
		});

		it('rejects a priceMax-only update that would invert the persisted range', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING, price: 1500 })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, priceMax: 1200 }),
			).rejects.toMatchObject({
				status: 400,
				message: 'INVALID_PRICE_RANGE',
			});
		});

		it('deletes the replaced uploaded image from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, imageKey: 'gifts/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageKey: 'gifts/new.jpg' }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				imageKey: 'gifts/new.jpg',
			});

			expect(mockDeleteObjects).toHaveBeenCalledWith(['gifts/old.jpg']);
		});

		it('deletes the old uploaded image when the image is removed (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, imageKey: 'gifts/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageKey: null }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, imageKey: null });

			expect(mockDeleteObjects).toHaveBeenCalledWith(['gifts/old.jpg']);
		});

		it('keeps storage untouched when the image key does not change (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, imageKey: 'gifts/same.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageKey: 'gifts/same.jpg' }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				name: 'Updated Name',
				imageKey: 'gifts/same.jpg',
			});

			expect(mockDeleteObjects).not.toHaveBeenCalled();
		});

		it('recipient can update gifts created after sharing date', async () => {
			// gift lookup – created AFTER sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyManagerAccess: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID });
		});

		it('normalizes updated gift links before persisting', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([
				{ id: GIFT_ID, links: [{ url: 'https://example.com/path' }] },
			]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				links: [{ url: ' https://example.com/path ' }],
			});

			const updateSetValues = mockDbInstance.calls
				.filter((call) => call.method === 'set')
				.at(0)?.args[0] as { links: { url: string; label?: string }[] };
			expect(updateSetValues.links).toEqual([{ url: 'https://example.com/path' }]);
		});

		it('rejects updates on archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), updateInput),
			).rejects.toMatchObject({
				status: 400,
				message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			});
		});
	});

	describe('recipient per-field edit of a pre-share gift on a shared wishlist', () => {
		it('allows editing price/links/imageMeta/priority and flags editedAfterShareAt', async () => {
			const imageMeta = { fitMode: 'contain-padded', bgColor: '#222222' };
			// gift lookup – created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING, price: 100 })]);
			// wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				price: 250,
				links: [{ url: 'https://example.com/path' }],
				imageMeta,
				priorityLevelId: 'prio-1',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.price).toBe(250);
			expect(setValues.links).toEqual([{ url: 'https://example.com/path' }]);
			expect(setValues.imageMeta).toEqual(imageMeta);
			expect(setValues.priorityLevelId).toBe('prio-1');
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});

		it('rejects 403 CANNOT_EDIT_AFTER_SHARING when changing the name', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, name: 'Original' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' }),
			).rejects.toMatchObject({ status: 403, message: 'CANNOT_EDIT_AFTER_SHARING' });
		});

		it('refreshes category counts when the pre-share edit path clears a category', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, categoryId: 'category-books' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, categoryId: null }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, categoryId: null });

			expect(singleFlightRefresh).toHaveBeenCalledWith(
				getGiftCategorySettingsRows,
				WISHLIST_ID,
			);
		});

		it('allows raising quantity (3 -> 5)', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING, quantity: 3 })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, quantity: 5 });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.quantity).toBe(5);
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});

		it('rejects 400 QUANTITY_CANNOT_BE_LOWERED when lowering quantity, without querying reservations', async () => {
			// Surprise-protection invariant: the rejection is driven solely by the gift's own
			// quantity column; updateGift must never read the reservation table (which would let the
			// recipient infer reserved counts). The row shape is identical whether or not the gift is
			// reserved, so this single path covers both reserved and unreserved gifts (REQ-3/5).
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING, quantity: 3 })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, quantity: 1 }),
			).rejects.toMatchObject({ status: 400, message: 'QUANTITY_CANNOT_BE_LOWERED' });

			// No `.from(reservation)` ran. The reservation table mock is identifiable by its
			// `giftId: 'reservation.giftId'` column ref (args[0] is the table object, not a string).
			const queriedReservation = mockDbInstance.calls
				.filter((call) => call.method === 'from')
				.some((call) => {
					const table = call.args[0];
					return (
						typeof table === 'object' &&
						table !== null &&
						(table as Record<string, unknown>).giftId === 'reservation.giftId'
					);
				});
			expect(queriedReservation).toBe(false);
		});

		it('does NOT flag editedAfterShareAt when a pre-share edit changes nothing', async () => {
			// Idempotent save: submitting the gift's existing name (allowed but unchanged) must not
			// set the transparency timestamp, or every modal open+save would falsely badge the gift.
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, name: 'Test Gift', quantity: 3 }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				name: 'Test Gift',
				quantity: 3,
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect('editedAfterShareAt' in setValues).toBe(false);
		});

		it('appends to descriptionAppends when the base description is non-empty', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: BEFORE_SHARING,
					description: 'Original description',
					descriptionAppends: [],
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				description: 'blue variant',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			// Frozen base untouched
			expect('description' in setValues).toBe(false);
			const appends = setValues.descriptionAppends as { text: string; addedAt: string }[];
			expect(appends).toHaveLength(1);
			expect(appends[0]!.text).toBe('blue variant');
			expect(typeof appends[0]!.addedAt).toBe('string');
		});

		it('fills the main description when base is empty at share (no append)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: BEFORE_SHARING,
					description: null,
					descriptionAppends: [],
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				description: 'now has text',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.description).toBe('now has text');
			expect('descriptionAppends' in setValues).toBe(false);
		});
	});

	describe('moderator can always update', () => {
		it('moderator bypasses the edit lock and updates the gift', async () => {
			// gift lookup – created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyManagerAccess: wishlist lookup (shared, caller is a moderator, not the recipient)
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: SHARED_AT, recipientUserId: 'someone-else' }),
			]);
			// moderator check
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeModeratorAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID });

			// Moderator changing a field on a shared wishlist flags edit transparency.
			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Updated Name');
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});
	});

	describe('editedAfterShareAt transparency for post-share-created gifts', () => {
		it('flags editedAfterShareAt when a recipient edits a gift created after sharing', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, name: 'Original' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Renamed');
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});

		it('does NOT flag editedAfterShareAt on an unshared wishlist', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, name: 'Original' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect('editedAfterShareAt' in setValues).toBe(false);
		});
	});
});
