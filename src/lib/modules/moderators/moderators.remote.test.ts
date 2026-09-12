import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('$lib/server/remote.js', () => ({
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedQueryWithArgs: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
}));

// Cross-module queries referenced only for single-flight refreshes (issue #108);
// mocked so this suite does not load the other module's schema graph.
vi.mock('$lib/modules/wishlists/wishlists.remote.js', () => ({
	getWishlistByShortId: vi.fn(),
}));

// Cross-module queries referenced only for single-flight refreshes (issue #108);
// mocked so this suite does not load the other module's schema graph.
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({
	getGiftsByWishlistShortId: vi.fn(),
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	count: vi.fn(() => 'count()'),
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'w.id',
		recipientUserId: 'w.recipientUserId',
		recipientName: 'w.recipientName',
		recipientIsModerator: 'w.recipientIsModerator',
		shortId: 'w.shortId',
		status: 'w.status',
		deletedAt: 'w.deletedAt',
		updatedAt: 'w.updatedAt',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'ma.id',
		wishlistId: 'ma.wishlistId',
		userId: 'ma.userId',
		deletedAt: 'ma.deletedAt',
		assignedAt: 'ma.assignedAt',
	},
	moderatorInvite: {
		id: 'mi.id',
		token: 'mi.token',
		wishlistId: 'mi.wishlistId',
		createdByUserId: 'mi.createdByUserId',
		usedByUserId: 'mi.usedByUserId',
		usedAt: 'mi.usedAt',
		revokedAt: 'mi.revokedAt',
		createdAt: 'mi.createdAt',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: { id: 'u.id', name: 'u.name', image: 'u.image' },
}));

vi.mock('$lib/server/db/follower.schema.js', () => ({
	wishlistFollower: {
		wishlistId: 'wf.wishlistId',
		userId: 'wf.userId',
		unfollowedAt: 'wf.unfollowedAt',
	},
}));

import { acceptModeratorInvite, generateModeratorInviteLink } from './moderators.remote.js';
import { getDb } from '$lib/server/db/index.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';

const mockGetDb = vi.mocked(getDb);
const mockDispatchNotification = vi.mocked(dispatchNotification);

/**
 * Creates a mock database whose chained query methods resolve to sequential
 * entries from queryResults. Each entry is the resolved value for one awaited
 * query chain.
 */
function createMockDb(queryResults: unknown[][]): ReturnType<typeof getDb> {
	let queryIndex = 0;

	const createChain = (): unknown =>
		new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === 'then') {
						const result = queryResults[queryIndex] ?? [];
						queryIndex++;
						return (resolve: (value: unknown) => void) => resolve(result);
					}
					return vi.fn(() => createChain());
				},
			},
		);

	return {
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		delete: vi.fn(() => createChain()),
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			const txProxy = {
				select: vi.fn(() => createChain()),
				insert: vi.fn(() => createChain()),
				update: vi.fn(() => createChain()),
				delete: vi.fn(() => createChain()),
			};
			return callback(txProxy);
		}),
	} as unknown as ReturnType<typeof getDb>;
}

// ── Shared fixtures ──────────────────────────────────────────────────────────

// `recipientUser` is the linked recipient of the self list (`activeWishlistRow`) — manages it
// inherently, so `verifyManagerAccess`/`resolveWishlistRole` match without a mod-assignment query.
const recipientUser = { id: 'recipient-1', email: 'recipient@example.com' };
const regularUser = { id: 'user-2', email: 'user@example.com' };

const recipientAuthContext = { user: recipientUser };
const regularAuthContext = { user: regularUser };

const testWishlistId = 'wl-abc';
const testInviteId = 'inv-abc';
const testInviteToken = 'tok-abc';
const testAssignmentId = 'asgn-abc';

/** A "self" list: the linked recipient (`recipientUser`) is the manager; no free-text name. */
const activeWishlistRow = {
	id: testWishlistId,
	recipientUserId: recipientUser.id,
	recipientName: null,
	recipientIsModerator: false,
	shortId: 'short-abc',
	title: 'Test List',
	status: 'active',
	deletedAt: null,
};

/** A "for-someone" list: no linked recipient, free-text name, managed only via moderatorAssignment. */
const forSomeoneWishlistRow = {
	id: testWishlistId,
	recipientUserId: null,
	recipientName: 'Grandma',
	recipientIsModerator: false,
	shortId: 'short-abc',
	title: 'Test List',
	status: 'active',
	deletedAt: null,
};

const pendingInviteRow = {
	id: testInviteId,
	token: testInviteToken,
	wishlistId: testWishlistId,
	createdByUserId: recipientUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2025-01-01'),
};

const activeAssignmentRow = {
	id: testAssignmentId,
	wishlistId: testWishlistId,
	userId: regularUser.id,
	deletedAt: null,
	assignedAt: new Date('2025-01-01'),
};

// ── Helper wrappers (bypass TS signature enforcement on mocked functions) ────

const callAcceptModeratorInvite = (
	authContext: typeof recipientAuthContext,
	input: { token: string },
) => (acceptModeratorInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callGenerateModeratorInviteLink = (
	authContext: typeof recipientAuthContext,
	input: { wishlistId: string; email?: string },
) =>
	(generateModeratorInviteLink as unknown as (...args: unknown[]) => unknown)(authContext, input);

// ── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
});

// ── acceptModeratorInvite ────────────────────────────────────────────────────

