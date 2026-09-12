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

import { verifyTurnstileToken } from '$lib/server/turnstile.js';

import { reserveGift } from './reservations.remote.js';
import type { ReserveGiftInput } from './types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);
const mockVerifyTurnstileToken = vi.mocked(verifyTurnstileToken);

/** Stub getRequestEvent so the anon-visitor helper reads `cookieValue` from the cookie. */

const OWNER_ID = 'user-owner';

const GIFT_ID = 'gift-1';
const GIFT_NAME = 'Kávovar';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc123';
const RESERVATION_ID = 'reservation-1';

const fakeOwnerUser = { id: OWNER_ID, email: 'owner@example.com' } as unknown as User;
/** Matches the mocked ADMIN_EMAILS — the app administrator (issue #213). */

/** The app administrator signed in on a list where THEY are the obdarovaný (REQ-6). */

const fakeVisitorUser = { id: 'user-visitor', email: 'visitor@example.com' } as unknown as User;
/** A visitor with a real display name — used to prove that name never reaches a dispatch payload. */

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

describe('reserveGift', () => {
	const validInput: ReserveGiftInput = {
		giftId: GIFT_ID,
		quantity: 1,
	};

	beforeEach(() => {
		vi.resetAllMocks();
		mockVerifyTurnstileToken.mockImplementation(async ({ token }) =>
			token == null || token === ''
				? { success: false, reason: 'missing' }
				: { success: true },
		);
	});

	// reserveGift now enforces capacity atomically inside database.transaction():
	//   - getDb() call #1 = `database`; used for database.transaction(cb). The mocked
	//     transaction invokes cb with the SAME chain, whose queue serves the in-tx
	//     queries in order: locked gift select (.for('update')) → active count → insert.
	//   - getDb() call #2 = getGiftWithWishlist's own getDb() (wishlist row).
	//   - getActiveReservedCount no longer calls getDb() – it runs on the passed tx.

	describe('reserveGift — authorization and validation', () => {
		it('linked recipient cannot reserve their own gift – throws 403', async () => {
			// Call #1: `database` – transaction never reached (throws on pre-check)
			const database = createChain([]);
			// Call #2: wishlist lookup – recipientUserId matches the caller
			const wishlistDb = createChain([makeActiveWishlistRow()]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(
					makeAuthContext(fakeOwnerUser),
					validInput,
				),
			).rejects.toMatchObject({ status: 403 });
		});

		it('cannot reserve on an archived wishlist – throws 400', async () => {
			const archivedRow = {
				...makeActiveWishlistRow(),
				wishlist: { ...makeActiveWishlistRow().wishlist, status: 'archived' },
			};
			const database = createChain([]);
			const wishlistDb = createChain([archivedRow]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(
					makeAuthContext(fakeVisitorUser),
					validInput,
				),
			).rejects.toMatchObject({ status: 400 });
		});

		it('anonymous user without a name – throws 400', async () => {
			const database = createChain([]);
			const wishlistDb = createChain([makeActiveWishlistRow()]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(null, {
					...validInput,
					anonymousName: '',
					turnstileToken: 'valid-token',
				}),
			).rejects.toMatchObject({ status: 400 });
		});

		it('anonymous user with only whitespace name – throws 400', async () => {
			const database = createChain([]);
			const wishlistDb = createChain([makeActiveWishlistRow()]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(null, {
					...validInput,
					anonymousName: '   ',
					turnstileToken: 'valid-token',
				}),
			).rejects.toMatchObject({ status: 400 });
		});

		it('quantity less than 1 – throws 400', async () => {
			const database = createChain([]);
			const wishlistDb = createChain([makeActiveWishlistRow()]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
					...validInput,
					quantity: 0,
				}),
			).rejects.toMatchObject({ status: 400 });
		});

		it('over-reservation rejected – throws 400', async () => {
			// Gift has quantity 5, all 5 already reserved under the lock – available = 0.
			// Transaction queue: locked gift (quantity 5), count (5). Insert never reached.
			const database = createMultiQueryChain([{ quantity: 5 }], [{ totalQuantity: 5 }]);
			const wishlistDb = createChain([makeActiveWishlistRow()]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
					...validInput,
					quantity: 1,
				}),
			).rejects.toMatchObject({ status: 400 });
		});

		it('anonymous user with valid name can reserve – returns { id }', async () => {
			const database = createMultiQueryChain(
				[{ quantity: 5 }],
				[{ totalQuantity: 0 }],
				[{ id: RESERVATION_ID }],
			);
			const wishlistDb = createChain([makeActiveWishlistRow()]);

			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			const result = await (reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: 'Jan Novak',
				turnstileToken: 'valid-token',
			});

			expect(result).toEqual({ id: RESERVATION_ID });
			expect(mockVerifyTurnstileToken).toHaveBeenCalledWith({ token: 'valid-token' });
		});
	});

	// ── unreserveGift ─────────────────────────────────────────────────────────────
});
