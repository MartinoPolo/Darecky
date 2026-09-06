import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('gift category settings refresh dependencies', () => {
	it('refreshes category counts after creating a gift', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockAppendGifts.mockResolvedValueOnce([
			makeGiftRow({ categoryId: 'category-books' }),
		] as never);

		await callCreateGift(makeRecipientAuthContext(), {
			wishlistId: WISHLIST_ID,
			name: 'Book',
			categoryId: 'category-books',
		});

		expect(singleFlightRefresh).toHaveBeenCalledWith(getGiftCategorySettingsRows, WISHLIST_ID);
	});

	it('refreshes destination category counts after copying gifts', async () => {
		mockCopyGifts.mockResolvedValueOnce({
			created: [{ id: 'copied-gift' }],
			destinationShortId: 'destination-short-id',
		} as never);

		await callBulkCopy(makeRecipientAuthContext(), {
			sourceWishlistId: WISHLIST_ID,
			destinationWishlistId: 'destination-wishlist',
			giftIds: [GIFT_ID],
		});

		expect(singleFlightRefresh).toHaveBeenCalledWith(
			getGiftCategorySettingsRows,
			'destination-wishlist',
		);
	});
});

describe('bulkUpdateGifts presentation parity', () => {
	it('revalidates archived status inside the mutation transaction', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

		await expect(
			callBulkUpdate(makeRecipientAuthContext(), {
				wishlistId: WISHLIST_ID,
				giftIds: [GIFT_ID],
				action: 'priority',
				priorityLevelId: null,
			}),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		});
		expect(mockDbInstance.calls).toContainEqual({ method: 'transaction', args: [] });
		expect(mockDbInstance.calls.filter((call) => call.method === 'update')).toHaveLength(0);
	});

	it('revalidates a revoked manager assignment inside the mutation transaction', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ recipientUserId: null, status: 'active' })]);
		mockDbInstance.pushResult([]);

		await expect(
			callBulkUpdate(makeModeratorAuthContext(), {
				wishlistId: WISHLIST_ID,
				giftIds: [GIFT_ID],
				action: 'received',
				received: true,
			}),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.ACCESS_DENIED });
		expect(mockDbInstance.calls).toContainEqual({ method: 'transaction', args: [] });
		expect(mockDbInstance.calls.filter((call) => call.method === 'update')).toHaveLength(0);
	});

	it('refreshes category counts when clearing categories in bulk', async () => {
		mockDbInstance.pushResult([makeWishlistRow({ status: 'active' })]);
		mockDbInstance.pushResult([makeGiftRow({ categoryId: 'category-books' })]);
		mockDbInstance.pushResult([{ id: GIFT_ID }]);

		await callBulkUpdate(makeRecipientAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID],
			action: 'category',
			categoryId: null,
		});

		expect(singleFlightRefresh).toHaveBeenCalledWith(getGiftCategorySettingsRows, WISHLIST_ID);
	});

	it('applies post-share edit transparency to every changed presentation gift in one update statement', async () => {
		const secondGiftId = 'gift-2';
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT, status: 'active' })]);
		mockDbInstance.pushResult([
			makeGiftRow({ id: GIFT_ID, priorityLevelId: 'old-priority' }),
			makeGiftRow({ id: secondGiftId, name: 'Second Gift', priorityLevelId: 'old-priority' }),
		]);
		mockDbInstance.pushResult([{ id: GIFT_ID }, { id: secondGiftId }]); // one atomic update

		await callBulkUpdate(makeRecipientAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID, secondGiftId],
			action: 'priority',
			priorityLevelId: null,
		});

		const updates = mockDbInstance.calls.filter((call) => call.method === 'update');
		const sets = mockDbInstance.calls.filter((call) => call.method === 'set');
		const setValues = sets.at(0)?.args[0] as Record<string, unknown>;
		const transparencyCase = setValues.editedAfterShareAt as {
			kind: string;
			values: Array<{ parts?: Array<{ values: unknown[] }> }>;
		};
		const snapshotCase = setValues.preEditShareSnapshot as {
			kind: string;
			values: Array<{ parts?: Array<{ values: unknown[] }> }>;
		};
		const touchedIds = (transparencyCase.values[0]?.parts ?? []).map((part) => part.values[1]);
		const snapshotTouchedIds = (snapshotCase.values[0]?.parts ?? []).map(
			(part) => part.values[1],
		);

		expect(updates).toHaveLength(1);
		expect(sets).toHaveLength(1);
		expect(setValues.priorityLevelId).toBeNull();
		expect(transparencyCase.kind).toBe('sql');
		expect(touchedIds).toEqual([GIFT_ID, secondGiftId]);
		expect(snapshotTouchedIds).toEqual([GIFT_ID, secondGiftId]);
	});

	it('notifies reservers for multiple changed gifts from one reservation select in bulk', async () => {
		const secondGiftId = 'gift-2';
		mockDbInstance.pushResult([
			makeWishlistRow({ recipientUserId: null, sharedAt: SHARED_AT, status: 'active' }),
		]);
		mockDbInstance.pushResult([{ id: 'moderator-assignment' }]);
		mockDbInstance.pushResult([
			makeGiftRow({ id: GIFT_ID, priorityLevelId: 'old-priority' }),
			makeGiftRow({ id: secondGiftId, name: 'Second Gift', priorityLevelId: 'old-priority' }),
		]);
		mockDbInstance.pushResult([{ id: GIFT_ID }, { id: secondGiftId }]); // one atomic update
		mockDbInstance.pushResult([
			{ giftId: GIFT_ID, userId: 'reserver-1', anonymousEmail: null },
			{ giftId: secondGiftId, userId: null, anonymousEmail: 'guest@example.com' },
		]);

		await callBulkUpdate(makeModeratorAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID, secondGiftId],
			action: 'priority',
			priorityLevelId: null,
		});

		const reservationQueries = mockDbInstance.calls.filter(
			(call) =>
				call.method === 'from' &&
				typeof call.args[0] === 'object' &&
				call.args[0] !== null &&
				(call.args[0] as Record<string, unknown>).anonymousEmail ===
					'reservation.anonymousEmail',
		);
		const updates = mockDbInstance.calls.filter((call) => call.method === 'update');
		expect(updates).toHaveLength(1);
		expect(reservationQueries).toHaveLength(1);
		expect(dispatchNotification).toHaveBeenCalledTimes(2);
		const payloads = vi.mocked(dispatchNotification).mock.calls.map(([payload]) => payload);
		for (const expected of [
			expect.objectContaining({
				type: 'reserved_gift_edited',
				giftId: GIFT_ID,
				targetUserIds: ['reserver-1'],
				targetEmails: [],
			}),
			expect.objectContaining({
				type: 'reserved_gift_edited',
				giftId: secondGiftId,
				targetUserIds: [],
				targetEmails: ['guest@example.com'],
			}),
		]) {
			expect(payloads).toContainEqual(expected);
		}
	});

	it('rejects the transaction when the update does not affect the exact locked gift set', async () => {
		const secondGiftId = 'gift-2';
		mockDbInstance.pushResult([makeWishlistRow({ status: 'active' })]);
		mockDbInstance.pushResult([
			makeGiftRow({ id: GIFT_ID }),
			makeGiftRow({ id: secondGiftId, name: 'Second Gift' }),
		]);
		mockDbInstance.pushResult([{ id: GIFT_ID }, { id: 'gift-from-another-set' }]);

		await expect(
			callBulkUpdate(makeRecipientAuthContext(), {
				wishlistId: WISHLIST_ID,
				giftIds: [GIFT_ID, secondGiftId],
				action: 'received',
				received: true,
			}),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
		});

		expect(mockDbInstance.calls).toContainEqual({ method: 'for', args: ['update'] });
		expect(singleFlightRefresh).not.toHaveBeenCalled();
	});

	it('returns the committed result and refreshes when notification delivery fails', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mockDbInstance.pushResult([
			makeWishlistRow({ recipientUserId: null, sharedAt: SHARED_AT, status: 'active' }),
		]);
		mockDbInstance.pushResult([{ id: 'moderator-assignment' }]);
		mockDbInstance.pushResult([makeGiftRow({ priorityLevelId: 'old-priority' })]);
		mockDbInstance.pushResult([{ id: GIFT_ID }]);
		mockDbInstance.pushResult([
			{ giftId: GIFT_ID, userId: 'reserver-1', anonymousEmail: null },
		]);
		vi.mocked(dispatchNotification).mockRejectedValueOnce(new Error('provider unavailable'));

		const result = await callBulkUpdate(makeModeratorAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds: [GIFT_ID],
			action: 'priority',
			priorityLevelId: null,
		});

		expect(result).toEqual({
			updatedIds: [GIFT_ID],
			priorReceived: { [GIFT_ID]: false },
		});
		expect(log).toHaveBeenCalledWith(
			'[Notification] reserver edit notification failed',
			expect.any(Error),
		);
		expect(singleFlightRefresh).toHaveBeenCalled();
		log.mockRestore();
	});

	it('dispatches a large notification fan-out concurrently with a bounded worker count', async () => {
		const giftIds = Array.from({ length: 8 }, (_, index) => `gift-${index + 1}`);
		mockDbInstance.pushResult([
			makeWishlistRow({ recipientUserId: null, sharedAt: SHARED_AT, status: 'active' }),
		]);
		mockDbInstance.pushResult([{ id: 'moderator-assignment' }]);
		mockDbInstance.pushResult(
			giftIds.map((id, index) =>
				makeGiftRow({ id, name: `Gift ${index + 1}`, priorityLevelId: 'old-priority' }),
			),
		);
		mockDbInstance.pushResult(giftIds.map((id) => ({ id })));
		mockDbInstance.pushResult(
			giftIds.map((giftId) => ({
				giftId,
				userId: `reserver-${giftId}`,
				anonymousEmail: null,
			})),
		);

		let active = 0;
		let maximumActive = 0;
		const releases: Array<() => void> = [];
		vi.mocked(dispatchNotification).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					active += 1;
					maximumActive = Math.max(maximumActive, active);
					releases.push(() => {
						active -= 1;
						resolve();
					});
				}),
		);

		const command = callBulkUpdate(makeModeratorAuthContext(), {
			wishlistId: WISHLIST_ID,
			giftIds,
			action: 'priority',
			priorityLevelId: null,
		});
		await vi.waitFor(() => expect(releases.length).toBeGreaterThan(1));

		while (vi.mocked(dispatchNotification).mock.calls.length < giftIds.length) {
			const pending = releases.splice(0);
			pending.forEach((release) => release());
			await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
		}
		releases.splice(0).forEach((release) => release());
		await command;

		expect(maximumActive).toBeGreaterThan(1);
		expect(maximumActive).toBeLessThan(giftIds.length);
	});
});

