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

const { fetchGoogleSheetCsv } = await import('./import.remote.js');

// The mocked guardedCommand returns the raw (authContext, arg) handler; cast to it.
type FetchHandler = (authContext: { user: { id: string } }, link: string) => Promise<string>;
const callFetch = fetchGoogleSheetCsv as unknown as FetchHandler;

const OWNER_ID = 'user-owner';

const AUTH = { user: { id: OWNER_ID }, session: {} };

/** The array passed to the gift `.insert(...).values([...])` call (rows carry `links`). */

/** Ranked priority-level ids the resolver maps to: index 0 = high, index 1 = medium. */

/** Whether the command opened a DB transaction (atomicity guarantee). */

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
