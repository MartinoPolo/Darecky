import {
	vi,
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	mockDbInstance,
	mockDeleteObjects,
	WISHLIST_ID,
	makeWishlistRow,
	makeForSomeoneWishlistRow,
	bannerAssignmentToken,
	makeRecipientAuthContext,
	makeOtherAuthContext,
	makeModeratorAuthContext,
	callDeleteWishlist,
	callUpdateWishlist,
	callSetWishlistPalette,
} from './wishlists.remote.test-setup.js';

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

describe('deleteWishlist', () => {
	describe('recipient can delete an unshared wishlist', () => {
		it('resolves without throwing when the linked recipient deletes a draft wishlist', async () => {
			// DB call 1: requireWishlistRow (recipientUserId matches caller → manager, no mod query)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: gift image-key collection (issue #107 cleanup)
			mockDbInstance.pushResult([]);
			// DB call 3: soft-delete update
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeRecipientAuthContext(), WISHLIST_ID),
			).resolves.not.toThrow();
		});

		it('deletes the wishlist image and its gifts’ images from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/w.jpg' }),
			]);
			mockDbInstance.pushResult([{ imageKey: 'gifts/a.jpg' }, { imageKey: null }]);
			mockDbInstance.pushResult([]);

			await callDeleteWishlist(makeRecipientAuthContext(), WISHLIST_ID);

			expect(mockDeleteObjects).toHaveBeenCalledWith([
				'wishlists/banners/w.jpg',
				'gifts/a.jpg',
				null,
			]);
		});
	});

	describe('non-manager cannot delete', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});

	describe('shared wishlist cannot be deleted', () => {
		it('throws 400 when sharedAt is not null', async () => {
			// DB call 1: wishlist lookup with sharedAt set
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date('2024-01-10T00:00:00Z'), status: 'active' }),
			]);

			await expect(
				callDeleteWishlist(makeRecipientAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 400,
				message: expect.stringContaining('Cannot delete a shared wishlist'),
			});
		});
	});

	describe('non-existent wishlist', () => {
		it('throws 404 when wishlist does not exist', async () => {
			// DB call 1: empty lookup result
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeRecipientAuthContext(), 'ghost-wishlist'),
			).rejects.toMatchObject({
				status: 404,
				message: 'WISHLIST_NOT_FOUND',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('setWishlistPalette', () => {
	describe('non-manager cannot change the palette', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callSetWishlistPalette(makeOtherAuthContext(), {
					wishlistId: WISHLIST_ID,
					palette: 'mint',
				}),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});

	describe('archived wishlist is read-only', () => {
		it('throws 400 even for the linked recipient (same rule as updateWishlist)', async () => {
			// DB call 1: requireWishlistRow — archived list, caller IS the linked recipient
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callSetWishlistPalette(makeRecipientAuthContext(), {
					wishlistId: WISHLIST_ID,
					palette: 'mint',
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('updateWishlist', () => {
	describe('recipient can update title on an unshared wishlist', () => {
		it('returns updated wishlist row', async () => {
			const updatedRow = makeWishlistRow({ title: 'New Title' });
			// DB call 1: requireWishlistRow (recipient = manager, no mod query; not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				title: 'New Title',
			});

			expect(result).toMatchObject({ id: WISHLIST_ID, title: 'New Title' });
		});
	});

	describe('moderator (správce) can update title on a for-someone list', () => {
		it('returns updated wishlist row after the mod-assignment check passes', async () => {
			const updatedRow = makeForSomeoneWishlistRow({ title: 'New Title' });
			// DB call 1: requireWishlistRow (for-someone list, caller is not recipient)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ sharedAt: null })]);
			// DB call 2: hasActiveModeratorAssignment → found → manager
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeModeratorAuthContext(), {
				id: WISHLIST_ID,
				title: 'New Title',
			});

			expect(result).toMatchObject({ id: WISHLIST_ID, title: 'New Title' });
		});
	});

	describe('recipient can update image assignment + per-slot metadata', () => {
		it('persists imageKey and imageSlots', async () => {
			const imageSlots = {
				card: { fitMode: 'cover-crop', focal: { x: 50, y: 40 } },
				banner: { fitMode: 'cover-crop', cropRect: { x: 0, y: 0, w: 1, h: 0.5 } },
			};
			const imageKey = 'wishlists/banners/hero.jpg';
			const updatedRow = makeWishlistRow({ imageKey, imageSlots });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey,
				imageSlots,
				imageAssignmentToken: await bannerAssignmentToken(imageKey),
			});

			expect(result).toMatchObject({ imageKey, imageSlots });
		});

		it('locks the mutable row in a transaction before replacing and cleaning up its image', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ imageKey: 'wishlists/banners/new.jpg' })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey: 'wishlists/banners/new.jpg',
				imageAssignmentToken: await bannerAssignmentToken('wishlists/banners/new.jpg'),
			});

			expect(mockDbInstance.transactionCount()).toBe(1);
			expect(mockDbInstance.forPayloads()).toEqual(['update']);
			expect(mockDeleteObjects).toHaveBeenCalledWith(['wishlists/banners/old.jpg']);
		});

		it('deletes the replaced uploaded image from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ imageKey: 'wishlists/banners/new.jpg' })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey: 'wishlists/banners/new.jpg',
				imageAssignmentToken: await bannerAssignmentToken('wishlists/banners/new.jpg'),
			});

			expect(mockDeleteObjects).toHaveBeenCalledWith(['wishlists/banners/old.jpg']);
		});

		it('rejects planting another uploader’s banner key before it can later be deleted', async () => {
			const victimKey = 'wishlists/banners/victim.jpg';
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);

			await expect(
				callUpdateWishlist(makeRecipientAuthContext(), {
					id: WISHLIST_ID,
					imageKey: victimKey,
					imageAssignmentToken: await bannerAssignmentToken(victimKey, 'victim-user'),
				}),
			).rejects.toThrow('ACCESS_DENIED');
			expect(mockDeleteObjects).not.toHaveBeenCalled();
		});

		it('keeps storage untouched when only crop metadata changes (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/same.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow()]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageSlots: { card: { fitMode: 'cover-crop' } },
			});

			expect(mockDeleteObjects).not.toHaveBeenCalled();
		});
	});

	describe('recipient can update description on an unshared wishlist', () => {
		it('returns updated wishlist row with new description', async () => {
			const updatedRow = makeWishlistRow({ description: 'A festive list' });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				description: 'A festive list',
			});

			// The description must actually be written to the update payload, not just
			// echoed by the mock return value.
			expect(mockDbInstance.lastSetPayload()).toMatchObject({
				description: 'A festive list',
			});
			expect(result).toMatchObject({ id: WISHLIST_ID, description: 'A festive list' });
		});
	});

	describe('recipient can update event date on an unshared wishlist', () => {
		it('returns updated wishlist row with new event date', async () => {
			const eventDate = new Date('2026-12-24T00:00:00Z');
			const updatedRow = makeWishlistRow({ eventDate });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate,
			});

			// The event date must reach the update payload on an unshared wishlist.
			expect(mockDbInstance.lastSetPayload()).toMatchObject({ eventDate });
			expect(result).toMatchObject({ id: WISHLIST_ID, eventDate });
		});
	});

	describe('non-manager cannot update', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callUpdateWishlist(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					title: 'Hacked Title',
				}),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});

	describe('archived wishlist cannot be updated', () => {
		it('throws 400 when wishlist status is archived', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callUpdateWishlist(makeRecipientAuthContext(), {
					id: WISHLIST_ID,
					title: 'Should Fail',
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST',
			});
		});
	});

	describe('event date grace window (issue #83)', () => {
		const nowFake = new Date('2024-03-01T12:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('allows editing the event date while the window is open and bumps the debounce timestamp', async () => {
			const newDate = new Date('2026-12-24T00:00:00Z');
			// shared 60s ago, never re-edited → window open
			mockDbInstance.pushResult([
				makeWishlistRow({
					sharedAt: new Date(nowFake.getTime() - 60_000),
					eventDateEditedAt: null,
					status: 'active',
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ eventDate: newDate })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate: newDate,
			});

			const payload = mockDbInstance.lastSetPayload();
			expect(payload).toMatchObject({ eventDate: newDate });
			expect(payload?.eventDateEditedAt).toBeInstanceOf(Date);
		});

		it('keeps the window open via a recent eventDateEditedAt even when sharedAt is old (debounce)', async () => {
			const newDate = new Date('2026-12-24T00:00:00Z');
			mockDbInstance.pushResult([
				makeWishlistRow({
					sharedAt: new Date(nowFake.getTime() - 10 * 60_000), // shared 10 min ago
					eventDateEditedAt: new Date(nowFake.getTime() - 30_000), // last date edit 30s ago
					status: 'active',
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ eventDate: newDate })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate: newDate,
			});

			expect(mockDbInstance.lastSetPayload()).toMatchObject({ eventDate: newDate });
		});

		it('drops the event date once the window has closed (stale client cannot bypass server)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({
					sharedAt: new Date(nowFake.getTime() - 3 * 60_000), // shared 3 min ago → closed
					eventDateEditedAt: null,
					status: 'active',
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow()]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate: new Date('2026-12-24T00:00:00Z'),
			});

			const payload = mockDbInstance.lastSetPayload();
			expect(payload && 'eventDate' in payload).toBe(false);
			expect(payload && 'eventDateEditedAt' in payload).toBe(false);
		});
	});

	describe('event date locked after sharing', () => {
		it('silently ignores eventDate change when wishlist is shared', async () => {
			const updatedRow = makeWishlistRow({
				sharedAt: new Date('2024-01-10T00:00:00Z'),
				title: 'Updated Title',
				// eventDate stays null (was not updated)
				eventDate: null,
			});
			// DB call 1: wishlist lookup (already shared)
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date('2024-01-10T00:00:00Z'), status: 'active' }),
			]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			// Should NOT throw – eventDate change is silently dropped
			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				title: 'Updated Title',
				eventDate: new Date('2025-12-25T00:00:00Z'),
			});

			expect(result).toMatchObject({ id: WISHLIST_ID });
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