describe('getGiftsByWishlistShortId', () => {
	describe('recipient (not self-promoted) gets GiftForRecipient without reservation/like data', () => {
		it('returns role=recipient and gifts without reservedCount/likeCount/isFullyReserved', async () => {
			// DB call 1: wishlist lookup. recipientUserId matches the authed user, so
			// resolveWishlistRole short-circuits to recipient with NO moderator query.
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			// DB call 2: gift rows
			mockDbInstance.pushResult([makeGiftRow()]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('recipient');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForRecipient & Partial<GiftForVisitor>;
			expect(gift.id).toBe(GIFT_ID);
			expect(gift.name).toBe('Test Gift');
			// Critical invariant: no reservation/like fields present (protects the surprise)
			expect('reservedCount' in gift).toBe(false);
			expect('likeCount' in gift).toBe(false);
			expect('isFullyReserved' in gift).toBe(false);
			expect('reserverNames' in gift).toBe(false);
		});

		it('returns category metadata without adding reservation-derived fields', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([
				makeGiftRow({
					categoryId: 'category-books',
					categoryPresetKey: 'books',
					categoryCustomLabel: null,
					categoryColor: '#2563EB',
					categorySortOrder: 2,
				}),
			]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);
			const gift = result.gifts[0] as Record<string, unknown>;

			expect(gift.category).toEqual({
				id: 'category-books',
				presetKey: 'books',
				customLabel: null,
				color: '#2563EB',
				sortOrder: 2,
			});
			expect('reservedCount' in gift).toBe(false);
			expect('reserverNames' in gift).toBe(false);
		});
	});

	describe('recipient with recipientIsModerator=true (self-promoted) gets counts but never gifter identities', () => {
		it('returns role=recipient and gifts with reservedCount, likeCount, isFullyReserved', async () => {
			// DB call 1: wishlist lookup (recipientIsModerator=true). Still resolves to
			// recipient (recipientUserId matches) — self-promote lifts the strip, not the role.
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: true })]);
			// DB call 2: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 3 })]);
			// DB call 3: reservation rows (with reserver names the DB always returns)
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 2, reserverName: 'Petr Svoboda' },
			]);
			// DB call 4: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 5 }]);
			// DB call 5: my reservations (recipient has none)
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('recipient');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForVisitor;
			// Counts are present (visitor-shaped DTO)…
			expect(gift.reservedCount).toBe(2);
			expect(gift.likeCount).toBe(5);
			expect(gift.isFullyReserved).toBe(false); // 2 reserved out of 3
			// …but gifter identities never are: self-promote reveals counts, not names
			// (reserver names are moderator-only — issue #198).
			expect(gift.reserverNames).toEqual([]);
		});
	});

	describe('visitor gets GiftForVisitor with reservation counts and like counts', () => {
		it('returns role=visitor with reservedCount, likeCount, isFullyReserved=true when fully reserved', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: moderator check (not a moderator)
			mockDbInstance.pushResult([]);
			// DB call 3: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 2 })]);
			// DB call 4: reservation rows (fully reserved)
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 2, reserverName: 'Petr Svoboda' },
			]);
			// DB call 5: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 3 }]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(2);
			expect(gift.likeCount).toBe(3);
			expect(gift.isFullyReserved).toBe(true);
		});

		it('sets reservedCount=0 and likeCount=0 when no reservations or likes exist', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// No reservation counts returned
			mockDbInstance.pushResult([]);
			// No like counts returned
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(0);
			expect(gift.likeCount).toBe(0);
			expect(gift.isFullyReserved).toBe(false);
		});

		it('sets myReservationId to the current user active reservation for that gift', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// reservation rows
			mockDbInstance.pushResult([{ giftId: GIFT_ID, quantity: 1, reserverName: 'Já' }]);
			mockDbInstance.pushResult([]); // like counts
			// my active reservations for these gifts
			mockDbInstance.pushResult([{ id: 'res-mine', giftId: GIFT_ID }]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.myReservationId).toBe('res-mine');
		});

		it('sets myReservationId to null when the current user has no reservation', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations: none

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.myReservationId).toBeNull();
		});
	});

	describe('moderator gets GiftForVisitor with reservation and like counts', () => {
		it('returns role=moderator and full gift data', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: moderator check (is a moderator)
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// DB call 3: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 5 })]);
			// DB call 4: reservation rows
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
			]);
			// DB call 5: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 10 }]);

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('moderator');
			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(1);
			expect(gift.likeCount).toBe(10);
			expect(gift.isFullyReserved).toBe(false);
			// Moderators see who reserved (issue #198)
			expect(gift.reserverNames).toEqual(['Babička Marie']);
		});
	});

	describe('reserver display names — moderator only (issue #198)', () => {
		it('visitor sees no reserver display name on a reserved gift (counts stay intact)', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// reservation rows: name coalesced from the reserver account / anonymous signature —
			// the DB still returns it, but the visitor viewer must never receive it.
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
			]);
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.isFullyReserved).toBe(true);
			expect(gift.reserverNames).toEqual([]);
		});

		it('anonymous (unauthenticated) caller sees no reserver display name on a reserved gift', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			// No moderator check: authContext is null.
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Petr Svoboda' },
			]);
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(null, WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.isFullyReserved).toBe(true);
			expect(gift.reserverNames).toEqual([]);
		});

		it('moderator collects multiple reservers in reservation order and deduplicates repeats', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]); // is a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 4 })]);
			// Same person reserving twice must appear once; order follows createdAt.
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
				{ giftId: GIFT_ID, quantity: 2, reserverName: 'Petr Svoboda' },
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Babička Marie' },
			]);
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(4);
			expect(gift.isFullyReserved).toBe(true);
			expect(gift.reserverNames).toEqual(['Babička Marie', 'Petr Svoboda']);
		});

		it('moderator counts reservations without a usable name but sees no name entry for them', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]); // is a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 2 })]);
			// e.g. reserver account deleted (userId set null, no anonymous signature)
			mockDbInstance.pushResult([
				{ giftId: GIFT_ID, quantity: 1, reserverName: null },
				{ giftId: GIFT_ID, quantity: 1, reserverName: 'Teta Klára' },
			]);
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(2);
			expect(gift.reserverNames).toEqual(['Teta Klára']);
		});

		it('owner/recipient payload carries ZERO reservation fields — including reserverNames', async () => {
			// Core product invariant: the recipient must never learn reservation state.
			// Enumerates every visitor-only field so a future field addition that leaks
			// past the strip fails this test.
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow()]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('recipient');
			const gift = result.gifts[0] as Record<string, unknown>;
			const visitorOnlyFields = [
				'likeCount',
				'reservedCount',
				'isFullyReserved',
				'reserverNames',
				'myReservationId',
				'myReservationPurchasedAt',
			];
			for (const field of visitorOnlyFields) {
				expect(field in gift, `field "${field}" must not leak to the recipient`).toBe(
					false,
				);
			}
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when wishlist does not exist', async () => {
			mockDbInstance.pushResult([]);

			await expect(callGetGifts(null, 'nonexistent')).rejects.toMatchObject({
				status: 404,
				message: 'WISHLIST_NOT_FOUND',
			});
		});
	});

	describe('unauthenticated visitor', () => {
		it('returns role=visitor with reservation data when not logged in', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: gift rows (no moderator check since authContext is null)
			mockDbInstance.pushResult([makeGiftRow()]);
			// DB call 3: reservation counts
			mockDbInstance.pushResult([]);
			// DB call 4: like counts
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(null, WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			const gift = result.gifts[0] as GiftForVisitor;
			expect('reservedCount' in gift).toBe(true);
		});
	});

	describe('image metadata is returned to all roles without leaking reservations', () => {
		const imageMeta = {
			fitMode: 'cover-crop',
			cropRect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
			focal: { x: 50, y: 40 },
			zoom: 1.5,
			bgColor: null,
		};

		it('recipient (no self-promote) receives imageKey + imageMeta but no reservation data', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow({ imageKey: 'gifts/cam.jpg', imageMeta })]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForRecipient & Partial<GiftForVisitor>;
			expect(gift.imageKey).toBe('gifts/cam.jpg');
			expect(gift.imageMeta).toEqual(imageMeta);
			expect('reservedCount' in gift).toBe(false);
			expect('likeCount' in gift).toBe(false);
		});

		it('visitor receives imageKey + imageMeta alongside reservation counts', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ imageKey: 'gifts/cam.jpg', imageMeta })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.imageKey).toBe('gifts/cam.jpg');
			expect(gift.imageMeta).toEqual(imageMeta);
			expect(gift.reservedCount).toBe(0);
		});
	});

	describe('gift links are returned to all roles', () => {
		const links = [
			{ url: 'https://www.alza.cz/playstation-5' },
			{ url: 'https://www.datart.cz/playstation-5', label: 'Datart' },
		];

		it('recipient (no self-promote) receives the full links array', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow({ links })]);

			const result = await callGetGifts(makeRecipientAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForRecipient;
			expect(gift.links).toEqual(links);
		});

		it('visitor receives the full links array alongside reservation counts', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ links })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.links).toEqual(links);
			expect(gift.reservedCount).toBe(0);
		});
	});
});

