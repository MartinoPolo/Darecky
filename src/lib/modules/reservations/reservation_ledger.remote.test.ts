import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { User } from 'better-auth';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

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

/**
 * Wrap a handler so it satisfies SvelteKit's init_remote_functions validator,
 * which requires `fn.__?.type` to be a recognised remote type, while still
 * being callable as a plain function in tests.
 */
function makeRemoteWrapper(
	type: string,
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	const wrapper = (...args: unknown[]) => handler(...args);
	(wrapper as unknown as Record<string, unknown>).__ = { type };
	return wrapper;
}

vi.mock('$lib/server/remote.js', () => ({
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('command', handler),
	),
	publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('query', handler),
	),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('command', handler),
	),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('query', handler),
	),
}));

// Cross-module queries referenced only for single-flight refreshes (issue #108);
// mocked so this suite does not load the other module's schema graph.
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({
	getGiftsByWishlistShortId: vi.fn(),
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

vi.mock('$lib/server/turnstile.js', () => ({
	verifyTurnstileToken: vi.fn(),
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

// admin@example.com is the app admin (issue #150 / #213). The visitor and moderator personas
// below deliberately do NOT match, so every pre-#213 case keeps its original meaning.
vi.mock('$env/dynamic/private', () => ({
	env: { ADMIN_EMAILS: 'admin@example.com' },
}));

// Drizzle ORM helpers are used only as column references in query builders.
// We don't need their real implementations – stub them so the module loads.
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	isNull: vi.fn(),
	sql: Object.assign(vi.fn(), { join: vi.fn() }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { getDb } from '$lib/server/db/index.js';

import {
	reserveGift,
	getReservationLedgerForWishlist,
	getMyReservationsForGift,
} from './reservations.remote.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);

/** Stub getRequestEvent so the anon-visitor helper reads `cookieValue` from the cookie. */

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';
const ADMIN_ID = 'user-admin';

const GIFT_ID = 'gift-1';
const GIFT_NAME = 'Kávovar';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc123';
const RESERVATION_ID = 'reservation-1';

const fakeOwnerUser = { id: OWNER_ID, email: 'owner@example.com' } as unknown as User;
/** Matches the mocked ADMIN_EMAILS — the app administrator (issue #213). */
const fakeAdminUser = {
	id: ADMIN_ID,
	name: 'Admin Adminová',
	email: 'admin@example.com',
} as unknown as User;
/** The app administrator signed in on a list where THEY are the obdarovaný (REQ-6). */

const fakeVisitorUser = { id: VISITOR_ID, email: 'visitor@example.com' } as unknown as User;
/** A visitor with a real display name — used to prove that name never reaches a dispatch payload. */

const fakeModeratorUser = { id: MODERATOR_ID, email: 'mod@example.com' } as unknown as User;

function makeAuthContext(user: User) {
	return { user, session: { id: 'session-1', userId: user.id } };
}

/**
 * Creates a chainable Drizzle-like mock DB object that can serve multiple
 * sequential queries. Each call to `getDb()` returns a fresh chain whose
 * `then` (and `.returning()`) pops from `resultsQueue`.
 *
 * This handles the case where one `database` reference (obtained via a single
 * `getDb()` call) is reused for multiple `await database.select(...)` chains.
 */
function createMultiQueryChain(...resultsQueue: unknown[][]) {
	const queue = [...resultsQueue];

	const chain: Record<string, unknown> = {};
	const chainMethods = [
		'select',
		'from',
		'where',
		'innerJoin',
		'leftJoin',
		'limit',
		'orderBy',
		'groupBy',
		'as',
		'for',
		'insert',
		'values',
		'update',
		'set',
		'delete',
	] as const;

	for (const method of chainMethods) {
		chain[method] = vi.fn(() => chain);
	}

	// .returning() terminates insert chains – pops from queue
	chain['returning'] = vi.fn(() => Promise.resolve(queue.shift() ?? []));

	// transaction(cb) invokes the callback with the SAME chain so its queue
	// serves the in-transaction queries (locked gift select → count → insert).
	chain['transaction'] = vi.fn((cb: (tx: unknown) => unknown) => cb(chain));

	// Make the chain awaitable – each top-level await pops from queue
	// oxlint-disable-next-line no-thenable -- intentional: mock must be thenable to simulate Drizzle's await behavior
	chain['then'] = (resolve: (value: unknown) => unknown) => resolve(queue.shift() ?? []);

	return chain;
}

/** Shorthand: single-result chain (the common case). */
function createChain(returnValue: unknown[] = []) {
	return createMultiQueryChain(returnValue);
}

/** Fake wishlist row for an active (non-archived) list whose linked recipient is OWNER_ID. */
function makeActiveWishlistRow() {
	return {
		gift: {
			id: GIFT_ID,
			wishlistId: WISHLIST_ID,
			name: GIFT_NAME,
			quantity: 5,
			deletedAt: null,
		},
		wishlist: {
			id: WISHLIST_ID,
			recipientUserId: OWNER_ID,
			title: 'Narozeniny',
			shortId: WISHLIST_SHORT_ID,
			status: 'active',
			deletedAt: null,
		},
	};
}

// ── reserveGift ───────────────────────────────────────────────────────────────

describe('getReservationLedgerForWishlist (issue #214)', () => {
	const wishlistRow = makeActiveWishlistRow().wishlist;
	const signedInRow = {
		id: RESERVATION_ID,
		giftId: GIFT_ID,
		quantity: 2,
		userId: VISITOR_ID,
		anonymousName: null,
		gifterName: 'Petr Svoboda',
		createdAt: new Date('2024-01-01'),
	};
	const guestRow = {
		id: 'reservation-2',
		giftId: 'gift-2',
		quantity: 1,
		userId: null,
		anonymousName: 'Babička',
		gifterName: null,
		createdAt: new Date('2024-01-02'),
	};

	beforeEach(() => vi.resetAllMocks());

	it('returns no reservation data to recipients without querying the ledger', async () => {
		const database = createMultiQueryChain([wishlistRow]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		const result = (await (getReservationLedgerForWishlist as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeOwnerUser),
			WISHLIST_SHORT_ID,
		)) as { reservationsByGiftId: Record<string, unknown[]>; role: string };
		expect(result).toEqual({ reservationsByGiftId: {}, role: 'recipient' });
		expect(database['innerJoin']).not.toHaveBeenCalled();
	});

	it('returns no reservation data to unauthorized visitors', async () => {
		const database = createMultiQueryChain([wishlistRow]);
		const roleDb = createChain([]);
		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(roleDb as unknown as ReturnType<typeof getDb>);
		const result = (await (getReservationLedgerForWishlist as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			WISHLIST_SHORT_ID,
		)) as { reservationsByGiftId: Record<string, unknown[]> };
		expect(result.reservationsByGiftId).toEqual({});
		expect(database['innerJoin']).not.toHaveBeenCalled();
	});

	it('loads one joined ledger and groups rows by gift for a správce', async () => {
		const database = createMultiQueryChain([wishlistRow], [signedInRow, guestRow]);
		const roleDb = createChain([{ id: 'mod-assignment-1' }]);
		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(roleDb as unknown as ReturnType<typeof getDb>);
		const result = (await (getReservationLedgerForWishlist as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			WISHLIST_SHORT_ID,
		)) as { reservationsByGiftId: Record<string, Record<string, unknown>[]> };
		expect(result.reservationsByGiftId[GIFT_ID]).toEqual([
			expect.objectContaining({
				id: RESERVATION_ID,
				displayName: 'Petr Svoboda',
				releasable: false,
			}),
		]);
		expect(result.reservationsByGiftId['gift-2']).toEqual([
			expect.objectContaining({
				id: 'reservation-2',
				displayName: 'Babička',
				releasable: true,
			}),
		]);
		expect(database['innerJoin']).toHaveBeenCalledTimes(1);
		expect(database['leftJoin']).toHaveBeenCalledTimes(1);
	});

	it('lets an administrator release every row but omits their own reservation', async () => {
		const ownRow = { ...signedInRow, id: 'own', userId: ADMIN_ID };
		const database = createMultiQueryChain([wishlistRow], [signedInRow, guestRow, ownRow]);
		const roleDb = createChain([]);
		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(roleDb as unknown as ReturnType<typeof getDb>);
		const result = (await (getReservationLedgerForWishlist as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			WISHLIST_SHORT_ID,
		)) as { reservationsByGiftId: Record<string, Record<string, unknown>[]> };
		expect(Object.values(result.reservationsByGiftId).flat()).toEqual([
			expect.objectContaining({ id: RESERVATION_ID, releasable: true }),
			expect.objectContaining({ id: 'reservation-2', releasable: true }),
		]);
	});
});

// ── getMyReservationsForGift ──────────────────────────────────────────────────

describe('getMyReservationsForGift', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('anonymous user gets empty array without hitting the DB', async () => {
		const result = await (getMyReservationsForGift as (...args: unknown[]) => unknown)(
			null,
			GIFT_ID,
		);

		expect(result).toEqual([]);
		expect(mockGetDb).not.toHaveBeenCalled();
	});

	it('authenticated user gets their own reservations', async () => {
		const ownReservations = [
			{ id: RESERVATION_ID, quantity: 2, createdAt: new Date('2024-01-01') },
		];
		const reservationsChain = createChain(ownReservations);
		mockGetDb.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = await (getMyReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			GIFT_ID,
		);

		expect(result).toEqual(ownReservations);
	});

	it('authenticated user with no reservations gets empty array', async () => {
		const reservationsChain = createChain([]);
		mockGetDb.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = await (getMyReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			GIFT_ID,
		);

		expect(result).toEqual([]);
	});
});

// ── Statement budgets (issue #108, REQ-7) ─────────────────────────────────────

describe('statement budgets (issue #108, REQ-7)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('reserveGift (no likers/followers to notify) stays within 6 statements', async () => {
		// Call #1: `database` – tx queue: locked gift, count, insert; then likers +
		// followers pop empty defaults, so both notification dispatches early-return.
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		// Call #2: getGiftWithWishlist query
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await (reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
			giftId: GIFT_ID,
			quantity: 1,
		});

		const chains = [database, wishlistDb] as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>[];
		const statements = chains
			.flatMap((chain) =>
				['select', 'insert', 'update', 'delete'].map(
					(method) => chain[method]!.mock.calls.length,
				),
			)
			.reduce((sum, count) => sum + count, 0);

		// gift+wishlist lookup, locked gift, active count, insert, likers, followers —
		// the gift-list refresh rides back single-flight and email work is backgrounded.
		expect(statements).toBeLessThanOrEqual(6);
	});
});
