import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { DEFAULT_IMAGE_METADATA } from '$lib/modules/images/types.js';

// ── Suppress SvelteKit's remote-function validator injected by the Vite transform
vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// Cross-module queries referenced only for single-flight refreshes (issue #108);
// mocked so this suite does not load the other module's schema graph.
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({
	getGiftsByWishlistShortId: vi.fn(),
}));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategorySettingsRows: vi.fn(),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

// ── Mock drizzle-orm – used only as where-clause builders; no-ops are fine ──
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	asc: vi.fn((arg: unknown) => arg),
	inArray: vi.fn((...args: unknown[]) => args),
	sql: Object.assign(
		vi.fn(() => ({ as: vi.fn(() => ({})) })),
		{
			join: vi.fn(() => ({})),
		},
	),
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		name: 'gift.name',
		links: 'gift.links',
		sortOrder: 'gift.sortOrder',
		deletedAt: 'gift.deletedAt',
		categoryId: 'gift.categoryId',
	},
	giftCategory: {
		id: 'giftCategory.id',
		wishlistId: 'giftCategory.wishlistId',
		presetKey: 'giftCategory.presetKey',
		customLabel: 'giftCategory.customLabel',
		color: 'giftCategory.color',
		sortOrder: 'giftCategory.sortOrder',
		deletedAt: 'giftCategory.deletedAt',
	},
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		recipientUserId: 'wishlist.recipientUserId',
		recipientName: 'wishlist.recipientName',
		recipientIsModerator: 'wishlist.recipientIsModerator',
		status: 'wishlist.status',
		deletedAt: 'wishlist.deletedAt',
		sharedAt: 'wishlist.sharedAt',
	},
	priorityLevel: {
		id: 'priorityLevel.id',
		wishlistId: 'priorityLevel.wishlistId',
		label: 'priorityLevel.label',
		sortOrder: 'priorityLevel.sortOrder',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'moderatorAssignment.id',
		wishlistId: 'moderatorAssignment.wishlistId',
		userId: 'moderatorAssignment.userId',
		deletedAt: 'moderatorAssignment.deletedAt',
	},
}));

// ── DB mock helper – sequential `then` results, transaction + call tracking ──

interface MockDb {
	db: Record<string | symbol, unknown>;
	calls: { method: string; args: unknown[] }[];
	pushResult: (result: unknown[]) => void;
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const calls: { method: string; args: unknown[] }[] = [];
	const indexRef = { value: 0 };

	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[indexRef.value] ?? [];
					indexRef.value++;
					return (resolve: (value: unknown[]) => unknown) => resolve(result);
				}
				if (prop === 'transaction') {
					return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
						calls.push({ method: 'transaction', args: [] });
						return callback(chain);
					});
				}
				return vi.fn((...args: unknown[]) => {
					if (typeof prop === 'string') {
						calls.push({ method: prop, args });
					}
					return chain;
				});
			},
		},
	);

	return {
		db: chain,
		calls,
		pushResult: (result: unknown[]) => results.push(result),
		reset: () => {
			results.length = 0;
			calls.length = 0;
			indexRef.value = 0;
		},
	};
}

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

// ── Import the module under test (after all mocks are set up) ────────────────

const { importGifts } = await import('./import.remote.js');
const { singleFlightRefresh } = await import('$lib/server/remote.js');
const { getGiftCategorySettingsRows } =
	await import('$lib/modules/gift-categories/gift_category_queries.remote.js');

// The mocked guardedCommand returns the raw (authContext, arg) handler; cast to it.

type ImportGiftsHandler = (
	authContext: { user: { id: string } },
	input: {
		wishlistId: string;
		gifts: unknown[];
		categoryResolutions?: unknown[];
		acknowledgeDuplicates?: boolean;
	},
) => Promise<unknown>;
const callImportGifts = importGifts as unknown as ImportGiftsHandler;

const OWNER_ID = 'user-owner';
const MODERATOR_ID = 'user-moderator';
const WISHLIST_ID = 'wishlist-1';

const AUTH = { user: { id: OWNER_ID }, session: {} };

function makeWishlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: WISHLIST_ID,
		recipientUserId: OWNER_ID,
		recipientName: null,
		status: 'draft',
		deletedAt: null,
		...overrides,
	};
}