describe('updateGift', () => {
	const updateInput = { id: GIFT_ID, name: 'Updated Name' };

	describe('recipient can update gifts created after sharing (or unshared)', () => {
		it('returns updated gift when wishlist is not yet shared', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyManagerAccess: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID, name: 'Updated Name' });
		});

		it('refreshes category counts when clearing a category', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, categoryId: 'category-books' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, categoryId: null }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, categoryId: null });

			expect(singleFlightRefresh).toHaveBeenCalledWith(
				getGiftCategorySettingsRows,
				WISHLIST_ID,
			);
		});

		it('persists updated image metadata', async () => {
			const imageMeta = { fitMode: 'contain-padded', bgColor: '#222222' };
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageMeta }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				imageMeta,
			});

			expect(result).toMatchObject({ id: GIFT_ID, imageMeta });
		});

		it('persists updated priceMax', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 1200, priceMax: 1500 }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				price: 1200,
				priceMax: 1500,
			});

			expect(result).toMatchObject({ id: GIFT_ID, price: 1200, priceMax: 1500 });
			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues).toMatchObject({ price: 1200, priceMax: 1500 });
		});

		it('persists decimal price range bounds (issue #250 REQ-2, REQ-4)', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 19.5, priceMax: 29.95 }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				price: 19.5,
				priceMax: 29.95,
			});

			expect(result).toMatchObject({ id: GIFT_ID, price: 19.5, priceMax: 29.95 });
			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues).toMatchObject({ price: 19.5, priceMax: 29.95 });
		});

		it('rejects a priceMax-only update that would invert the persisted range', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING, price: 1500 })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, priceMax: 1200 }),
			).rejects.toMatchObject({
				status: 400,
				message: 'INVALID_PRICE_RANGE',
			});
		});

		it('deletes the replaced uploaded image from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, imageKey: 'gifts/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageKey: 'gifts/new.jpg' }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				imageKey: 'gifts/new.jpg',
			});

			expect(mockDeleteObjects).toHaveBeenCalledWith(['gifts/old.jpg']);
		});

		it('deletes the old uploaded image when the image is removed (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, imageKey: 'gifts/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageKey: null }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, imageKey: null });

			expect(mockDeleteObjects).toHaveBeenCalledWith(['gifts/old.jpg']);
		});

		it('keeps storage untouched when the image key does not change (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, imageKey: 'gifts/same.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageKey: 'gifts/same.jpg' }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				name: 'Updated Name',
				imageKey: 'gifts/same.jpg',
			});

			expect(mockDeleteObjects).not.toHaveBeenCalled();
		});

		it('recipient can update gifts created after sharing date', async () => {
			// gift lookup – created AFTER sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyManagerAccess: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeRecipientAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID });
		});

		it('normalizes updated gift links before persisting', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([
				{ id: GIFT_ID, links: [{ url: 'https://example.com/path' }] },
			]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				links: [{ url: ' https://example.com/path ' }],
			});

			const updateSetValues = mockDbInstance.calls
				.filter((call) => call.method === 'set')
				.at(0)?.args[0] as { links: { url: string; label?: string }[] };
			expect(updateSetValues.links).toEqual([{ url: 'https://example.com/path' }]);
		});

		it('rejects updates on archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), updateInput),
			).rejects.toMatchObject({
				status: 400,
				message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			});
		});
	});

	describe('recipient per-field edit of a pre-share gift on a shared wishlist', () => {
		it('allows editing price/links/imageMeta/priority and flags editedAfterShareAt', async () => {
			const imageMeta = { fitMode: 'contain-padded', bgColor: '#222222' };
			// gift lookup – created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING, price: 100 })]);
			// wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				price: 250,
				links: [{ url: 'https://example.com/path' }],
				imageMeta,
				priorityLevelId: 'prio-1',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.price).toBe(250);
			expect(setValues.links).toEqual([{ url: 'https://example.com/path' }]);
			expect(setValues.imageMeta).toEqual(imageMeta);
			expect(setValues.priorityLevelId).toBe('prio-1');
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});

		it('rejects 403 CANNOT_EDIT_AFTER_SHARING when changing the name', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, name: 'Original' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' }),
			).rejects.toMatchObject({ status: 403, message: 'CANNOT_EDIT_AFTER_SHARING' });
		});

		it('refreshes category counts when the pre-share edit path clears a category', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, categoryId: 'category-books' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, categoryId: null }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, categoryId: null });

			expect(singleFlightRefresh).toHaveBeenCalledWith(
				getGiftCategorySettingsRows,
				WISHLIST_ID,
			);
		});

		it('allows raising quantity (3 -> 5)', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING, quantity: 3 })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, quantity: 5 });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.quantity).toBe(5);
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});

		it('rejects 400 QUANTITY_CANNOT_BE_LOWERED when lowering quantity, without querying reservations', async () => {
			// Surprise-protection invariant: the rejection is driven solely by the gift's own
			// quantity column; updateGift must never read the reservation table (which would let the
			// recipient infer reserved counts). The row shape is identical whether or not the gift is
			// reserved, so this single path covers both reserved and unreserved gifts (REQ-3/5).
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING, quantity: 3 })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(
				callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, quantity: 1 }),
			).rejects.toMatchObject({ status: 400, message: 'QUANTITY_CANNOT_BE_LOWERED' });

			// No `.from(reservation)` ran. The reservation table mock is identifiable by its
			// `giftId: 'reservation.giftId'` column ref (args[0] is the table object, not a string).
			const queriedReservation = mockDbInstance.calls
				.filter((call) => call.method === 'from')
				.some((call) => {
					const table = call.args[0];
					return (
						typeof table === 'object' &&
						table !== null &&
						(table as Record<string, unknown>).giftId === 'reservation.giftId'
					);
				});
			expect(queriedReservation).toBe(false);
		});

		it('does NOT flag editedAfterShareAt when a pre-share edit changes nothing', async () => {
			// Idempotent save: submitting the gift's existing name (allowed but unchanged) must not
			// set the transparency timestamp, or every modal open+save would falsely badge the gift.
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, name: 'Test Gift', quantity: 3 }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				name: 'Test Gift',
				quantity: 3,
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect('editedAfterShareAt' in setValues).toBe(false);
		});

		it('appends to descriptionAppends when the base description is non-empty', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: BEFORE_SHARING,
					description: 'Original description',
					descriptionAppends: [],
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				description: 'blue variant',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			// Frozen base untouched
			expect('description' in setValues).toBe(false);
			const appends = setValues.descriptionAppends as { text: string; addedAt: string }[];
			expect(appends).toHaveLength(1);
			expect(appends[0]!.text).toBe('blue variant');
			expect(typeof appends[0]!.addedAt).toBe('string');
		});

		it('fills the main description when base is empty at share (no append)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: BEFORE_SHARING,
					description: null,
					descriptionAppends: [],
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), {
				id: GIFT_ID,
				description: 'now has text',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.description).toBe('now has text');
			expect('descriptionAppends' in setValues).toBe(false);
		});
	});

	describe('moderator can always update', () => {
		it('moderator bypasses the edit lock and updates the gift', async () => {
			// gift lookup – created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyManagerAccess: wishlist lookup (shared, caller is a moderator, not the recipient)
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: SHARED_AT, recipientUserId: 'someone-else' }),
			]);
			// moderator check
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeModeratorAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID });

			// Moderator changing a field on a shared wishlist flags edit transparency.
			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Updated Name');
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});
	});

	describe('editedAfterShareAt transparency for post-share-created gifts', () => {
		it('flags editedAfterShareAt when a recipient edits a gift created after sharing', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, name: 'Original' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Renamed');
			expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
		});

		it('does NOT flag editedAfterShareAt on an unshared wishlist', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: AFTER_SHARING, name: 'Original' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect('editedAfterShareAt' in setValues).toBe(false);
		});
	});
});

