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

import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db/index.js';

import { unreserveGift } from './reservations.remote.js';
import type { UnreserveInput } from './types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);
const mockGetRequestEvent = vi.mocked(getRequestEvent);

/** Stub getRequestEvent so the anon-visitor helper reads `cookieValue` from the cookie. */
function mockAnonCookie(cookieValue: string | undefined) {
	mockGetRequestEvent.mockReturnValue({
		cookies: { get: () => cookieValue },
	} as unknown as ReturnType<typeof getRequestEvent>);
}

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';

const GIFT_ID = 'gift-1';
const GIFT_NAME = 'Kávovar';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc123';
const RESERVATION_ID = 'reservation-1';

/** Matches the mocked ADMIN_EMAILS — the app administrator (issue #213). */

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

describe('unreserveGift', () => {
	const validInput: UnreserveInput = { reservationId: RESERVATION_ID };

	beforeEach(() => {
		vi.resetAllMocks();
	});

	// unreserveGift stores ONE `database` from getDb() (call #1) and reuses it for:
	//   - reservation SELECT (query 1 on database)
	//   - soft-delete UPDATE (final query on database)
	// For an anonymous reservation cancelled by an authenticated user, the handler also:
	//   - getGiftWithWishlist(): its own getDb() call (call #2) → joined gift+wishlist row
	//   - resolveWishlistRole(): if not the recipient, hasActiveModeratorAssignment()
	//     makes its own getDb() call (call #3) for the mod check.

	it('authenticated user can unreserve their own reservation – returns { success: true }', async () => {
		// Call #1: `database` – used for reservation SELECT then UPDATE
		// Queue: [reservation row array, [] for update]
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: VISITOR_ID, deletedAt: null }],
			[], // update result (unused)
		);

		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('authenticated user cannot unreserve someone else reservation – throws 403', async () => {
		// Reservation belongs to a different user – throws before any further queries
		const database = createChain([
			{ id: RESERVATION_ID, giftId: GIFT_ID, userId: 'other-user', deletedAt: null },
		]);

		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});

	it('anonymous visitor with the matching cookie can unreserve their own reservation', async () => {
		// Anonymous reservation whose anonymousVisitorId matches the visitor's cookie.
		const database = createMultiQueryChain(
			[
				{
					id: RESERVATION_ID,
					giftId: GIFT_ID,
					userId: null,
					anonymousVisitorId: 'anon-token-1',
					deletedAt: null,
				},
			],
			[], // update result (unused)
		);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie('anon-token-1');

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(null, validInput);

		expect(result).toEqual({ success: true });
	});

	it('anonymous visitor with a mismatched cookie cannot unreserve – throws 403', async () => {
		const database = createChain([
			{
				id: RESERVATION_ID,
				giftId: GIFT_ID,
				userId: null,
				anonymousVisitorId: 'anon-token-1',
				deletedAt: null,
			},
		]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie('a-different-token');

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(null, validInput),
		).rejects.toMatchObject({ status: 403 });
	});

	it('anonymous visitor without any cookie cannot unreserve – throws 403', async () => {
		const database = createChain([
			{
				id: RESERVATION_ID,
				giftId: GIFT_ID,
				userId: null,
				anonymousVisitorId: 'anon-token-1',
				deletedAt: null,
			},
		]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie(undefined);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(null, validInput),
		).rejects.toMatchObject({ status: 403 });
	});

	it('moderator can unreserve an anonymous reservation – returns { success: true }', async () => {
		// Call #1: `database` – reservation SELECT, then UPDATE.
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null }], // reservation
			[], // update (unused)
		);
		// Call #2: getGiftWithWishlist's own getDb() – joined gift+wishlist row (recipient ≠ mod)
		const giftDb = createChain([makeActiveWishlistRow()]);
		// Call #3: resolveWishlistRole → hasActiveModeratorAssignment's getDb() – assignment found
		const modDb = createChain([{ id: 'mod-assignment-1' }]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('non-moderator authenticated user cannot unreserve an anonymous reservation – throws 403', async () => {
		// Call #1: `database` – reservation SELECT (update never reached).
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null }], // reservation
		);
		// Call #2: getGiftWithWishlist's own getDb() – joined gift+wishlist row (recipient ≠ visitor)
		const giftDb = createChain([makeActiveWishlistRow()]);
		// Call #3: resolveWishlistRole → hasActiveModeratorAssignment's getDb() – no assignment
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});
});

// ── unreserveGift: administrator release override (issue #213) ────────────────

/**
 * Expected truths derive from issue #213's requirements, not from the implementation:
 *   REQ-1  an app administrator releases ANY reservation on ANY wishlist;
 *   REQ-2  a správce keeps guest-only reach — a signed-in gifter's row is rejected;
 *   REQ-6  the obdarovaný gets nothing, even when they are the administrator;
 *   REQ-9  the released gifter is notified; releasing one's OWN reservation notifies nobody;
 *   REQ-10 every cancellation path records who released it.
 */
