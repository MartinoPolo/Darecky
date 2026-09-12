import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

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
const VISITOR_ID = 'user-visitor';

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

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('importGifts — validation and duplicate handling', () => {
	it('requires explicit category resolution and rejects before inserting any gift when missing', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);

		await expect(
			callImportGifts(AUTH, {
				wishlistId: WISHLIST_ID,
				gifts: [{ ...draftA, importedCategoryLabel: 'Outdoor', categoryId: null }],
			}),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.GIFT_CATEGORY_IMPORT_UNRESOLVED,
		});
		expect(giftInsertRows()).toBeUndefined();
		expect(transactionOpened()).toBe(true);
	});

	it('creates explicitly reviewed custom categories in the same append transaction', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([]); // active category conflict check
		mockDbInstance.pushResult([]); // historical custom-category palette count
		mockDbInstance.pushResult([{ maxSort: 0 }]); // next category sort order
		mockDbInstance.pushResult([
			{
				id: 'category-outdoor',
				wishlistId: WISHLIST_ID,
				presetKey: null,
				customLabel: 'Outdoor',
				color: '#0369A1',
				sortOrder: 1,
				deletedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: new Date('2024-01-01T00:00:00Z'),
			},
		]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'category-outdoor' }]);
		mockDbInstance.pushResult([{ id: 'g1', sortOrder: 0 }]);

		await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [{ ...draftA, importedCategoryLabel: 'Outdoor', categoryId: null }],
			categoryResolutions: [
				{ action: 'create-custom', sourceLabel: 'Outdoor', label: 'Outdoor' },
			],
		});

		expect(giftInsertRows()![0]).toMatchObject({ categoryId: 'category-outdoor' });
	});

	it('requires an explicit second acknowledgement before inserting canonical-link duplicates', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([
			{ id: 'existing', links: [{ url: 'https://www.example.com/item/?ref=old' }] },
		]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // retry advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([
			{ id: 'existing', links: [{ url: 'https://www.example.com/item/?ref=old' }] },
		]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: 0 }]);
		mockDbInstance.pushResult([{ id: 'new', sortOrder: 1 }]);

		const inputDraft = {
			...draftA,
			links: [{ url: 'https://example.com/item?ref=new#details' }],
		};
		const warning = await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [inputDraft],
		});
		expect(warning).toEqual({ status: 'duplicate-warning', duplicateIndexes: [0] });
		expect(transactionOpened()).toBe(true);
		expect(giftInsertRows()).toBeUndefined();
		expect(singleFlightRefresh).not.toHaveBeenCalled();
		const created = await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [inputDraft],
			acknowledgeDuplicates: true,
		});
		expect(created).toMatchObject({ status: 'created', gifts: [{ id: 'new' }] });
		expect(giftInsertRows()![0].links).toEqual(inputDraft.links);
	});

	it('appends an acknowledged canonical duplicate while preserving alternative links', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([]); // advisory wishlist lock
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([
			{ id: 'existing', links: [{ url: 'https://example.com/existing?ref=old' }] },
		]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([{ maxSort: 0 }]);
		mockDbInstance.pushResult([{ id: 'new', sortOrder: 1 }]);

		const inputDraft = {
			...draftA,
			links: [
				{ url: 'https://example.com/existing?ref=new' },
				{ url: 'https://example.com/alternative' },
			],
		};
		const result = await callImportGifts(AUTH, {
			wishlistId: WISHLIST_ID,
			gifts: [inputDraft],
			acknowledgeDuplicates: true,
		});

		expect(result).toMatchObject({ status: 'created', gifts: [{ id: 'new' }] });
		expect(transactionOpened()).toBe(true);
		expect(giftInsertRows()![0].links).toEqual(inputDraft.links);
	});

	it('throws 403 when the caller is neither recipient nor moderator', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ recipientUserId: 'someone-else' })]);
		mockDbInstance.pushResult([]); // moderator check empty

		await expect(
			callImportGifts(
				{ user: { id: VISITOR_ID } },
				{ wishlistId: WISHLIST_ID, gifts: [draftA] },
			),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.ACCESS_DENIED });
	});

	it('rejects appending to an archived wishlist', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

		await expect(
			callImportGifts(AUTH, { wishlistId: WISHLIST_ID, gifts: [draftA] }),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		});
	});

	it('throws 404 when the wishlist does not exist', async () => {
		mockDbInstance.pushResult([]); // wishlist lookup empty

		await expect(
			callImportGifts(AUTH, { wishlistId: 'ghost', gifts: [draftA] }),
		).rejects.toMatchObject({ status: 404, message: SERVER_ERROR.WISHLIST_NOT_FOUND });
	});

	it('returns [] and inserts nothing when the draft list is empty', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]); // auth check still runs

		const result = await callImportGifts(AUTH, { wishlistId: WISHLIST_ID, gifts: [] });

		expect(result).toEqual({ status: 'created', gifts: [] });
		expect(giftInsertRows()).toBeUndefined();
	});
});