describe('updateGift – net-zero grace-window revert clears the badge (issue #124)', () => {
	// Server `now` is fixed so grace-window math is deterministic. Gift created 60s before "now" =
	// grace open (isOwnerSharedGiftDeleteGraceOpen uses giftCreatedAt for post-share-created gifts);
	// 3 min before "now" = grace closed.
	const nowFake = new Date('2024-03-01T12:00:00.000Z');
	const createdAt60sAgo = new Date(nowFake.getTime() - 60_000);
	const createdAt3MinAgo = new Date(nowFake.getTime() - 3 * 60_000);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(nowFake);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('REQ-1: first in-grace edit sets the badge and captures the snapshot', () => {
		it('moderator edit within grace sets editedAfterShareAt and snapshots the pre-edit state', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo',
					editedAfterShareAt: null,
					preEditShareSnapshot: null,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: nowFake, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo horské' }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, name: 'Kolo horské' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo horské');
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			expect(setValues.preEditShareSnapshot).toMatchObject({ name: 'Kolo' });
		});
	});

	describe('REQ-2: net-zero revert within grace clears the badge', () => {
		it('"Kolo" -> "Kolo horské" -> "Kolo" within grace clears editedAfterShareAt on the revert', async () => {
			// Second edit: gift row already carries the badge + snapshot from the first in-grace edit.
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo horské',
					editedAfterShareAt: createdAt60sAgo,
					preEditShareSnapshot: toPreShareGiftSnapshot(makeGiftRow({ name: 'Kolo' })),
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: nowFake, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo' }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, name: 'Kolo' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo');
			expect(setValues.editedAfterShareAt).toBeNull();
			expect(setValues.preEditShareSnapshot).toBeNull();
		});

		it('net-nonzero in-grace edit keeps the badge set and preserves the original snapshot', async () => {
			const shareTimeSnapshot = toPreShareGiftSnapshot(makeGiftRow({ name: 'Kolo' }));
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo horské',
					editedAfterShareAt: createdAt60sAgo,
					preEditShareSnapshot: shareTimeSnapshot,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: nowFake, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo elektrické' }]);

			await callUpdateGift(makeModeratorAuthContext(), {
				id: GIFT_ID,
				name: 'Kolo elektrické',
			});

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo elektrické');
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			// Original share-time snapshot preserved (not the intermediate "Kolo horské" state).
			expect(setValues.preEditShareSnapshot).toMatchObject({ name: 'Kolo' });
		});
	});

	describe('REQ-3: post-grace edits always badge permanently, even if later reverted', () => {
		it('a post-grace edit sets the badge with no snapshot bookkeeping', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt3MinAgo,
					name: 'Kolo',
					editedAfterShareAt: null,
					preEditShareSnapshot: null,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: createdAt3MinAgo, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 1500 }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, price: 1500 });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.price).toBe(1500);
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			expect(setValues.preEditShareSnapshot).toBeNull();
		});

		it('a post-grace revert to the original price still badges permanently (no net-zero exception)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt3MinAgo,
					price: 1500,
					editedAfterShareAt: createdAt3MinAgo,
					preEditShareSnapshot: null,
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: createdAt3MinAgo, recipientUserId: 'someone-else' }),
			]);
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			mockDbInstance.pushResult([{ id: GIFT_ID, price: 1000 }]);

			await callUpdateGift(makeModeratorAuthContext(), { id: GIFT_ID, price: 1000 });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.price).toBe(1000);
			expect(setValues.editedAfterShareAt).toEqual(nowFake);
			expect(setValues.preEditShareSnapshot).toBeNull();
		});
	});

	describe('net-zero revert via the recipient full-edit path (name, during share grace)', () => {
		it('recipient reverting the name within share grace clears the badge', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: createdAt60sAgo,
					name: 'Kolo horské',
					editedAfterShareAt: createdAt60sAgo,
					preEditShareSnapshot: toPreShareGiftSnapshot(makeGiftRow({ name: 'Kolo' })),
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: nowFake })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Kolo' }]);

			await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Kolo' });

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect(setValues.name).toBe('Kolo');
			expect(setValues.editedAfterShareAt).toBeNull();
			expect(setValues.preEditShareSnapshot).toBeNull();
		});
	});
});

