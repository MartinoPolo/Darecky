import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { User, Session } from 'better-auth';

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
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { reserveGift } from './reservations.remote.js';
import type { ReserveGiftInput } from './types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);
const mockVerifyTurnstileToken = vi.mocked(verifyTurnstileToken);
const mockDispatchNotification = vi.mocked(dispatchNotification);

/** Stub getRequestEvent so the anon-visitor helper reads `cookieValue` from the cookie. */

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';

const GIFT_ID = 'gift-1';
const GIFT_NAME = 'Kávovar';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc123';
const RESERVATION_ID = 'reservation-1';

/** Matches the mocked ADMIN_EMAILS — the app administrator (issue #213). */

/** The app administrator signed in on a list where THEY are the obdarovaný (REQ-6). */

const fakeVisitorUser = { id: VISITOR_ID, email: 'visitor@example.com' } as unknown as User;
/** A visitor with a real display name — used to prove that name never reaches a dispatch payload. */
const fakeNamedVisitorUser = {
	id: VISITOR_ID,
	name: 'Petr Svoboda',
	email: 'visitor@example.com',
} as unknown as User;

const fakeSession = { id: 'session-1', userId: OWNER_ID } as unknown as Session;

function makeAuthContext(user: User) {
	return { user, session: fakeSession };
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

	it('authenticated visitor can reserve a gift – returns { id }', async () => {
		// Call #1: `database` – transaction queue: locked gift, count, insert.returning()
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

		const result = await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(result).toEqual({ id: RESERVATION_ID });
		expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
	});

	// Reserver identity is personal data (issue #198): the GIFT_RESERVED / LIKED_GIFT_RESERVED
	// dispatches must never carry the reserving user's name, only the server-side actorId.
	it("dispatches GIFT_RESERVED and LIKED_GIFT_RESERVED without actorName and never leaks the reserver's account name", async () => {
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeNamedVisitorUser),
			validInput,
		);

		expect(mockDispatchNotification).toHaveBeenCalledTimes(2);
		for (const [payload] of mockDispatchNotification.mock.calls) {
			expect(payload.actorName).toBeUndefined();
			expect(payload.actorId).toBe(VISITOR_ID);
		}
		expect(JSON.stringify(mockDispatchNotification.mock.calls)).not.toContain('Petr Svoboda');
	});

	it('anonymous reservation rejects a missing Turnstile token before DB work', async () => {
		mockVerifyTurnstileToken.mockResolvedValue({ success: false, reason: 'missing' });

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: 'Jan Novak',
			}),
		).rejects.toMatchObject({ status: 400, message: SERVER_ERROR.TURNSTILE_REQUIRED });
		expect(mockGetDb).not.toHaveBeenCalled();
	});

	// A present-but-bad token is a positive bot signal → reject before any DB work.
	it.each([
		['invalid', 403, SERVER_ERROR.TURNSTILE_INVALID],
		['expired_or_replayed', 403, SERVER_ERROR.TURNSTILE_EXPIRED_OR_REPLAYED],
	] as const)(
		'anonymous reservation rejects %s Turnstile verification before DB work',
		async (reason, status, message) => {
			mockVerifyTurnstileToken.mockResolvedValue({ success: false, reason });

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(null, {
					...validInput,
					anonymousName: 'Jan Novak',
					turnstileToken: 'rejected-token',
				}),
			).rejects.toMatchObject({ status, message });
			expect(mockGetDb).not.toHaveBeenCalled();
		},
	);

	// The check could not RUN (secret unconfigured, or Siteverify unreachable) — an
	// operational failure, not a bot signal. Fail open: allow the reservation but log it,
	// so a Turnstile outage/misconfig never takes guest reservation fully offline.
	it.each(['configuration', 'unavailable'] as const)(
		'anonymous reservation fails open (proceeds + logs) when Turnstile cannot run: %s',
		async (reason) => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			mockVerifyTurnstileToken.mockResolvedValue({ success: false, reason });

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
				turnstileToken: 'unverifiable-token',
			});

			expect(result).toEqual({ id: RESERVATION_ID });
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(reason));
			warnSpy.mockRestore();
		},
	);

	// CI-level regression guard for the atomic structure. The real proof that
	// concurrent reservations cannot overbook lives in reservations.race.test.ts
	// (real DB) – but those skip in CI, so this asserts the transaction + row lock
	// are still present, catching their accidental removal.
	it('capacity check runs inside a transaction that locks the gift row (FOR UPDATE)', async () => {
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		const txChain = database as unknown as Record<string, ReturnType<typeof vi.fn>>;

		// The capacity check + insert run inside database.transaction(...).
		expect(txChain['transaction']).toHaveBeenCalledTimes(1);
		// The gift row is locked with FOR UPDATE so concurrent reservations serialize.
		expect(txChain['for']).toHaveBeenCalledWith('update');
	});
});
