import { describe, expect, it } from 'vitest';
import {
	mockGetDb,
	mockDispatchNotification,
	createMockDb,
	janaUser,
	evaUser,
	janaAuthContext,
	evaAuthContext,
	testWishlistId,
	testShortId,
	testToken,
	forSomeoneShared,
	forSomeoneDraft,
	forSomeoneArchived,
	linkedWishlist,
	pendingClaimInviteRow,
	createdClaimInviteRow,
	callGenerateClaimInviteLink,
	callAcceptClaimInvite,
	transactionSetPayloads,
} from './claim.remote.test-fixtures.js';

describe('generateClaimInviteLink', () => {
	it('správce of a for-someone list generates a claim link (no email)', async () => {
		// 1: requireWishlistRow, 2: hasActiveModeratorAssignment (Jana) → found, 3: insert → created
		mockGetDb.mockReturnValue(
			createMockDb([[forSomeoneShared], [{ id: 'assignment-1' }], [createdClaimInviteRow]]),
		);

		const result = await callGenerateClaimInviteLink(janaAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({
			token: createdClaimInviteRow.token,
			claimPath: `/w/${testShortId}/claim/${createdClaimInviteRow.token}`,
			unregisteredInvitee: false,
		});
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('rejects generation on a linked-recipient list', async () => {
		// caller IS the linked recipient → verifyManagerAccess passes with 1 query, then linked check throws
		mockGetDb.mockReturnValue(
			createMockDb([[{ ...linkedWishlist, recipientUserId: janaUser.id }]]),
		);

		await expect(
			callGenerateClaimInviteLink(janaAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_NOT_FOR_LINKED_RECIPIENT' });
	});

	it('rejects generation on an archived list', async () => {
		// 1: requireWishlistRow (for-someone), 2: hasActiveModeratorAssignment → found, then archived check throws
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneArchived], [{ id: 'assignment-1' }]]));

		await expect(
			callGenerateClaimInviteLink(janaAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});

	it('non-manager cannot generate → 403 ACCESS_DENIED', async () => {
		// 1: requireWishlistRow (for-someone), 2: hasActiveModeratorAssignment → none (Eva not a správce)
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneShared], []]));

		await expect(
			callGenerateClaimInviteLink(evaAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});

	it('with email → dispatches CLAIM_INVITED with the claim path as urlPathOverride', async () => {
		const testEmail = 'klara@example.com';
		// 1: requireWishlistRow, 2: mod assignment → found, 3: insert → created, 4: user lookup → none
		mockGetDb.mockReturnValue(
			createMockDb([
				[forSomeoneShared],
				[{ id: 'assignment-1' }],
				[createdClaimInviteRow],
				[],
			]),
		);

		const result = await callGenerateClaimInviteLink(janaAuthContext, {
			wishlistId: testWishlistId,
			email: testEmail,
		});

		const expectedClaimPath = `/w/${testShortId}/claim/${createdClaimInviteRow.token}`;
		expect(result).toEqual({
			token: createdClaimInviteRow.token,
			claimPath: expectedClaimPath,
			unregisteredInvitee: true,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
		expect(mockDispatchNotification).toHaveBeenCalledWith({
			type: 'claim_invited',
			targetEmails: [testEmail],
			wishlistId: testWishlistId,
			actorId: janaUser.id,
			actorName: janaUser.name,
			urlPathOverride: expectedClaimPath,
		});
	});
});

// ── acceptClaimInvite (claim transaction + guards) ───────────────────────────

describe('acceptClaimInvite', () => {
	it('valid claim on a shared list → links claimer, clears name, notifies správci', async () => {
		// 1: invite, 2: wishlist, 3: guard1 assignment history → none, 4: guard2 reservations → none,
		// 5: managers → [Jana], 6-8: tx updates (invite, wishlist, assignment)
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[], // no prior assignment for Eva
				[], // no active reservations
				[{ userId: janaUser.id }],
				[], // tx: mark invite used
				[], // tx: link wishlist
				[], // tx: soft-delete claimer assignment (none)
				[], // tx: soft-delete claimer follower row
			]),
		);

		const result = await callAcceptClaimInvite(evaAuthContext, { token: testToken });

		expect(result).toEqual({
			wishlistId: testWishlistId,
			wishlistShortId: testShortId,
			wishlistTitle: forSomeoneShared.title,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
		expect(transactionSetPayloads).toEqual(
			expect.arrayContaining([expect.objectContaining({ unfollowedAt: expect.any(Date) })]),
		);
		expect(mockDispatchNotification).toHaveBeenCalledWith({
			type: 'recipient_claimed',
			targetUserIds: [janaUser.id],
			wishlistId: testWishlistId,
			actorId: evaUser.id,
			actorName: evaUser.name,
		});
	});

	it('guard 1: shared list + claimer ever held správce access (revoked row) → rejected', async () => {
		// 1: invite, 2: wishlist (shared), 3: guard1 assignment history → a row exists (even soft-deleted)
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[{ id: 'revoked-assignment' }],
			]),
		);

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_EX_MANAGER' });
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('guard 1 is skipped on a never-shared list: active správce may claim, assignment revoked', async () => {
		// sharedAt null → no guard1 query. 1: invite, 2: wishlist (draft), 3: guard2 reservations → none,
		// 4: managers → [Jana(claimer)], 5-7: tx updates
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneDraft],
				[], // no active reservations
				[{ userId: janaUser.id }], // Jana is the sole active správce and also the claimer
				[], // tx: mark invite used
				[], // tx: link wishlist
				[], // tx: soft-delete claimer's own assignment
				[], // tx: soft-delete claimer follower row
			]),
		);

		const result = await callAcceptClaimInvite(janaAuthContext, { token: testToken });

		expect(result).toEqual({
			wishlistId: testWishlistId,
			wishlistShortId: testShortId,
			wishlistTitle: forSomeoneDraft.title,
		});
		// The only active správce is the claimer, filtered out → no one to notify.
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'recipient_claimed', targetUserIds: [] }),
		);
	});

	it('guard 2: claimer holds active reservations → rejected', async () => {
		// 1: invite, 2: wishlist (shared), 3: guard1 → none, 4: guard2 reservations → a row exists
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[], // no prior assignment
				[{ id: 'reservation-1' }], // active reservation
			]),
		);

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_HAS_RESERVATIONS' });
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('already-linked list → rejected', async () => {
		mockGetDb.mockReturnValue(createMockDb([[pendingClaimInviteRow], [linkedWishlist]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_ALREADY_LINKED' });
	});

	it('invite not found → 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: 'nope' }),
		).rejects.toMatchObject({ status: 404, message: 'INVITE_NOT_FOUND' });
	});

	it('revoked invite → 400', async () => {
		const revoked = { ...pendingClaimInviteRow, revokedAt: new Date('2026-06-24T00:00:00Z') };
		mockGetDb.mockReturnValue(createMockDb([[revoked]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_REVOKED' });
	});

	it('already-used invite → 400', async () => {
		const used = {
			...pendingClaimInviteRow,
			usedAt: new Date('2026-06-24T00:00:00Z'),
			usedByUserId: evaUser.id,
		};
		mockGetDb.mockReturnValue(createMockDb([[used]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_USED' });
	});

	it('archived wishlist → 400', async () => {
		mockGetDb.mockReturnValue(createMockDb([[pendingClaimInviteRow], [forSomeoneArchived]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});
});

// ── revokeClaimInvite ────────────────────────────────────────────────────────