/** The array passed to the gift `.insert(...).values([...])` call (rows carry `links`). */
function giftInsertRows():
	| { name: string; sortOrder: number; links: unknown[]; priorityLevelId: string | null }[]
	| undefined {
	const valuesCall = mockDbInstance.calls.find(
		(call) =>
			call.method === 'values' &&
			Array.isArray(call.args[0]) &&
			(call.args[0] as Record<string, unknown>[])[0] !== undefined &&
			'links' in (call.args[0] as Record<string, unknown>[])[0],
	);
	return valuesCall?.args[0] as
		| { name: string; sortOrder: number; links: unknown[]; priorityLevelId: string | null }[]
		| undefined;
}

/** Ranked priority-level ids the resolver maps to: index 0 = high, index 1 = medium. */
const RANKED_LEVELS = [{ id: 'pl-high' }, { id: 'pl-medium' }];

/** Whether the command opened a DB transaction (atomicity guarantee). */
function transactionOpened(): boolean {
	return mockDbInstance.calls.some((call) => call.method === 'transaction');
}

const draftA = {
	name: 'Boty',
	description: null,
	links: [],
	price: null,
	currency: 'CZK',
	priority: 'medium',
};
const draftB = {
	name: 'Kniha',
	description: null,
	links: [],
	price: null,
	currency: 'CZK',
	priority: 'high',
};

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('importGifts — creation and normalization', () => {
	it('maps gift creation domain failures to the public SvelteKit status and message', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([]);

		await expect(
			callImportGifts(AUTH, { wishlistId: WISHLIST_ID, gifts: [draftA] }),
		).rejects.toMatchObject({
			status: 500,
			message: SERVER_ERROR.FAILED_TO_CREATE_GIFT,
		});
	});

	it('appends gifts atomically with sequential sortOrder continuing from the current max', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]); // verifyOwnerOrModerator: wishlist (owner)
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS); // ranked priority levels
		mockDbInstance.pushResult([makeWishlistRow()]); // service wishlist lock
		mockDbInstance.pushResult([{ maxSort: 4 }]); // max sortOrder
		mockDbInstance.pushResult([
			{ id: 'g5', sortOrder: 5 },
			{ id: 'g6', sortOrder: 6 },
		]); // insert returning

		const result = await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [draftA, draftB],
		});

		expect(transactionOpened()).toBe(true);
		const rows = giftInsertRows();
		expect(rows).toBeDefined();
		expect(rows!.map((r) => r.sortOrder)).toEqual([5, 6]);
		expect(rows!.map((r) => r.name)).toEqual(['Boty', 'Kniha']);
		// draftA = medium → rank 1, draftB = high → rank 0.
		expect(rows!.map((r) => r.priorityLevelId)).toEqual(['pl-medium', 'pl-high']);
		expect(result).toMatchObject({ status: 'created', gifts: [{ id: 'g5' }, { id: 'g6' }] });
		expect(singleFlightRefresh).toHaveBeenCalledWith(getGiftCategorySettingsRows, WISHLIST_ID);
	});

	it('starts sortOrder at 0 for an empty wishlist (COALESCE -1)', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'g1', sortOrder: 0 }]);

		await callImportGifts(AUTH, { wishlistId: WISHLIST_ID, gifts: [draftA] });

		expect(giftInsertRows()!.map((r) => r.sortOrder)).toEqual([0]);
	});

	it('lets a moderator append gifts', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ recipientUserId: 'someone-else' })]); // not the recipient
		mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]); // moderator check
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([makeWishlistRow({ recipientUserId: 'someone-else' })]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'g1', sortOrder: 0 }]);

		const result = await callImportGifts(
			{ user: { id: MODERATOR_ID } },
			{ wishlistId: WISHLIST_ID, gifts: [draftA] },
		);

		expect(result).toMatchObject({ status: 'created', gifts: [{ id: 'g1' }] });
	});

	it('normalizes links, dropping non-http(s) URLs on insert', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([]); // pre-commit duplicate advisory
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'g1', sortOrder: 0 }]);

		await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [
				{
					...draftA,
					links: [
						{ url: ' javascript://example.com/%0Aalert(1)' },
						{ url: 'https://example.com/ok' },
					],
				},
			],
		});

		expect(giftInsertRows()![0].links).toEqual([{ url: 'https://example.com/ok' }]);
	});

	it('persists reviewed image URL and quantity through the shared creation service', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'g1', sortOrder: 0 }]);

		await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [
				{
					...draftA,
					imageUrl: 'https://images.example.test/gift.jpg',
					quantity: 4,
				},
			],
		});

		expect(giftInsertRows()![0]).toMatchObject({
			imageUrl: 'https://images.example.test/gift.jpg',
			imageKey: null,
			imageMeta: DEFAULT_IMAGE_METADATA,
			quantity: 4,
		});
	});
});
