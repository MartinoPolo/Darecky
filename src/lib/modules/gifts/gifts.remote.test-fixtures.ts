import { vi, beforeEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

// ── Suppress SvelteKit's remote-function validator injected by the Vite transform
vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

// ── Mock $app/server to prevent SvelteKit remote-function validation ─────────
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

// ── Mock remote wrappers – extract handlers directly ────────────────────────
// The Vite transform injects `fn.__.id = ...` for every export after calling
// init_remote_functions, so each returned handler must carry a `__` object.
function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedQueryWithArgs: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// ── Mock SvelteKit error so it throws with a .status property ───────────────
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

// ── Mock drizzle-orm – used only as where-clause builders; capture tagged SQL so CASE updates can be asserted. ──
function mockSql(strings: TemplateStringsArray, ...values: unknown[]) {
	return {
		kind: 'sql',
		strings: Array.from(strings),
		values,
		as: vi.fn(() => ({})),
	};
}

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	inArray: vi.fn((...args: unknown[]) => args),
	sql: Object.assign(vi.fn(mockSql), {
		join: vi.fn((parts: unknown[], separator: unknown) => ({
			kind: 'sql.join',
			parts,
			separator,
		})),
	}),
	count: vi.fn(),
}));

// ── Mock schema imports – column references used in queries ─────────────────
vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		name: 'gift.name',
		description: 'gift.description',
		descriptionAppends: 'gift.descriptionAppends',
		editedAfterShareAt: 'gift.editedAfterShareAt',
		preEditShareSnapshot: 'gift.preEditShareSnapshot',
		links: 'gift.links',
		price: 'gift.price',
		priceMax: 'gift.priceMax',
		currency: 'gift.currency',
		imageUrl: 'gift.imageUrl',
		imageKey: 'gift.imageKey',
		imageMeta: 'gift.imageMeta',
		quantity: 'gift.quantity',
		sortOrder: 'gift.sortOrder',
		received: 'gift.received',
		createdAt: 'gift.createdAt',
		deletedAt: 'gift.deletedAt',
		priorityLevelId: 'gift.priorityLevelId',
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
	reservation: {
		id: 'reservation.id',
		giftId: 'reservation.giftId',
		userId: 'reservation.userId',
		anonymousName: 'reservation.anonymousName',
		anonymousEmail: 'reservation.anonymousEmail',
		quantity: 'reservation.quantity',
		deletedAt: 'reservation.deletedAt',
		createdAt: 'reservation.createdAt',
	},
	giftLike: {
		id: 'giftLike.id',
		giftId: 'giftLike.giftId',
		deletedAt: 'giftLike.deletedAt',
	},
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		shortId: 'wishlist.shortId',
		recipientUserId: 'wishlist.recipientUserId',
		recipientName: 'wishlist.recipientName',
		recipientIsModerator: 'wishlist.recipientIsModerator',
		sharedAt: 'wishlist.sharedAt',
		status: 'wishlist.status',
		deletedAt: 'wishlist.deletedAt',
	},
	priorityLevel: {
		id: 'priorityLevel.id',
		wishlistId: 'priorityLevel.wishlistId',
		label: 'priorityLevel.label',
		sortOrder: 'priorityLevel.sortOrder',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: {
		id: 'user.id',
		name: 'user.name',
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

// ── DB mock helper ───────────────────────────────────────────────────────────

interface MockDb {
	db: unknown;
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

// ── Mock getDb ───────────────────────────────────────────────────────────────

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

// ── Mock R2 storage cleanup (issue #107, REQ-6) ──────────────────────────────

vi.mock('$lib/server/storage/r2.js', () => ({
	deleteObjectsBestEffort: vi.fn(() => Promise.resolve()),
}));
vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategorySettingsRows: vi.fn(),
}));
vi.mock('./gift_creation_service.js', () => ({
	appendGifts: vi.fn(),
}));
vi.mock('./gift_bulk_copy.js', () => ({
	BulkCopyGiftsInputSchema: {},
	copyGifts: vi.fn(),
}));

// ── Import the module under test (after all mocks are set up) ────────────────

import {
	getGiftsByWishlistShortId,
	createGift,
	updateGift,
	deleteGift,
	reorderGifts,
	markGiftReceived,
	bulkUpdateGifts,
	bulkCopyGifts,
} from './gifts.remote.js';
import type { GiftForRecipient, GiftForVisitor } from './types.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { singleFlightRefresh } from '$lib/server/remote.js';
import { getGiftCategorySettingsRows } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
import { appendGifts } from './gift_creation_service.js';
import { copyGifts } from './gift_bulk_copy.js';
import { toPreShareGiftSnapshot, type PreShareGiftSnapshot } from './gift_post_share.js';

