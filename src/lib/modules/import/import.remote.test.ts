import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { RECIPIENT_KIND } from '$lib/modules/wishlists/types.js';
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

const { fetchGoogleSheetCsv, importGifts, createWishlistFromImport } =
	await import('./import.remote.js');
const { singleFlightRefresh } = await import('$lib/server/remote.js');
const { getGiftCategorySettingsRows } =
	await import('$lib/modules/gift-categories/gift_category_queries.remote.js');

// The mocked guardedCommand returns the raw (authContext, arg) handler; cast to it.
type FetchHandler = (authContext: { user: { id: string } }, link: string) => Promise<string>;
const callFetch = fetchGoogleSheetCsv as unknown as FetchHandler;

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

type CreateFromImportHandler = (
	authContext: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<unknown>;
const callCreateFromImport = createWishlistFromImport as unknown as CreateFromImportHandler;

const OWNER_ID = 'user-owner';
const MODERATOR_ID = 'user-moderator';
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
const draftB = {
	name: 'Kniha',
	description: null,
	links: [],
	price: null,
	currency: 'CZK',
	priority: 'high',
};

function mockFetchResponse(options: {
	status?: number;
	contentType?: string | null;
	body?: string;
	contentLength?: string | null;
}): void {
	const headers = new Map<string, string>();
	if (options.contentType !== null && options.contentType !== undefined) {
		headers.set('content-type', options.contentType);
	}
	if (options.contentLength !== undefined && options.contentLength !== null) {
		headers.set('content-length', options.contentLength);
	}
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({
			status: options.status ?? 200,
			headers: { get: (key: string) => headers.get(key.toLowerCase()) ?? null },
			text: async () => options.body ?? '',
		})),
	);
}

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchGoogleSheetCsv', () => {
	it('returns CSV text for a valid sheet and fetches the pinned export URL', async () => {
		mockFetchResponse({ contentType: 'text/csv', body: 'Name,Link\nBoty,https://x.test' });
		const csv = await callFetch(
			AUTH,
			'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=7',
		);
		expect(csv).toBe('Name,Link\nBoty,https://x.test');
		const fetchMock = vi.mocked(globalThis.fetch);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][0]).toBe(
			'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=7',
		);
	});

	it('rejects an invalid / non-sheets link before fetching', async () => {
		mockFetchResponse({ contentType: 'text/csv', body: 'x' });
		await expect(
			callFetch(AUTH, 'https://evil.example.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_LINK_INVALID);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('returns a not-a-sheet error for a Google Docs link before fetching', async () => {
		mockFetchResponse({ contentType: 'text/csv', body: 'x' });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/document/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('maps a private sheet (HTML response) to a friendly typed error', async () => {
		mockFetchResponse({ contentType: 'text/html', body: '<html>sign in</html>' });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_PRIVATE);
	});

	it('maps a 500 response to a fetch-failed error', async () => {
		mockFetchResponse({ status: 500, contentType: null });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});

	it('maps a network failure to a fetch-failed error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			}),
		);
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});

	it('rejects an over-large response by declared content-length', async () => {
		mockFetchResponse({ contentType: 'text/csv', contentLength: '99999999', body: 'x' });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});

	it('rejects an over-large response by actual body length', async () => {
		const huge = 'a'.repeat(2_000_001);
		mockFetchResponse({ contentType: 'text/csv', body: huge });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});
});

