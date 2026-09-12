import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as v from 'valibot';
import {
	mockDbInstance,
	mockDispatchNotification,
	RECIPIENT_ID,
	OTHER_USER_ID,
	WISHLIST_ID,
	makeWishlistRow,
	makeForSomeoneWishlistRow,
	makeRecipientAuthContext,
	makeOtherAuthContext,
	makeModeratorAuthContext,
	callArchiveWishlist,
	callCreateWishlist,
	callRenameRecipient,
	callFlipRecipientToFreeText,
	createWishlistInputSchemaFixture as CreateWishlistInputSchema,
	flipRecipientToFreeTextInputSchemaFixture as FlipRecipientToFreeTextInputSchema,
	notificationTypeFixture as NOTIFICATION_TYPE,
} from './wishlists.remote.test-setup.js';

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

describe('renameRecipient', () => {
	describe('a správce can rename a for-someone recipient', () => {
		it('updates recipientName and returns the updated row', async () => {
			const renamedRow = makeForSomeoneWishlistRow({ recipientName: 'Aunt May' });
			// DB call 1: requireWishlistRow (for-someone list, caller not recipient)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → found → manager
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: update returning
			mockDbInstance.pushResult([renamedRow]);

			const result = await callRenameRecipient(makeModeratorAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Aunt May',
			});

			expect(mockDbInstance.lastSetPayload()).toMatchObject({ recipientName: 'Aunt May' });
			expect(result).toMatchObject({ id: WISHLIST_ID, recipientName: 'Aunt May' });
		});
	});

	describe('non-manager cannot rename', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (for-someone list)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none
			mockDbInstance.pushResult([]);

			await expect(
				callRenameRecipient(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Hacked Name',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});
	});

	describe('rejects a self / linked-recipient list', () => {
		it('throws 400 RECIPIENT_RENAME_NOT_ALLOWED when recipientUserId is set (no free-text name to rename)', async () => {
			// DB call 1: requireWishlistRow (self list, recipient = caller → manager, no mod query)
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callRenameRecipient(makeRecipientAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'New Name',
				}),
			).rejects.toMatchObject({ status: 400, message: 'RECIPIENT_RENAME_NOT_ALLOWED' });
		});
	});

	describe('rejects an archived wishlist', () => {
		it('throws 400 CANNOT_MODIFY_ARCHIVED_WISHLIST before touching recipientName', async () => {
			// DB call 1: requireWishlistRow (for-someone + archived)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ status: 'archived' })]);
			// DB call 2: hasActiveModeratorAssignment → found → manager
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);

			await expect(
				callRenameRecipient(makeModeratorAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'New Name',
				}),
			).rejects.toMatchObject({ status: 400, message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST' });
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('flipRecipientToFreeText', () => {
	/** Auth context for the linked recipient incl. name (used as notification actorName). */
	function makeNamedRecipientAuthContext(): { user: { id: string; name: string } } {
		return { user: { id: RECIPIENT_ID, name: 'Recipient Alice' } };
	}

	describe('the linked recipient converts their own list', () => {
		it('clears recipientUserId, sets the free-text name, and resets recipientIsModerator', async () => {
			const flippedRow = makeForSomeoneWishlistRow({ recipientName: 'Rosie' });
			// DB call 1: requireWishlistRow (caller IS the linked recipient; self-promoted before)
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: true })]);
			// DB call 2 (in tx): update wishlist returning
			mockDbInstance.pushResult([flippedRow]);
			// DB call 3 (in tx): insert moderatorAssignment
			mockDbInstance.pushResult([]);

			const result = await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDbInstance.lastSetPayload()).toMatchObject({
				recipientUserId: null,
				recipientName: 'Rosie',
				// The trust banner must disappear — the flag resets even when previously self-promoted.
				recipientIsModerator: false,
			});
			expect(result).toMatchObject({ recipientUserId: null, recipientName: 'Rosie' });
		});

		it('auto-inserts an active správce assignment for the ex-recipient (orphan guard stays satisfied)', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ recipientName: 'Rosie' })]);
			mockDbInstance.pushResult([]);

			await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDbInstance.lastValuesPayload()).toMatchObject({
				wishlistId: WISHLIST_ID,
				userId: RECIPIENT_ID,
			});
		});
	});

	describe('actor gating: only the linked recipient may flip', () => {
		it('throws 403 ACCESS_DENIED for a správce (no evicting a linked recipient)', async () => {
			// DB call 1: requireWishlistRow — caller is MODERATOR_ID, recipient is RECIPIENT_ID.
			// Rejected before any moderator-assignment lookup: správce status is irrelevant.
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callFlipRecipientToFreeText(makeModeratorAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});

		it('throws 403 ACCESS_DENIED for a visitor', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callFlipRecipientToFreeText(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});

		it('throws 403 ACCESS_DENIED on a for-someone list (no linked recipient to flip)', async () => {
			// A free-text list has recipientUserId = null — nobody matches, even a správce.
			mockDbInstance.pushResult([makeForSomeoneWishlistRow()]);

			await expect(
				callFlipRecipientToFreeText(makeModeratorAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});
	});

	describe('archived list is rejected', () => {
		it('throws 400 CANNOT_MODIFY_ARCHIVED_WISHLIST before touching the recipient', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 400, message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST' });
		});
	});

	describe('notification: shared list notifies followers, draft stays silent', () => {
		it('dispatches the self-promote-channel notification to followers, excluding the actor', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date('2024-01-10T00:00:00Z'), status: 'active' }),
			]);
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ recipientName: 'Rosie' })]);
			mockDbInstance.pushResult([]); // insert assignment
			// DB call 4: active followers — includes the actor, who must be filtered out
			mockDbInstance.pushResult([{ userId: OTHER_USER_ID }, { userId: RECIPIENT_ID }]);

			await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
			expect(mockDispatchNotification).toHaveBeenCalledWith({
				type: NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
				targetUserIds: [OTHER_USER_ID],
				wishlistId: WISHLIST_ID,
				actorId: RECIPIENT_ID,
				actorName: 'Recipient Alice',
			});
		});

		it('stays silent on a draft (sharedAt is null)', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ recipientName: 'Rosie' })]);
			mockDbInstance.pushResult([]); // insert assignment

			await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDispatchNotification).not.toHaveBeenCalled();
		});
	});

	describe('input validation (FlipRecipientToFreeTextInputSchema)', () => {
		it('trims the recipient name', () => {
			const parsed = v.parse(FlipRecipientToFreeTextInputSchema, {
				id: WISHLIST_ID,
				recipientName: '  Rosie  ',
			});
			expect(parsed.recipientName).toBe('Rosie');
		});

		it('rejects an empty or whitespace-only name', () => {
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: '',
				}).success,
			).toBe(false);
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: '   ',
				}).success,
			).toBe(false);
		});

		it('rejects a name longer than 100 characters and accepts exactly 100', () => {
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: 'a'.repeat(101),
				}).success,
			).toBe(false);
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: 'a'.repeat(100),
				}).success,
			).toBe(true);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('archiveWishlist', () => {
	describe('recipient can archive', () => {
		it('returns the archived wishlist row', async () => {
			const archivedRow = makeWishlistRow({ status: 'archived', archivedAt: new Date() });
			// DB call 1: requireWishlistRow (recipient = manager, no mod query)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: update returning
			mockDbInstance.pushResult([archivedRow]);
			// DB call 3: follower select (for archive notification)
			mockDbInstance.pushResult([]);
			// DB call 4: moderator select (for archive notification)
			mockDbInstance.pushResult([]);

			const result = await callArchiveWishlist(makeRecipientAuthContext(), WISHLIST_ID);

			expect(result).toMatchObject({ id: WISHLIST_ID, status: 'archived' });
		});
	});

	describe('non-manager cannot archive', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callArchiveWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createWishlist', () => {
	describe('recipientKind: self (creator is the linked recipient)', () => {
		it('inserts the wishlist with recipientUserId = creator, recipientName = null, and NO moderatorAssignment', async () => {
			const createdRow = makeWishlistRow({
				id: 'new-wishlist-id',
				title: 'My Birthday',
				recipientUserId: RECIPIENT_ID,
				recipientName: null,
			});
			// DB call 1 (in tx): insert wishlist returning
			mockDbInstance.pushResult([createdRow]);
			// DB call 2 (in tx): insert default priority levels (no moderatorAssignment on self lists)
			mockDbInstance.pushResult([]);

			const result = await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'My Birthday',
			});

			// The wishlist insert must link the creator as recipient with no free-text name.
			expect(mockDbInstance.lastSetPayload).toBeDefined();
			expect(result).toMatchObject({
				id: 'new-wishlist-id',
				title: 'My Birthday',
				recipientUserId: RECIPIENT_ID,
				recipientName: null,
			});
		});
	});

	describe('recipientKind: other (free-text recipient, creator becomes first správce)', () => {
		it('inserts the wishlist with recipientName set, recipientUserId = null, plus a moderatorAssignment row', async () => {
			const createdRow = makeForSomeoneWishlistRow({
				id: 'new-wishlist-id',
				title: "Grandma's List",
				recipientName: 'Grandma',
			});
			// DB call 1 (in tx): insert wishlist returning
			mockDbInstance.pushResult([createdRow]);
			// DB call 2 (in tx): insert moderatorAssignment for the creator (for-someone list)
			mockDbInstance.pushResult([]);
			// DB call 3 (in tx): insert default priority levels
			mockDbInstance.pushResult([]);

			const result = await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'other',
				recipientName: 'Grandma',
				title: "Grandma's List",
			});

			expect(result).toMatchObject({
				id: 'new-wishlist-id',
				title: "Grandma's List",
				recipientUserId: null,
				recipientName: 'Grandma',
			});
		});
	});

	describe('optional palette + description at creation', () => {
		/** Push the two tx results a self-list create expects (wishlist insert, then priority levels). */
		function pushSelfCreateResults(): void {
			mockDbInstance.pushResult([makeWishlistRow({ id: 'new-wishlist-id' })]);
			mockDbInstance.pushResult([]);
		}

		it('defaults palette to "sky" and description to null when omitted (AC-1)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
			});

			// The wishlist insert is the FIRST `.values(...)` call in the transaction.
			expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({
				palette: 'sky',
				description: null,
			});
		});

		it('persists a chosen palette (AC-2)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
				palette: 'ruby',
			});

			expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({ palette: 'ruby' });
		});

		it('trims a provided description (AC-3)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
				description: '  Moje přání  ',
			});

			expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({ description: 'Moje přání' });
		});

		it('stores null for a whitespace-only description (AC-3)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
				description: '   ',
			});

			expect(mockDbInstance.valuesPayloadAt(0)?.description).toBeNull();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CreateWishlistInputSchema', () => {
	it('accepts an optional palette + description', () => {
		const result = v.parse(CreateWishlistInputSchema, {
			recipientKind: 'self',
			title: 'X',
			palette: 'mint',
			description: 'hi',
		});

		expect(result).toMatchObject({ palette: 'mint', description: 'hi' });
	});

	it('accepts input with palette + description omitted', () => {
		expect(() =>
			v.parse(CreateWishlistInputSchema, { recipientKind: 'self', title: 'X' }),
		).not.toThrow();
	});

	it('rejects an invalid palette value', () => {
		expect(() =>
			v.parse(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'X',
				palette: 'not-a-palette',
			}),
		).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