const mockDeleteObjects = vi.mocked(deleteObjectsBestEffort);
const mockAppendGifts = vi.mocked(appendGifts);
const mockCopyGifts = vi.mocked(copyGifts);
// The Vite remote-function transform does not preserve direct imported re-exports from
// fixture modules. Initialized local aliases retain the exact mocked bindings.
const serverErrorFixture = SERVER_ERROR;
const singleFlightRefreshFixture = vi.mocked(singleFlightRefresh);
const getGiftCategorySettingsRowsFixture = vi.mocked(getGiftCategorySettingsRows);
const dispatchNotificationFixture = vi.mocked(dispatchNotification);
const toPreShareGiftSnapshotFixture = toPreShareGiftSnapshot;

// ── Test data factories ───────────────────────────────────────────────────────

// The linked recipient: the authed user whose id matches the wishlist's recipientUserId.
const RECIPIENT_ID = 'user-recipient';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc12345';
const GIFT_ID = 'gift-1';

const SHARED_AT = new Date('2024-01-10T00:00:00Z');
const BEFORE_SHARING = new Date('2024-01-05T00:00:00Z');
const AFTER_SHARING = new Date('2024-01-15T00:00:00Z');

// Default row is a self-recipient list: the recipient is the linked RECIPIENT_ID user.
// Override `recipientUserId: null` (+ a moderatorAssignment result) for a for-someone /
// visitor-manager scenario so the resolved role comes out as visitor/moderator.
function makeWishlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: WISHLIST_ID,
		shortId: WISHLIST_SHORT_ID,
		recipientUserId: RECIPIENT_ID,
		recipientName: null,
		recipientIsModerator: false,
		sharedAt: null,
		status: 'draft',
		deletedAt: null,
		title: 'Test Wishlist',
		...overrides,
	};
}

function makeGiftRow(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> & PreShareGiftSnapshot {
	return {
		id: GIFT_ID,
		wishlistId: WISHLIST_ID,
		name: 'Test Gift',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		preEditShareSnapshot: null,
		links: [],
		price: null,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: AFTER_SHARING,
		deletedAt: null,
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryId: null,
		categoryPresetKey: null,
		categoryCustomLabel: null,
		categoryColor: null,
		categorySortOrder: null,
		...overrides,
	};
}

function makeRecipientAuthContext(): { user: { id: string } } {
	return { user: { id: RECIPIENT_ID } };
}

function makeVisitorAuthContext(): { user: { id: string } } {
	return { user: { id: VISITOR_ID } };
}

function makeModeratorAuthContext(): { user: { id: string } } {
	return { user: { id: MODERATOR_ID } };
}

// ── Typed handler aliases ─────────────────────────────────────────────────────

type GetGiftsHandler = (
	authContext: { user: { id: string } } | null,
	shortId: string,
) => Promise<{ role: string; gifts: unknown[] }>;

type GiftCommandHandler = (
	authContext: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<unknown>;

type DeleteGiftHandler = (authContext: { user: { id: string } }, giftId: string) => Promise<void>;
type ReorderGiftsHandler = (
	authContext: { user: { id: string } },
	items: { id: string; sortOrder: number }[],
) => Promise<void>;

type MarkReceivedHandler = (
	authContext: { user: { id: string } },
	input: { giftId: string; received: boolean },
) => Promise<unknown>;
type BulkUpdateHandler = (
	authContext: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<unknown>;

const callGetGifts = getGiftsByWishlistShortId as unknown as GetGiftsHandler;
const callCreateGift = createGift as unknown as GiftCommandHandler;
const callUpdateGift = updateGift as unknown as GiftCommandHandler;
const callDeleteGift = deleteGift as unknown as DeleteGiftHandler;
const callReorderGifts = reorderGifts as unknown as ReorderGiftsHandler;
const callMarkReceived = markGiftReceived as unknown as MarkReceivedHandler;
const callBulkUpdate = bulkUpdateGifts as unknown as BulkUpdateHandler;
const callBulkCopy = bulkCopyGifts as unknown as GiftCommandHandler;

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
	vi.mocked(dispatchNotification).mockImplementation(() => Promise.resolve());
});

export {
	serverErrorFixture,
	singleFlightRefreshFixture,
	getGiftCategorySettingsRowsFixture,
	dispatchNotificationFixture,
	toPreShareGiftSnapshotFixture,
	mockDbInstance,
	mockDeleteObjects,
	mockAppendGifts,
	mockCopyGifts,
	WISHLIST_ID,
	WISHLIST_SHORT_ID,
	GIFT_ID,
	SHARED_AT,
	BEFORE_SHARING,
	AFTER_SHARING,
	makeWishlistRow,
	makeGiftRow,
	makeRecipientAuthContext,
	makeVisitorAuthContext,
	makeModeratorAuthContext,
	callGetGifts,
	callCreateGift,
	callUpdateGift,
	callDeleteGift,
	callReorderGifts,
	callMarkReceived,
	callBulkUpdate,
	callBulkCopy,
};
export type { GiftForRecipient, GiftForVisitor, PreShareGiftSnapshot };
