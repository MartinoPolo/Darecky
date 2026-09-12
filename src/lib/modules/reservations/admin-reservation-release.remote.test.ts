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

import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { unreserveGift } from './reservations.remote.js';
import type { UnreserveInput } from './types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);
const mockGetRequestEvent = vi.mocked(getRequestEvent);
const mockDispatchNotification = vi.mocked(dispatchNotification);

/** Stub getRequestEvent so the anon-visitor helper reads `cookieValue` from the cookie. */
function mockAnonCookie(cookieValue: string | undefined) {
	mockGetRequestEvent.mockReturnValue({
		cookies: { get: () => cookieValue },
	} as unknown as ReturnType<typeof getRequestEvent>);
}

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';
const ADMIN_ID = 'user-admin';
const GIFT_ID = 'gift-1';
const GIFT_NAME = 'Kávovar';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc123';
const RESERVATION_ID = 'reservation-1';

/** Matches the mocked ADMIN_EMAILS — the app administrator (issue #213). */
const fakeAdminUser = {
	id: ADMIN_ID,
	name: 'Admin Adminová',
	email: 'admin@example.com',
} as unknown as User;
/** The app administrator signed in on a list where THEY are the obdarovaný (REQ-6). */
const fakeAdminRecipientUser = {
	id: OWNER_ID,
	name: 'Admin Adminová',
	email: 'admin@example.com',
} as unknown as User;
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

describe('unreserveGift — administrator release (issue #213)', () => {
	const validInput: UnreserveInput = { reservationId: RESERVATION_ID };

	/** A reservation held by a signed-in gifter (VISITOR_ID). */
	const signedInGifterReservation = {
		id: RESERVATION_ID,
		giftId: GIFT_ID,
		userId: VISITOR_ID,
		anonymousName: null,
		anonymousEmail: null,
		deletedAt: null,
	};

	/** A guest reservation, optionally with a contact address. */
	function guestReservation(anonymousEmail: string | null) {
		return {
			id: RESERVATION_ID,
			giftId: GIFT_ID,
			userId: null,
			anonymousName: 'Babička',
			anonymousEmail,
			anonymousVisitorId: 'anon-token-1',
			deletedAt: null,
		};
	}

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("an app administrator releases a signed-in gifter's reservation (REQ-1)", async () => {
		// Call #1: reservation SELECT + soft-delete UPDATE.
		const database = createMultiQueryChain([signedInGifterReservation], []);
		// Call #2: getGiftWithWishlist. Call #3: moderator lookup (admin manages nothing here).
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('an app administrator releases a guest reservation on a list they neither own nor moderate (REQ-1)', async () => {
		const database = createMultiQueryChain([guestReservation(null)], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]); // no moderator assignment → plain visitor role

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	// The rejection must cost NO extra query: a správce is indistinguishable from any other
	// non-administrator here, and the administrator check is a pure env read.
	it("a správce cannot release a signed-in gifter's reservation (REQ-2)", async () => {
		const database = createChain([signedInGifterReservation]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeModeratorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.RELEASE_REQUIRES_ADMIN });
		expect(mockGetDb).toHaveBeenCalledTimes(1);
	});

	it('the obdarovaný cannot release, even when they are the app administrator (REQ-6)', async () => {
		const database = createChain([signedInGifterReservation]);
		// The wishlist's linked recipient IS the caller.
		const giftDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeAdminRecipientUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.ACCESS_DENIED });
	});

	it('notifies the released signed-in gifter, naming the gift (REQ-9)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetUserIds: [VISITOR_ID],
				giftId: GIFT_ID,
				giftName: GIFT_NAME,
				actorId: ADMIN_ID,
			}),
		);
	});

	it('emails a released guest who left an address (REQ-9)', async () => {
		const database = createMultiQueryChain([guestReservation('babicka@example.com')], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetEmails: ['babicka@example.com'],
				giftName: GIFT_NAME,
			}),
		);
	});

	it('notifies nobody when the released guest left no address (REQ-9)', async () => {
		const database = createMultiQueryChain([guestReservation(null)], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('dispatches no notification when a gifter cancels their OWN reservation (REQ-9)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('records the cancelling user on a self-cancel (REQ-10)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(database['set']).toHaveBeenCalledWith(
			expect.objectContaining({ cancelledByUserId: VISITOR_ID }),
		);
	});

	it('records the administrator as the canceller on a release (REQ-10)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(database['set']).toHaveBeenCalledWith(
			expect.objectContaining({ cancelledByUserId: ADMIN_ID }),
		);
	});

	// A guest self-cancel has no account to record — the NULL is what makes an override
	// (`cancelledByUserId !== null && !== userId`) distinguishable from a self-cancel.
	it('leaves the canceller NULL on a guest self-cancel (REQ-10)', async () => {
		const database = createMultiQueryChain([guestReservation(null)], []);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie('anon-token-1');

		await (unreserveGift as (...args: unknown[]) => unknown)(null, validInput);

		expect(database['set']).toHaveBeenCalledWith(
			expect.objectContaining({ cancelledByUserId: null }),
		);
	});
});

// ── getReservationLedgerForWishlist ──────────────────────────────────────────
