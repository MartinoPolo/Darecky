import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
	command: vi.fn((...args: unknown[]) => args.at(-1)),
}));

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: process.env.DATABASE_URL },
}));

function exposeRemoteHandler(handler: (...args: unknown[]) => unknown) {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	singleFlightRefresh: vi.fn(),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		exposeRemoteHandler(handler),
	),
}));

vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({
	getGiftsByWishlistShortId: vi.fn(),
}));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategorySettingsRows: vi.fn(),
}));

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { importGifts } from './import.remote.js';
import type { ImportGiftsResult } from './import.remote.js';

const PREFIX = `test-import-race-${Date.now()}-`;
const USER_ID = `${PREFIX}user`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const SOURCE_URL = `https://www.shop.example/${PREFIX}gift?campaign=one`;

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().transaction(async (tx) => {
			await tx.select({ id: wishlist.id }).from(wishlist).limit(1);
			throw new ProbeRollback();
		});
		return true;
	} catch (caught) {
		if (caught instanceof ProbeRollback) {
			return true;
		}
		await closeDb().catch(() => undefined);
		return false;
	}
}

const DB_READY = await isDbUsable();

type ImportHandler = (
	authContext: { user: { id: string } },
	input: {
		wishlistId: string;
		gifts: Array<{
			name: string;
			links: Array<{ url: string }>;
			currency: 'CZK';
			priority: 'medium';
		}>;
	},
) => Promise<ImportGiftsResult>;

const callImportGifts = importGifts as unknown as ImportHandler;

describe.skipIf(!DB_READY)('import duplicate advisory race [real DB]', () => {
	beforeAll(async () => {
		await getDb()
			.insert(user)
			.values({
				id: USER_ID,
				name: 'Import race user',
				email: `${PREFIX}user@example.com`,
			});
		await getDb()
			.insert(wishlist)
			.values({
				id: WISHLIST_ID,
				shortId: `${PREFIX}short`,
				recipientUserId: USER_ID,
				recipientName: null,
				title: 'Import race wishlist',
				status: 'draft',
			});
	});

	afterAll(async () => {
		const database = getDb();
		await database.delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await database.delete(user).where(eq(user.id, USER_ID));
		await closeDb();
	});

	it('serializes simultaneous unacknowledged canonical duplicates so only one gift is created', async () => {
		const input = {
			wishlistId: WISHLIST_ID,
			gifts: [
				{
					name: `${PREFIX}gift`,
					links: [{ url: SOURCE_URL }],
					currency: 'CZK' as const,
					priority: 'medium' as const,
				},
			],
		};

		const results = await Promise.all([
			callImportGifts({ user: { id: USER_ID } }, input),
			callImportGifts({ user: { id: USER_ID } }, input),
		]);

		expect(results.map((result) => result.status).sort()).toEqual([
			'created',
			'duplicate-warning',
		]);
		expect(results.find((result) => result.status === 'duplicate-warning')).toEqual({
			status: 'duplicate-warning',
			duplicateIndexes: [0],
		});
		const rows = await getDb().select().from(gift).where(eq(gift.wishlistId, WISHLIST_ID));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.links).toEqual([{ url: SOURCE_URL }]);
	});
});