describe('updateGift – share grace window (issue #83)', () => {
	// Server `now` is fixed so the window math is deterministic. sharedAt 60s ago = window open;
	// 3 min ago = window closed.
	const nowFake = new Date('2024-03-01T12:00:00.000Z');
	const shared60sAgo = new Date(nowFake.getTime() - 60_000);
	const shared3MinAgo = new Date(nowFake.getTime() - 3 * 60_000);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(nowFake);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('lets the recipient change the name of a pre-share gift while the window is open', async () => {
		mockDbInstance.pushResult([
			makeGiftRow({
				createdAt: BEFORE_SHARING,
				name: 'Original',
				editedAfterShareAt: null,
			}),
		]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: shared60sAgo })]);
		mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Renamed' }]);

		await callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' });

		const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
			?.args[0] as Record<string, unknown>;
		// Full-edit path: the name is written (not rejected) and the transparency timestamp bumps.
		expect(setValues.name).toBe('Renamed');
		expect(setValues.editedAfterShareAt).toBeInstanceOf(Date);
	});

	it('does not keep full edit open via a recent editedAfterShareAt when sharedAt is old', async () => {
		mockDbInstance.pushResult([
			makeGiftRow({
				createdAt: BEFORE_SHARING,
				name: 'Original',
				editedAfterShareAt: shared60sAgo,
			}),
		]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: shared3MinAgo })]);

		await expect(
			callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' }),
		).rejects.toMatchObject({ status: 403, message: 'CANNOT_EDIT_AFTER_SHARING' });
	});

	it('rejects a name change once the window has closed (stale client cannot bypass server)', async () => {
		mockDbInstance.pushResult([
			makeGiftRow({
				createdAt: BEFORE_SHARING,
				name: 'Original',
				editedAfterShareAt: null,
			}),
		]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: shared3MinAgo })]);

		await expect(
			callUpdateGift(makeRecipientAuthContext(), { id: GIFT_ID, name: 'Renamed' }),
		).rejects.toMatchObject({ status: 403, message: 'CANNOT_EDIT_AFTER_SHARING' });
	});
});

