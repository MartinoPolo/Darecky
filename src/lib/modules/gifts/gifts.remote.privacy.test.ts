import { describe, expect, it } from 'vitest';
import {
	mockDbInstance,
	WISHLIST_SHORT_ID,
	GIFT_ID,
	makeWishlistRow,
	makeGiftRow,
	makeRecipientAuthContext,
	makeVisitorAuthContext,
	makeModeratorAuthContext,
	callGetGifts,
	type GiftForRecipient,
	type GiftForVisitor,
} from './gifts.remote.test-fixtures.js';

describe('getGiftsByWishlistShortId', () => {
	describe('recipient (not self-promoted) gets GiftForRecipient without reservation/like data', () => {
		it('returns role=recipient and gifts without reservedCount/likeCount/isFullyReserved', async () => {
			// DB call 1: wishlist lookup. recipientUserId matches the authed user, so
			// resolveWishlistRole short-circuits to recipient with NO moderator query.
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			// DB call 2: gift rows
			mockDbInstance.pushResult([makeGiftRow()]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('recipient');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForRecipient & Partial<GiftForVisitor>;
			expect(gift.id).toBe(GIFT_ID);
			expect(gift.name).toBe('Test Gift');
			// Critical invariant: no reservation/like fields present (protects the surprise)
			expect('reservedCount' in gift).toBe(false);
			expect('likeCount' in gift).toBe(false);
			expect('isFullyReserved' in gift).toBe(false);
			expect('reserverNames' in gift).toBe(false);
		});

		it('returns category metadata without adding reservation-derived fields', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([
				makeGiftRow({
					categoryId: 'category-books',
					categoryPresetKey: 'books',
					categoryCustomLabel: null,
					categoryColor: '#2563EB',
					categorySortOrder: 2,
				}),
			]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);
			const gift = result.gifts[0] as Record<string, unknown>;

			expect(gift.category).toEqual({
				id: 'category-books',
				presetKey: 'books',
				customLabel: null,
				color: '#2563EB',
				sortOrder: 2,
			});
			expect('reservedCount' in gift).toBe(false);
			expect('reserverNames' in gift).toBe(false);
		});
	});

	describe('recipient with recipientIsModerator=true (self-promoted) gets counts but never gifter identities', () => {
		it('returns role=recipient and gifts with reservedCount, likeCount, isFullyReserved', async () => {
			// DB call 1: wishlist lookup (recipientIsModerator=true). Still resolves to
			// recipient (recipientUserId matches) — self-promote lifts the strip, not the role.
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: true })]);
			// DB call 2: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 3 })]);
			// DB call 3: reservation rows (with reserver names the DB always returns)
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 2, reserverName: 'Petr Svoboda' },
			]);
			// DB call 4: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 5 }]);
			// DB call 5: my reservations (recipient has none)
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('recipient');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForVisitor;
			// Counts are present (visitor-shaped DTO)…
			expect(gift.reservedCount).toBe(2);
			expect(gift.likeCount).toBe(5);
			expect(gift.isFullyReserved).toBe(false); // 2 reserved out of 3
			// …but gifter identities never are: self-promote reveals counts, not names
			// (reserver names are moderator-only — issue #198).
			expect(gift.reserverNames).toEqual([]);
		});
	});

	describe('visitor gets GiftForVisitor with reservation counts and like counts', () => {
		it('returns role=visitor with reservedCount, likeCount, isFullyReserved=true when fully reserved', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: moderator check (not a moderator)
			mockDbInstance.pushResult([]);
			// DB call 3: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 2 })]);
			// DB call 4: reservation rows (fully reserved)
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 2, reserverName: 'Petr Svoboda' },
			]);
			// DB call 5: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 3 }]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(2);
			expect(gift.likeCount).toBe(3);
			expect(gift.isFullyReserved).toBe(true);
		});

		it('sets reservedCount=0 and likeCount=0 when no reservations or likes exist', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// No reservation counts returned
			mockDbInstance.pushResult([]);
			// No like counts returned
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(0);
			expect(gift.likeCount).toBe(0);
			expect(gift.isFullyReserved).toBe(false);
		});

		it('sets myReservationId to the current user active reservation for that gift', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// reservation rows
			mockDbInstance.pushResult([{ giftId: GIFT_ID, quantity: 1, reserverName: 'Já' }]);
			mockDbInstance.pushResult([]); // like counts
			// my active reservations for these gifts
			mockDbInstance.pushResult([{ id: 'res-mine', giftId: GIFT_ID }]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.myReservationId).toBe('res-mine');
		});

		it('sets myReservationId to null when the current user has no reservation', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations: none

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.myReservationId).toBeNull();
		});
	});

	describe('moderator gets GiftForVisitor with reservation and like counts', () => {
		it('returns role=moderator and full gift data', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: moderator check (is a moderator)
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// DB call 3: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 5 })]);
			// DB call 4: reservation rows
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
			]);
			// DB call 5: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 10 }]);

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('moderator');
			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(1);
			expect(gift.likeCount).toBe(10);
			expect(gift.isFullyReserved).toBe(false);
			// Moderators see who reserved (issue #198)
			expect(gift.reserverNames).toEqual(['Babička Marie']);
		});
	});

	describe('reserver display names — moderator only (issue #198)', () => {
		it('visitor sees no reserver display name on a reserved gift (counts stay intact)', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// reservation rows: name coalesced from the reserver account / anonymous signature —
			// the DB still returns it, but the visitor viewer must never receive it.
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
			]);
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.isFullyReserved).toBe(true);
			expect(gift.reserverNames).toEqual([]);
		});

		it('anonymous (unauthenticated) caller sees no reserver display name on a reserved gift', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			// No moderator check: authContext is null.
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Petr Svoboda' },
			]);
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(null, WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.isFullyReserved).toBe(true);
			expect(gift.reserverNames).toEqual([]);
		});

		it('moderator collects multiple reservers in reservation order and deduplicates repeats', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]); // is a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 4 })]);
			// Same person reserving twice must appear once; order follows createdAt.
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
				{ giftId: GIFT_ID, quantity: 2, reserverName: 'Petr Svoboda' },
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
			]);
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(4);
			expect(gift.isFullyReserved).toBe(true);
			expect(gift.reserverNames).toEqual(['Babička Marie', 'Petr Svoboda']);
		});

		it('moderator counts reservations without a usable name but sees no name entry for them', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]); // is a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 2 })]);
			// e.g. reserver account deleted (userId set null, no anonymous signature)
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: null },
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Teta Klára' },
			]);
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(2);
			expect(gift.reserverNames).toEqual(['Teta Klára']);
		});

		it('owner/recipient payload carries ZERO reservation fields — including reserverNames', async () => {
			// Core product invariant: the recipient must never learn reservation state.
			// Enumerates every visitor-only field so a future field addition that leaks
			// past the strip fails this test.
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow()]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('recipient');
			const gift = result.gifts[0] as Record<string, unknown>;
			const visitorOnlyFields = [
				'likeCount',
				'reservedCount',
				'isFullyReserved',
				'reserverNames',
				'myReservationId',
				'myReservationPurchasedAt',
			];
			for (const field of visitorOnlyFields) {
				expect(field in gift, `field "${field}" must not leak to the recipient`).toBe(
					false,
				);
			}
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when wishlist does not exist', async () => {
			mockDbInstance.pushResult([]);

			await expect(callGetGifts(null, 'nonexistent')).rejects.toMatchObject({
				status: 404,
				message: 'WISHLIST_NOT_FOUND',
			});
		});
	});

	describe('unauthenticated visitor', () => {
		it('returns role=visitor with reservation data when not logged in', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: gift rows (no moderator check since authContext is null)
			mockDbInstance.pushResult([makeGiftRow()]);
			// DB call 3: reservation counts
			mockDbInstance.pushResult([]);
			// DB call 4: like counts
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(null, WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			const gift = result.gifts[0] as GiftForVisitor;
			expect('reservedCount' in gift).toBe(true);
		});
	});

	describe('image metadata is returned to all roles without leaking reservations', () => {
		const imageMeta = {
			fitMode: 'cover-crop',
			cropRect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
			focal: { x: 50, y: 40 },
			zoom: 1.5,
			bgColor: null,
		};

		it('recipient (no self-promote) receives imageKey + imageMeta but no reservation data', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow({ imageKey: 'gifts/cam.jpg', imageMeta })]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForRecipient & Partial<GiftForVisitor>;
			expect(gift.imageKey).toBe('gifts/cam.jpg');
			expect(gift.imageMeta).toEqual(imageMeta);
			expect('reservedCount' in gift).toBe(false);
			expect('likeCount' in gift).toBe(false);
		});

		it('visitor receives imageKey + imageMeta alongside reservation counts', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ imageKey: 'gifts/cam.jpg', imageMeta })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.imageKey).toBe('gifts/cam.jpg');
			expect(gift.imageMeta).toEqual(imageMeta);
			expect(gift.reservedCount).toBe(0);
		});
	});

	describe('gift links are returned to all roles', () => {
		const links = [
			{ url: 'https://www.alza.cz/playstation-5' },
			{ url: 'https://www.datart.cz/playstation-5', label: 'Datart' },
		];

		it('recipient (no self-promote) receives the full links array', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow({ links })]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForRecipient;
			expect(gift.links).toEqual(links);
		});

		it('visitor receives the full links array alongside reservation counts', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ links })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.links).toEqual(links);
			expect(gift.reservedCount).toBe(0);
		});
	});
});
