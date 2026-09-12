import { vi, beforeEach } from 'vitest';

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
	singleFlightRefresh: vi.fn(),
}));

// Stubbed rather than left to import the real module: pulling in wishlists.remote.js would also
// pull in its own module-level guardedQuery()/guardedCommand() calls, which this file's narrow
// $lib/server/remote.js mock doesn't cover.
vi.mock('$lib/modules/wishlists/wishlists.remote.js', () => ({
	getMyWishlists: vi.fn(),
	getModeratedWishlists: vi.fn(),
	getFollowedWishlists: vi.fn(),
	getWishlistByShortId: vi.fn(),
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
		sharedAt: 'w.sharedAt',
		deletedAt: 'w.deletedAt',
		updatedAt: 'w.updatedAt',
	},
}));

vi.mock('$lib/server/db/claim.schema.js', () => ({
	claimInvite: {
		id: 'ci.id',
		token: 'ci.token',
		wishlistId: 'ci.wishlistId',
		createdByUserId: 'ci.createdByUserId',
		usedByUserId: 'ci.usedByUserId',
		usedAt: 'ci.usedAt',
		revokedAt: 'ci.revokedAt',
		createdAt: 'ci.createdAt',
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
}));

vi.mock('$lib/server/db/follower.schema.js', () => ({
	wishlistFollower: {
		wishlistId: 'wf.wishlistId',
		userId: 'wf.userId',
		unfollowedAt: 'wf.unfollowedAt',
	},
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: { id: 'g.id', wishlistId: 'g.wishlistId', deletedAt: 'g.deletedAt' },
	reservation: {
		id: 'r.id',
		giftId: 'r.giftId',
		userId: 'r.userId',
		deletedAt: 'r.deletedAt',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: { id: 'u.id', name: 'u.name', image: 'u.image', email: 'u.email' },
}));

import {
	getClaimInvitesForWishlist,
	generateClaimInviteLink,
	acceptClaimInvite,
	revokeClaimInvite,
} from './claim.remote.js';
import { getDb } from '$lib/server/db/index.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';

const mockGetDb = vi.mocked(getDb);
const mockDispatchNotification = vi.mocked(dispatchNotification);

/**
 * Mock database whose chained query methods resolve to sequential entries from
 * queryResults. Each awaited chain (including inside a transaction) consumes one entry.
 */
const transactionSetPayloads: Record<string, unknown>[] = [];

function createMockDb(queryResults: unknown[][]): ReturnType<typeof getDb> {
	let queryIndex = 0;

	const createChain = (insideTransaction = false): unknown =>
		new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === 'then') {
						const result = queryResults[queryIndex] ?? [];
						queryIndex++;
						return (resolve: (value: unknown) => void) => resolve(result);
					}
					if (prop === 'set') {
						return vi.fn((payload: Record<string, unknown>) => {
							if (insideTransaction) {
								transactionSetPayloads.push(payload);
							}
							return createChain(insideTransaction);
						});
					}
					return vi.fn(() => createChain(insideTransaction));
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
				select: vi.fn(() => createChain(true)),
				insert: vi.fn(() => createChain(true)),
				update: vi.fn(() => createChain(true)),
				delete: vi.fn(() => createChain(true)),
			};
			return callback(txProxy);
		}),
	} as unknown as ReturnType<typeof getDb>;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const janaUser = { id: 'jana-1', name: 'Jana', email: 'jana@example.com' };
const evaUser = { id: 'eva-1', name: 'Eva', email: 'eva@example.com' };

const janaAuthContext = { user: janaUser };
const evaAuthContext = { user: evaUser };

const testWishlistId = 'wl-klara';
const testShortId = 'klarawl1';
const testToken = 'claim-tok-abc';
const testInviteId = 'ci-abc';

/** For-someone list (free-text recipient „Klára"), shared, správce = Jana. */
const forSomeoneShared = {
	id: testWishlistId,
	recipientUserId: null,
	recipientName: 'Klára',
	recipientIsModerator: false,
	shortId: testShortId,
	title: 'Klářin seznam',
	status: 'active',
	sharedAt: new Date('2026-06-22T09:00:00Z'),
	deletedAt: null,
};

/** Same list before sharing (guard 1 does not apply). */
const forSomeoneDraft = { ...forSomeoneShared, status: 'draft', sharedAt: null };

/** Archived for-someone list. */
const forSomeoneArchived = { ...forSomeoneShared, status: 'archived' };

/** A linked (self) list — nothing to claim. */
const linkedWishlist = {
	...forSomeoneShared,
	recipientUserId: 'martin-1',
	recipientName: null,
};

const pendingClaimInviteRow = {
	id: testInviteId,
	token: testToken,
	wishlistId: testWishlistId,
	createdByUserId: janaUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2026-06-23T09:00:00Z'),
};

const createdClaimInviteRow = {
	id: 'ci-new',
	token: 'claim-tok-new',
	wishlistId: testWishlistId,
	createdByUserId: janaUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2026-06-24T09:00:00Z'),
};

// ── Helper wrappers (bypass TS signature enforcement on mocked functions) ────

const callGetClaimInvitesForWishlist = (authContext: typeof janaAuthContext, wishlistId: string) =>
	(getClaimInvitesForWishlist as unknown as (...args: unknown[]) => unknown)(
		authContext,
		wishlistId,
	);

const callGenerateClaimInviteLink = (
	authContext: typeof janaAuthContext,
	input: { wishlistId: string; email?: string },
) => (generateClaimInviteLink as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callAcceptClaimInvite = (authContext: typeof evaAuthContext, input: { token: string }) =>
	(acceptClaimInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callRevokeClaimInvite = (authContext: typeof janaAuthContext, input: { inviteId: string }) =>
	(revokeClaimInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

beforeEach(() => {
	vi.clearAllMocks();
	transactionSetPayloads.length = 0;
});

// ── generateClaimInviteLink (generation gating) ──────────────────────────────

export {
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
	testInviteId,
	forSomeoneShared,
	forSomeoneDraft,
	forSomeoneArchived,
	linkedWishlist,
	pendingClaimInviteRow,
	createdClaimInviteRow,
	callGetClaimInvitesForWishlist,
	callGenerateClaimInviteLink,
	callAcceptClaimInvite,
	callRevokeClaimInvite,
	transactionSetPayloads,
};