describe('deleteGift', () => {
	describe('recipient can delete unreserved gifts created after sharing only during creation grace', () => {
		const nowFake = new Date('2024-03-01T12:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('soft-deletes a post-share-created gift within 2 minutes of creation', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: new Date(nowFake.getTime() - 60_000) }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
			]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeRecipientAuthContext(), GIFT_ID),
			).resolves.not.toThrow();
			expect(singleFlightRefresh).toHaveBeenCalledWith(
				getGiftCategorySettingsRows,
				WISHLIST_ID,
			);
		});

		it('deletes the uploaded image from storage on delete (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: new Date(nowFake.getTime() - 60_000),
					imageKey: 'gifts/img.jpg',
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
			]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([]);

			await callDeleteGift(makeRecipientAuthContext(), GIFT_ID);

			expect(mockDeleteObjects).toHaveBeenCalledWith(['gifts/img.jpg']);
		});

		it('blocks a post-share-created gift after its creation grace closes', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: new Date(nowFake.getTime() - 3 * 60_000) }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
			]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});
	});

	describe('recipient CANNOT delete gifts created before sharing (edit lock)', () => {
		it('throws 403 when gift was created before wishlist was shared', async () => {
			// gift lookup – created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyManagerAccess: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});
	});

	describe('recipient CAN delete a pre-share gift within the share grace window (issue #83)', () => {
		const nowFake = new Date('2024-03-01T12:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('soft-deletes a pre-share gift when the window is still open', async () => {
			// gift lookup – created BEFORE sharing, shared 60s ago → window open
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, editedAfterShareAt: null }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 60_000) }),
			]);
			// reservation check – none
			mockDbInstance.pushResult([]);
			// soft-delete update
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeRecipientAuthContext(), GIFT_ID),
			).resolves.not.toThrow();
		});

		it('blocks deletion once the window has closed (stale client cannot bypass server)', async () => {
			// shared 3 min ago, never re-edited → window closed
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, editedAfterShareAt: null }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 3 * 60_000) }),
			]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});

		it('does not reopen pre-share gift deletion via a recent post-share edit', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({
					createdAt: BEFORE_SHARING,
					editedAfterShareAt: new Date(nowFake.getTime() - 60_000),
				}),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 3 * 60_000) }),
			]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 403,
					message: 'CANNOT_DELETE_AFTER_SHARING',
				},
			);
		});

		it('still blocks deleting a reserved gift even within the window', async () => {
			mockDbInstance.pushResult([
				makeGiftRow({ createdAt: BEFORE_SHARING, editedAfterShareAt: null }),
			]);
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 60_000) }),
			]);
			// reservation check – has a reservation
			mockDbInstance.pushResult([{ id: 'reservation-1' }]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 400,
					message: 'CANNOT_DELETE_RESERVED_GIFT',
				},
			);
		});
	});

	describe('cannot delete reserved gifts', () => {
		it('throws 400 when gift has active reservations', async () => {
			const nowFake = new Date('2024-03-01T12:00:00.000Z');
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);

			try {
				mockDbInstance.pushResult([
					makeGiftRow({ createdAt: new Date(nowFake.getTime() - 60_000) }),
				]);
				mockDbInstance.pushResult([
					makeWishlistRow({ sharedAt: new Date(nowFake.getTime() - 10 * 60_000) }),
				]);
				mockDbInstance.pushResult([{ id: 'reservation-1' }]);

				await expect(
					callDeleteGift(makeRecipientAuthContext(), GIFT_ID),
				).rejects.toMatchObject({
					status: 400,
					message: 'CANNOT_DELETE_RESERVED_GIFT',
				});
			} finally {
				vi.useRealTimers();
			}
		});
	});

	describe('returns 404 for non-existent gift', () => {
		it('throws 404 when gift does not exist', async () => {
			// gift lookup – empty
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeRecipientAuthContext(), 'ghost-gift'),
			).rejects.toMatchObject({
				status: 404,
				message: 'GIFT_NOT_FOUND',
			});
		});
	});

	describe('archived wishlist', () => {
		it('rejects deleting gifts from archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(callDeleteGift(makeRecipientAuthContext(), GIFT_ID)).rejects.toMatchObject(
				{
					status: 400,
					message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
				},
			);
		});
	});
});