describe('importGifts', () => {
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

describe('createWishlistFromImport', () => {
	/** Extract the single-object `.values(...)` call – the wishlist insert row. */
	function wishlistInsertValues(): Record<string, unknown> | undefined {
		return mockDbInstance.calls.find((c) => c.method === 'values' && !Array.isArray(c.args[0]))
			?.args[0] as Record<string, unknown> | undefined;
	}

	/** The moderator-assignment `.values({...})` row, if one was inserted (for-someone lists). */
	function moderatorAssignmentValues(): Record<string, unknown> | undefined {
		return mockDbInstance.calls.find(
			(c) =>
				c.method === 'values' &&
				!Array.isArray(c.args[0]) &&
				typeof c.args[0] === 'object' &&
				c.args[0] !== null &&
				'wishlistId' in (c.args[0] as Record<string, unknown>) &&
				'userId' in (c.args[0] as Record<string, unknown>),
		)?.args[0] as Record<string, unknown> | undefined;
	}

	it('self: creates a list linked to the creator, default priority levels, and gifts (sortOrder from 0)', async () => {
		const createdWishlist = {
			id: 'new-wl',
			recipientUserId: OWNER_ID,
			title: 'My List',
			shortId: 'sh',
		};
		mockDbInstance.pushResult([createdWishlist]); // insert wishlist returning
		mockDbInstance.pushResult([]); // insert priority levels
		mockDbInstance.pushResult(RANKED_LEVELS); // ranked priority levels
		mockDbInstance.pushResult([createdWishlist]); // service wishlist lock
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([
			{ id: 'g1', name: 'Boty' },
			{ id: 'g2', name: 'Kniha' },
		]); // insert gifts

		const result = await callCreateFromImport(AUTH, {
			recipientKind: RECIPIENT_KIND.self,
			title: 'My List',
			gifts: [draftA, draftB],
		});

		expect(result).toMatchObject({ id: 'new-wl', title: 'My List' });
		expect(transactionOpened()).toBe(true);

		// A self list links the creator as recipient; no free-text recipient name, no správce row.
		const wishlistValues = wishlistInsertValues();
		expect(wishlistValues).toBeDefined();
		expect(wishlistValues).toMatchObject({
			recipientUserId: OWNER_ID,
			recipientName: null,
			title: 'My List',
		});
		expect(moderatorAssignmentValues()).toBeUndefined();

		// Default priority levels inserted (array of rows with `label`).
		const priorityValues = mockDbInstance.calls.find(
			(c) =>
				c.method === 'values' &&
				Array.isArray(c.args[0]) &&
				'label' in ((c.args[0] as Record<string, unknown>[])[0] ?? {}),
		)?.args[0];
		expect(priorityValues).toBeDefined();

		// Gifts seeded with sequential sortOrder from 0, scoped to the new wishlist.
		const rows = giftInsertRows();
		expect(rows).toBeDefined();
		expect(rows!.map((r) => r.sortOrder)).toEqual([0, 1]);
		expect(rows!.map((r) => r.name)).toEqual(['Boty', 'Kniha']);
		// draftA = medium → rank 1, draftB = high → rank 0.
		expect(rows!.map((r) => r.priorityLevelId)).toEqual(['pl-medium', 'pl-high']);
	});

	it('other: stores a free-text recipient and makes the creator the first správce (moderator row)', async () => {
		const createdWishlist = { id: 'new-wl', recipientName: 'Babička', title: 'Pro babičku' };
		mockDbInstance.pushResult([createdWishlist]); // insert wishlist returning
		mockDbInstance.pushResult([]); // insert moderatorAssignment (creator = first správce)
		mockDbInstance.pushResult([]); // insert priority levels
		mockDbInstance.pushResult(RANKED_LEVELS); // ranked priority levels
		mockDbInstance.pushResult([createdWishlist]); // service wishlist lock
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'g1', name: 'Boty' }]); // insert gifts

		const result = await callCreateFromImport(AUTH, {
			recipientKind: RECIPIENT_KIND.other,
			recipientName: 'Babička',
			title: 'Pro babičku',
			gifts: [draftA],
		});

		expect(result).toMatchObject({ id: 'new-wl' });
		expect(transactionOpened()).toBe(true);

		// For-someone list: free-text recipient, no linked recipient account.
		const wishlistValues = wishlistInsertValues();
		expect(wishlistValues).toBeDefined();
		expect(wishlistValues).toMatchObject({
			recipientUserId: null,
			recipientName: 'Babička',
			title: 'Pro babičku',
		});

		// The creator is seeded as the first správce so the orphan list has a manager.
		const modRow = moderatorAssignmentValues();
		expect(modRow).toBeDefined();
		expect(modRow).toMatchObject({ wishlistId: 'new-wl', userId: OWNER_ID });

		// Gifts still seeded, scoped to the new wishlist.
		expect(giftInsertRows()!.map((r) => r.name)).toEqual(['Boty']);
	});

	it('defaults the theme to "default" when none is provided', async () => {
		mockDbInstance.pushResult([{ id: 'new-wl' }]);
		mockDbInstance.pushResult([]);

		await callCreateFromImport(AUTH, {
			recipientKind: RECIPIENT_KIND.self,
			title: 'My List',
			gifts: [],
		});

		const wishlistValues = wishlistInsertValues();
		expect(wishlistValues).toMatchObject({ theme: 'default' });
	});

	it('creates the wishlist and priority levels but no gifts when the draft list is empty', async () => {
		mockDbInstance.pushResult([{ id: 'new-wl', recipientUserId: OWNER_ID }]);
		mockDbInstance.pushResult([]); // priority levels

		const result = await callCreateFromImport(AUTH, {
			recipientKind: RECIPIENT_KIND.self,
			title: 'Empty',
			gifts: [],
		});

		expect(result).toMatchObject({ id: 'new-wl' });
		expect(giftInsertRows()).toBeUndefined();
	});

	it('normalizes seeded gift links', async () => {
		mockDbInstance.pushResult([{ id: 'new-wl', recipientUserId: OWNER_ID }]);
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult(RANKED_LEVELS);
		mockDbInstance.pushResult([
			{ id: 'new-wl', shortId: 'sh', title: 'My List', recipientUserId: OWNER_ID },
		]);
		mockDbInstance.pushResult([{ maxSort: -1 }]);
		mockDbInstance.pushResult([{ id: 'g1', name: 'Kniha' }]);

		await callCreateFromImport(AUTH, {
			recipientKind: RECIPIENT_KIND.self,
			title: 'My List',
			gifts: [{ ...draftB, links: [{ url: 'not a url' }, { url: 'https://example.com/x' }] }],
		});

		expect(giftInsertRows()![0].links).toEqual([{ url: 'https://example.com/x' }]);
	});
});
