import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { User, Session } from 'better-auth';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────
//
// This file exercises reserveGift against a REAL Postgres instance so it can
// model genuine competing reservations and prove the FOR UPDATE lock prevents
// overbooking. It deliberately does NOT mock the DB layer or drizzle-orm.
//
// The suite runs only against an explicitly local DATABASE_URL; remote and production
// databases are never valid race-test targets.

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

const HAS_DB = isLocalDatabaseUrl(databaseUrl);

// getRequestEvent throws (no request context in tests) so getDb() falls back to
// env.DATABASE_URL.
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: process.env.DATABASE_URL },
}));

vi.mock('$lib/server/turnstile.js', () => ({
	verifyTurnstileToken: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

/**
 * Wrap a handler so it satisfies SvelteKit's init_remote_functions validator
 * while remaining callable as a plain function in tests.
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

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { getDb, closeDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { reserveGift } from './reservations.remote.js';

// ── Test fixtures ───────────────────────────────────────────────────────────────

const PREFIX = 'test-race-';
const OWNER_ID = `${PREFIX}owner`;
const VISITOR_ID = `${PREFIX}visitor`;
const WISHLIST_ID = `${PREFIX}wishlist`;

const fakeVisitorUser = { id: VISITOR_ID, email: 'visitor@example.com' } as unknown as User;
const fakeSession = { id: `${PREFIX}session`, userId: VISITOR_ID } as unknown as Session;
const visitorCtx = { user: fakeVisitorUser, session: fakeSession };

const reserve = reserveGift as (...args: unknown[]) => Promise<{ id: string }>;

let giftCounter = 0;

async function createGift(quantity: number): Promise<string> {
	const database = getDb();
	const giftId = `${PREFIX}gift-${Date.now()}-${giftCounter++}`;
	await database.insert(gift).values({
		id: giftId,
		wishlistId: WISHLIST_ID,
		name: 'Race gift',
		quantity,
	});
	return giftId;
}

async function activeReservedSum(giftId: string): Promise<number> {
	const database = getDb();
	const rows = await database
		.select({ total: sql<number>`COALESCE(SUM(${reservation.quantity}), 0)` })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)));
	return Number(rows[0]?.total ?? 0);
}

/**
 * A local DATABASE_URL alone is not enough: its schema must match the current code.
 * Probe it once up front so an unreachable or unmigrated DB skips gracefully instead of hard-failing
 * in beforeAll. Only skips on schema/connection problems – genuine logic failures
 * inside the tests still surface.
 */
class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!HAS_DB) {
		return false;
	}
	try {
		const database = getDb();
		// Round-trip an insert (rolled back) so any schema drift – e.g. a column the
		// code declares but the live DB lacks – is detected, not just table presence.
		await database.transaction(async (tx) => {
			await tx
				.insert(user)
				.values({
					id: `${PREFIX}probe`,
					name: 'probe',
					email: `${PREFIX}probe@example.com`,
				})
				.onConflictDoNothing();
			// Abort: never persist the probe row.
			throw new ProbeRollback();
		});
		return true;
	} catch (err) {
		if (err instanceof ProbeRollback) {
			return true;
		}
		await closeDb().catch(() => undefined);
		return false;
	}
}

const DB_READY = await isDbUsable();

// Concurrency model: getDb() returns a postgres-js client with a connection pool
// (default max 10), so the two reservations below run on separate connections and
// genuinely contend on the gift row lock. The assertions are requirement-level
// (exactly one reservation may fit; SUM never exceeds capacity) and hold regardless
// of scheduling – without the FOR UPDATE lock the partial-quantity case overbooks
// (verified: it fails against the pre-fix non-atomic implementation).
describe.skipIf(!DB_READY)('reserveGift overbooking race [real DB]', () => {
	beforeAll(async () => {
		const database = getDb();
		await database
			.insert(user)
			.values([
				{ id: OWNER_ID, name: 'Race Owner', email: `${OWNER_ID}@example.com` },
				{ id: VISITOR_ID, name: 'Race Visitor', email: `${VISITOR_ID}@example.com` },
			])
			.onConflictDoNothing();
		await database
			.insert(wishlist)
			.values({
				id: WISHLIST_ID,
				shortId: `${PREFIX}short`,
				recipientUserId: OWNER_ID,
				recipientName: null,
				title: 'Race wishlist',
				status: 'active',
			})
			.onConflictDoNothing();
	});

	let giftId: string;

	beforeEach(() => {
		giftCounter = 0;
	});

	afterEach(async () => {
		const database = getDb();
		if (giftId !== undefined) {
			await database.delete(reservation).where(eq(reservation.giftId, giftId));
			await database.delete(gift).where(eq(gift.id, giftId));
		}
	});

	afterAll(async () => {
		const database = getDb();
		await database.delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await database.delete(user).where(eq(user.id, OWNER_ID));
		await database.delete(user).where(eq(user.id, VISITOR_ID));
		await closeDb();
	});

	it('two concurrent reservations for the last unit → exactly one succeeds', async () => {
		giftId = await createGift(1);

		const results = await Promise.allSettled([
			reserve(visitorCtx, { giftId, quantity: 1 }),
			reserve(null, {
				giftId,
				quantity: 1,
				anonymousName: 'Anon',
				turnstileToken: 'valid-test-token',
			}),
		]);

		const fulfilled = results.filter((r) => r.status === 'fulfilled');
		const rejected = results.filter((r) => r.status === 'rejected');

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);

		const rejectedReason = (rejected[0] as PromiseRejectedResult).reason as Error;
		expect(rejectedReason.message).toContain(SERVER_ERROR.NOT_ENOUGH_AVAILABLE);

		expect(await activeReservedSum(giftId)).toBe(1);
	});

	it('partial-quantity reservations cannot exceed remaining capacity', async () => {
		giftId = await createGift(3);

		const results = await Promise.allSettled([
			reserve(visitorCtx, { giftId, quantity: 2 }),
			reserve(null, {
				giftId,
				quantity: 2,
				anonymousName: 'Anon',
				turnstileToken: 'valid-test-token',
			}),
		]);

		const fulfilled = results.filter((r) => r.status === 'fulfilled');

		// Only one request of quantity 2 can fit (3 capacity, the other would need 4).
		expect(fulfilled).toHaveLength(1);

		const sum = await activeReservedSum(giftId);
		expect(sum).toBeLessThanOrEqual(3);
		expect(sum).toBe(2);
	});
});
