import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RECIPIENT_KIND } from '$lib/modules/wishlists/types.js';

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

const { createWishlistFromImport } = await import('./import.remote.js');

// The mocked guardedCommand returns the raw (authContext, arg) handler; cast to it.

type CreateFromImportHandler = (
	authContext: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<unknown>;
const callCreateFromImport = createWishlistFromImport as unknown as CreateFromImportHandler;

const OWNER_ID = 'user-owner';

const AUTH = { user: { id: OWNER_ID }, session: {} };

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
