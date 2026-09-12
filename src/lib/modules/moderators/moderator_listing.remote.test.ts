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

import { getModeratorsForWishlist } from './moderators.remote.js';
import { getDb } from '$lib/server/db/index.js';

const mockGetDb = vi.mocked(getDb);

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

// ── Helper wrappers (bypass TS signature enforcement on mocked functions) ────

const callGetModeratorsForWishlist = (
	authContext: typeof recipientAuthContext,
	wishlistId: string,
) =>
	(getModeratorsForWishlist as unknown as (...args: unknown[]) => unknown)(
		authContext,
		wishlistId,
	);

// ── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
});

// ── acceptModeratorInvite ────────────────────────────────────────────────────

describe('getModeratorsForWishlist', () => {
	it('recipient of a self list sees moderators + pending invites; recipientName null, isForSomeoneElse false', async () => {
		const moderatorRow = {
			id: testAssignmentId,
			userId: regularUser.id,
			userName: 'Test User',
			userImage: null,
			assignedAt: new Date('2025-01-01'),
		};
		const inviteRow = {
			id: testInviteId,
			token: testInviteToken,
			createdAt: new Date('2025-01-01'),
			usedAt: null,
			revokedAt: null,
		};

		// 1: requireWishlistRow (recipient match, no mod query), 2: moderators select, 3: invites select
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [moderatorRow], [inviteRow]]));

		const result = await callGetModeratorsForWishlist(recipientAuthContext, testWishlistId);

		expect(result).toEqual({
			moderators: [moderatorRow],
			pendingInvites: [inviteRow],
			recipientIsModerator: false,
			isForSomeoneElse: false,
			recipientName: null,
		});
	});

	it('a moderator on a for-someone list also sees pending invites; exposes recipientName + isForSomeoneElse', async () => {
		const moderatorRow = {
			id: testAssignmentId,
			userId: regularUser.id,
			userName: 'Test User',
			userImage: null,
			assignedAt: new Date('2025-01-01'),
		};
		const inviteRow = {
			id: testInviteId,
			token: testInviteToken,
			createdAt: new Date('2025-01-01'),
			usedAt: null,
			revokedAt: null,
		};

		// 1: requireWishlistRow (for-someone), 2: resolveWishlistRole mod check → found,
		// 3: moderators select, 4: invites select (invites now visible to any manager)
		mockGetDb.mockReturnValue(
			createMockDb([
				[forSomeoneWishlistRow],
				[{ id: 'assignment-1' }],
				[moderatorRow],
				[inviteRow],
			]),
		);

		const result = await callGetModeratorsForWishlist(regularAuthContext, testWishlistId);

		expect(result).toEqual({
			moderators: [moderatorRow],
			pendingInvites: [inviteRow],
			recipientIsModerator: false,
			isForSomeoneElse: true,
			recipientName: 'Grandma',
		});
	});

	it('wishlist not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callGetModeratorsForWishlist(recipientAuthContext, 'nonexistent-wl'),
		).rejects.toMatchObject({ status: 404, message: 'WISHLIST_NOT_FOUND' });
	});

	it('non-manager (neither recipient nor správce) → throws 403 ACCESS_DENIED', async () => {
		// 1: requireWishlistRow (for-someone), 2: resolveWishlistRole mod check → empty (not a mod)
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneWishlistRow], []]));

		await expect(
			callGetModeratorsForWishlist(regularAuthContext, testWishlistId),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});
});