describe('acceptModeratorInvite', () => {
	it('valid invite → creates assignment and returns wishlist info', async () => {
		// 1: invite lookup, 2: wishlist lookup, 3: existing mod check → none,
		// 4: update invite (mark used), 5: insert assignment → returns row
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingInviteRow],
				[activeWishlistRow],
				[], // not already a moderator
				[], // update invite mutation
				[{ id: testAssignmentId, wishlistId: testWishlistId, userId: regularUser.id }],
			]),
		);

		const result = await callAcceptModeratorInvite(regularAuthContext, {
			token: testInviteToken,
		});

		expect(result).toEqual({
			wishlistId: testWishlistId,
			wishlistShortId: activeWishlistRow.shortId,
			wishlistTitle: activeWishlistRow.title,
		});
	});

	it('invite not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: 'nonexistent-token' }),
		).rejects.toMatchObject({ status: 404, message: 'INVITE_NOT_FOUND' });
	});

	it('revoked invite → throws 400', async () => {
		const revokedInvite = { ...pendingInviteRow, revokedAt: new Date('2025-02-01') };
		mockGetDb.mockReturnValue(createMockDb([[revokedInvite]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_REVOKED' });
	});

	it('already used invite → throws 400', async () => {
		const usedInvite = {
			...pendingInviteRow,
			usedAt: new Date('2025-02-01'),
			usedByUserId: regularUser.id,
		};
		mockGetDb.mockReturnValue(createMockDb([[usedInvite]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_USED' });
	});

	it('linked recipient accepting own invite → throws 400', async () => {
		// 1: invite found, 2: wishlist found (recipientUserId matches currentUser)
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [activeWishlistRow]]));

		await expect(
			callAcceptModeratorInvite(recipientAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({
			status: 400,
			message: 'RECIPIENT_CANNOT_ACCEPT_OWN_INVITE',
		});
	});

	it('user already a moderator → throws 400', async () => {
		// 1: invite found, 2: wishlist found, 3: existing assignment found
		mockGetDb.mockReturnValue(
			createMockDb([[pendingInviteRow], [activeWishlistRow], [activeAssignmentRow]]),
		);

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'ALREADY_MODERATOR' });
	});

	it('archived wishlist → throws 400', async () => {
		const archivedWishlistRow = { ...activeWishlistRow, status: 'archived' };
		// 1: invite found, 2: wishlist found with archived status
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [archivedWishlistRow]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});
});

// ── generateModeratorInviteLink ──────────────────────────────────────────────

const createdInviteRow = {
	id: 'inv-new',
	token: 'tok-new',
	wishlistId: testWishlistId,
	createdByUserId: recipientUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2025-03-01'),
};

describe('generateModeratorInviteLink', () => {
	it('archived wishlist → throws 400', async () => {
		const archivedWishlistRow = { ...activeWishlistRow, status: 'archived' };
		// 1: requireWishlistRow (recipient = manager, no mod query)
		mockGetDb.mockReturnValue(createMockDb([[archivedWishlistRow]]));

		await expect(
			callGenerateModeratorInviteLink(recipientAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});

	it('without email → returns token + invitePath, does NOT call dispatchNotification', async () => {
		// 1: requireWishlistRow, 2: insert invite → returns created row
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [createdInviteRow]]));

		const result = await callGenerateModeratorInviteLink(recipientAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: `/w/${activeWishlistRow.shortId}/invite/${createdInviteRow.token}`,
			unregisteredInvitee: false,
		});
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('a moderator (not the recipient) may also generate an invite link', async () => {
		// 1: requireWishlistRow (for-someone list, caller not recipient),
		// 2: hasActiveModeratorAssignment → found, 3: insert invite → created row
		mockGetDb.mockReturnValue(
			createMockDb([[forSomeoneWishlistRow], [{ id: 'assignment-1' }], [createdInviteRow]]),
		);

		const result = await callGenerateModeratorInviteLink(regularAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: `/w/${forSomeoneWishlistRow.shortId}/invite/${createdInviteRow.token}`,
			unregisteredInvitee: false,
		});
	});

	it('with email → dispatches MODERATOR_INVITED to targetEmails with urlPathOverride pointing to invite path', async () => {
		const testEmail = 'invitee@example.com';
		// 1: requireWishlistRow, 2: insert invite → created row, 3: user lookup → not registered
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [createdInviteRow], []]));

		const result = await callGenerateModeratorInviteLink(recipientAuthContext, {
			wishlistId: testWishlistId,
			email: testEmail,
		});

		const expectedInvitePath = `/w/${activeWishlistRow.shortId}/invite/${createdInviteRow.token}`;

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: expectedInvitePath,
			unregisteredInvitee: true,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
		expect(mockDispatchNotification).toHaveBeenCalledWith({
			type: 'moderator_invited',
			targetEmails: [testEmail],
			wishlistId: testWishlistId,
			actorId: recipientUser.id,
			actorName: undefined,
			urlPathOverride: expectedInvitePath,
			// Caller-held wishlist context spares the dispatcher its own lookup (issue #108).
			wishlist: { title: activeWishlistRow.title, shortId: activeWishlistRow.shortId },
		});
	});

	it('with email of a registered user → unregisteredInvitee is false', async () => {
		const testEmail = regularUser.email;
		// 1: requireWishlistRow, 2: insert invite → created row, 3: user lookup → registered user found
		mockGetDb.mockReturnValue(
			createMockDb([[activeWishlistRow], [createdInviteRow], [{ id: regularUser.id }]]),
		);

		const result = await callGenerateModeratorInviteLink(recipientAuthContext, {
			wishlistId: testWishlistId,
			email: testEmail,
		});

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: `/w/${activeWishlistRow.shortId}/invite/${createdInviteRow.token}`,
			unregisteredInvitee: false,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
	});
});

// ── revokeModeratorInvite ────────────────────────────────────────────────────