describe('reorderGifts', () => {
	it('rejects cross-wishlist reorder items', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([
			{ id: GIFT_ID, wishlistId: WISHLIST_ID },
			{ id: 'gift-from-other-wishlist', wishlistId: 'other-wishlist' },
		]);

		await expect(
			callReorderGifts(makeRecipientAuthContext(), [
				{ id: GIFT_ID, sortOrder: 0 },
				{ id: 'gift-from-other-wishlist', sortOrder: 1 },
			]),
		).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
		});
	});

	it('rejects reorders on archived wishlists', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

		await expect(
			callReorderGifts(makeRecipientAuthContext(), [{ id: GIFT_ID, sortOrder: 0 }]),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		});
	});

	it('never sets editedAfterShareAt (regression)', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
		mockDbInstance.pushResult([{ id: GIFT_ID, wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([]);

		await callReorderGifts(makeRecipientAuthContext(), [{ id: GIFT_ID, sortOrder: 2 }]);

		const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
			?.args[0] as Record<string, unknown>;
		expect('editedAfterShareAt' in setValues).toBe(false);
	});
});

describe('markGiftReceived', () => {
	const markInput = { giftId: GIFT_ID, received: true };

	describe('recipient can mark as received', () => {
		it('returns updated gift with received=true', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow()]);
			// verifyManagerAccess: wishlist lookup (recipientUserId matches → recipient)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, received: true }]);

			const result = await callMarkReceived(makeRecipientAuthContext(), markInput);

			expect(result).toMatchObject({ id: GIFT_ID, received: true });
		});

		it('never sets editedAfterShareAt (regression)', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, received: true }]);

			await callMarkReceived(makeRecipientAuthContext(), markInput);

			const setValues = mockDbInstance.calls.filter((call) => call.method === 'set').at(0)
				?.args[0] as Record<string, unknown>;
			expect('editedAfterShareAt' in setValues).toBe(false);
		});
	});

	describe('non-manager gets 403 ACCESS_DENIED', () => {
		it('throws 403 when caller is neither recipient nor moderator', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow()]);
			// verifyManagerAccess: wishlist lookup (recipient is RECIPIENT_ID, caller is VISITOR_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// moderator check returns empty → role resolves to visitor → ACCESS_DENIED
			mockDbInstance.pushResult([]);

			await expect(
				callMarkReceived(makeVisitorAuthContext(), markInput),
			).rejects.toMatchObject({
				status: 403,
				message: SERVER_ERROR.ACCESS_DENIED,
			});
		});
	});

	describe('archived wishlist', () => {
		it('rejects marking gifts as received on archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callMarkReceived(makeRecipientAuthContext(), markInput),
			).rejects.toMatchObject({
				status: 400,
				message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			});
		});
	});
});

// ── Statement budgets (issue #108, REQ-7) ─────────────────────────────────────

describe('statement budgets (issue #108, REQ-7)', () => {
	/** Statements = top-level select/insert/update/delete chains started on the db. */
	function statementCount(): number {
		return mockDbInstance.calls.filter((call) =>
			['select', 'insert', 'update', 'delete'].includes(call.method),
		).length;
	}

	it('getGiftsByWishlistShortId (authed visitor) stays within 6 statements', async () => {
		mockDbInstance.pushResult([makeWishlistRow()]); // wishlist lookup
		mockDbInstance.pushResult([]); // moderator check → visitor
		mockDbInstance.pushResult([makeGiftRow()]); // gift rows
		mockDbInstance.pushResult([]); // reservations
		mockDbInstance.pushResult([]); // like counts
		mockDbInstance.pushResult([]); // my reservations

		await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

		expect(statementCount()).toBeLessThanOrEqual(6);
	});
});
