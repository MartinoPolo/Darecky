import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
const assertWishlistBannerAssignment = vi.fn(
	async (userId: string, objectKey: string, token: string | undefined) => {
		if (token !== `proof:${userId}:${objectKey}`) {
			throw new Error('ACCESS_DENIED');
		}
	},
);
vi.mock('./wishlist_image_assignment.js', () => ({ assertWishlistBannerAssignment }));

async function bannerAssignmentToken(objectKey: string, userId = RECIPIENT_ID) {
	return `proof:${userId}:${objectKey}`;
}

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

// ── Mock remote wrappers – attach .__  so init_remote_functions validator passes
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
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// ── Mock SvelteKit error so it throws with a .status property ────────────────
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

// ── Mock drizzle-orm – inspectable where-clause builders ────────────────────
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
	and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
	or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
	ne: vi.fn((...args: unknown[]) => ({ op: 'ne', args })),
	isNull: vi.fn((arg: unknown) => ({ op: 'isNull', args: [arg] })),
	// Tagged template used as `sql<T>` in subquery projections; the result is aliased via
	// `.as(...)`, so return a chainable stub instead of a bare undefined.
	sql: vi.fn(() => ({ as: vi.fn(() => 'sql_alias') })),
}));

// ── Mock schema imports ───────────────────────────────────────────────────────
vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		recipientUserId: 'wishlist.recipientUserId',
		recipientName: 'wishlist.recipientName',
		recipientIsModerator: 'wishlist.recipientIsModerator',
		shortId: 'wishlist.shortId',
		status: 'wishlist.status',
		sharedAt: 'wishlist.sharedAt',
		eventDateEditedAt: 'wishlist.eventDateEditedAt',
		deletedAt: 'wishlist.deletedAt',
		createdAt: 'wishlist.createdAt',
		updatedAt: 'wishlist.updatedAt',
		title: 'wishlist.title',
		description: 'wishlist.description',
		eventDate: 'wishlist.eventDate',
		theme: 'wishlist.theme',
		customThemeColor: 'wishlist.customThemeColor',
		imageKey: 'wishlist.imageKey',
		imageSlots: 'wishlist.imageSlots',
		archivedAt: 'wishlist.archivedAt',
	},
	priorityLevel: {
		id: 'priorityLevel.id',
		wishlistId: 'priorityLevel.wishlistId',
		sortOrder: 'priorityLevel.sortOrder',
		label: 'priorityLevel.label',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'moderatorAssignment.id',
		wishlistId: 'moderatorAssignment.wishlistId',
		userId: 'moderatorAssignment.userId',
		deletedAt: 'moderatorAssignment.deletedAt',
		assignedAt: 'moderatorAssignment.assignedAt',
	},
}));

vi.mock('$lib/server/db/follower.schema.js', () => ({
	wishlistFollower: {
		wishlistId: 'wishlistFollower.wishlistId',
		userId: 'wishlistFollower.userId',
		unfollowedAt: 'wishlistFollower.unfollowedAt',
		lastVisitedAt: 'wishlistFollower.lastVisitedAt',
		createdAt: 'wishlistFollower.createdAt',
	},
}));

vi.mock('$lib/server/db/wishlist_visit.schema.js', () => ({
	wishlistVisit: {
		wishlistId: 'wishlistVisit.wishlistId',
		userId: 'wishlistVisit.userId',
		lastVisitedAt: 'wishlistVisit.lastVisitedAt',
	},
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		deletedAt: 'gift.deletedAt',
	},
	reservation: {
		giftId: 'reservation.giftId',
		deletedAt: 'reservation.deletedAt',
		id: 'reservation.id',
		userId: 'reservation.userId',
		quantity: 'reservation.quantity',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: {
		id: 'user.id',
		name: 'user.name',
		image: 'user.image',
	},
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

// ── DB mock helper ────────────────────────────────────────────────────────────

interface MockDb {
	db: Record<string | symbol, unknown>;
	pushResult: (result: unknown[]) => void;
	/** Payload passed to the most recent `.set(...)` call (e.g. drizzle update data). */
	lastSetPayload: () => Record<string, unknown> | undefined;
	/** Payload passed to the most recent `.values(...)` call (e.g. drizzle insert data). */
	lastValuesPayload: () => Record<string, unknown> | undefined;
	/** Payload passed to the Nth `.values(...)` call in order (0 = first insert in the tx). */
	valuesPayloadAt: (index: number) => Record<string, unknown> | undefined;
	/** Number of awaited query chains so far — i.e. statements sent to the database. */
	statementCount: () => number;
	/** Hold query results so tests can observe how many statements start before any settles. */
	deferStatements: () => void;
	releaseStatements: () => void;
	wherePayloads: () => readonly unknown[];
	transactionCount: () => number;
	forPayloads: () => readonly unknown[];
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const indexRef = { value: 0 };
	const setPayloads: Record<string, unknown>[] = [];
	const valuesPayloads: Record<string, unknown>[] = [];
	const wherePayloads: unknown[] = [];
	const forPayloads: unknown[] = [];
	let transactionCount = 0;
	let statementsDeferred = false;
	const pendingStatementResolvers: Array<() => void> = [];

	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[indexRef.value] ?? [];
					indexRef.value++;
					return (resolve: (value: unknown) => void) => {
						const settle = () => resolve(result);
						if (statementsDeferred) {
							pendingStatementResolvers.push(settle);
						} else {
							settle();
						}
					};
				}
				if (prop === 'transaction') {
					return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
						transactionCount += 1;
						return callback(chain);
					});
				}
				if (prop === 'for') {
					return vi.fn((payload: unknown) => {
						forPayloads.push(payload);
						return chain;
					});
				}
				if (prop === 'set') {
					return vi.fn((payload: Record<string, unknown>) => {
						setPayloads.push(payload);
						return chain;
					});
				}
				if (prop === 'values') {
					return vi.fn((payload: Record<string, unknown>) => {
						valuesPayloads.push(payload);
						return chain;
					});
				}
				if (prop === 'where') {
					return vi.fn((payload: unknown) => {
						wherePayloads.push(payload);
						return chain;
					});
				}
				return vi.fn(() => chain);
			},
		},
	);

	return {
		db: chain,
		pushResult: (result: unknown[]) => results.push(result),
		lastSetPayload: () => setPayloads[setPayloads.length - 1],
		lastValuesPayload: () => valuesPayloads[valuesPayloads.length - 1],
		valuesPayloadAt: (index) => valuesPayloads[index],
		statementCount: () => indexRef.value,
		deferStatements: () => {
			statementsDeferred = true;
		},
		releaseStatements: () => {
			statementsDeferred = false;
			pendingStatementResolvers.splice(0).forEach((settle) => settle());
		},
		wherePayloads: () => [...wherePayloads],
		transactionCount: () => transactionCount,
		forPayloads: () => [...forPayloads],
		reset: () => {
			results.length = 0;
			indexRef.value = 0;
			setPayloads.length = 0;
			valuesPayloads.length = 0;
			wherePayloads.length = 0;
			transactionCount = 0;
			forPayloads.length = 0;
			statementsDeferred = false;
			pendingStatementResolvers.length = 0;
		},
	};
}

// ── Mock getDb ────────────────────────────────────────────────────────────────

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

// ── Mock R2 storage cleanup (issue #107, REQ-6) ──────────────────────────────

vi.mock('$lib/server/storage/r2.js', () => ({
	deleteObjectsBestEffort: vi.fn(() => Promise.resolve()),
}));

// ── Import the module under test (after all mocks are set up) ─────────────────

import {
	deleteWishlist,
	updateWishlist,
	archiveWishlist,
	createWishlist,
	renameRecipient,
	flipRecipientToFreeText,
	followWishlist,
	unfollowWishlist,
	refollowWishlist,
	getWishlistByShortId,
	setWishlistPalette,
	recordWishlistVisit,
	getMyWishlists,
	getModeratedWishlists,
	getFollowedWishlists,
} from './wishlists.remote.js';
import { getHomeOverview } from './home_overview_service.js';
import { CreateWishlistInputSchema, FlipRecipientToFreeTextInputSchema } from './types.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';

const mockDeleteObjects = vi.mocked(deleteObjectsBestEffort);
const mockDispatchNotification = vi.mocked(dispatchNotification);

// ── Test data factories ───────────────────────────────────────────────────────

/** The linked recipient of a self list — manages inherently, no moderatorAssignment row. */
const RECIPIENT_ID = 'user-recipient';
const OTHER_USER_ID = 'user-other';
const MODERATOR_ID = 'user-moderator';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc12345';

/**
 * A "self" wishlist row: the linked recipient (`recipientUserId`) is the manager, there is no
 * free-text recipient name. Pass `recipientUserId: null` + `recipientName` for a for-someone list.
 */
function makeWishlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: WISHLIST_ID,
		shortId: WISHLIST_SHORT_ID,
		recipientUserId: RECIPIENT_ID,
		recipientName: null,
		recipientIsModerator: false,
		title: 'Test Wishlist',
		description: null,
		status: 'draft',
		sharedAt: null,
		eventDateEditedAt: null,
		deletedAt: null,
		archivedAt: null,
		eventDate: null,
		theme: 'default',
		customThemeColor: null,
		imageKey: null,
		imageSlots: null,
		createdAt: new Date('2024-01-01T00:00:00Z'),
		updatedAt: new Date('2024-01-01T00:00:00Z'),
		...overrides,
	};
}

/** For-someone list: no linked recipient, free-text `recipientName`, managed via moderatorAssignment. */
function makeForSomeoneWishlistRow(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return makeWishlistRow({
		recipientUserId: null,
		recipientName: 'Grandma',
		...overrides,
	});
}

/** Auth context for the linked recipient (manages a self list inherently). */
function makeRecipientAuthContext(): { user: { id: string } } {
	return { user: { id: RECIPIENT_ID } };
}

function makeOtherAuthContext(): { user: { id: string } } {
	return { user: { id: OTHER_USER_ID } };
}

function makeModeratorAuthContext(): { user: { id: string } } {
	return { user: { id: MODERATOR_ID } };
}

// ── Typed handler aliases ─────────────────────────────────────────────────────

interface AuthContext {
	user: { id: string };
}
type NullableAuthContext = AuthContext | null;

type DeleteWishlistHandler = (auth: AuthContext, wishlistId: string) => Promise<void>;
type UpdateWishlistHandler = (
	auth: AuthContext,
	input: Record<string, unknown>,
) => Promise<unknown>;
type ArchiveWishlistHandler = (auth: AuthContext, wishlistId: string) => Promise<unknown>;
type CreateWishlistHandler = (
	auth: AuthContext,
	input: Record<string, unknown>,
) => Promise<unknown>;
type FollowWishlistHandler = (
	auth: AuthContext,
	wishlistId: string,
) => Promise<{ followed: boolean; alreadyFollowing: boolean }>;
type GetWishlistByShortIdHandler = (
	authContext: NullableAuthContext,
	shortId: string,
) => Promise<unknown>;
type RenameRecipientHandler = (
	auth: AuthContext,
	input: { id: string; recipientName: string },
) => Promise<unknown>;
type FlipRecipientToFreeTextHandler = (
	auth: AuthContext & { user: { name?: string } },
	input: { id: string; recipientName: string },
) => Promise<unknown>;
type SetWishlistPaletteHandler = (
	auth: AuthContext,
	input: { wishlistId: string; palette: string },
) => Promise<unknown>;

const callDeleteWishlist = deleteWishlist as unknown as DeleteWishlistHandler;
const callUpdateWishlist = updateWishlist as unknown as UpdateWishlistHandler;
const callArchiveWishlist = archiveWishlist as unknown as ArchiveWishlistHandler;
const callCreateWishlist = createWishlist as unknown as CreateWishlistHandler;
const callRenameRecipient = renameRecipient as unknown as RenameRecipientHandler;
const callFlipRecipientToFreeText =
	flipRecipientToFreeText as unknown as FlipRecipientToFreeTextHandler;
const callFollowWishlist = followWishlist as unknown as FollowWishlistHandler;
const callGetWishlistByShortId = getWishlistByShortId as unknown as GetWishlistByShortIdHandler;
const callSetWishlistPalette = setWishlistPalette as unknown as SetWishlistPaletteHandler;
type RecordWishlistVisitHandler = (auth: AuthContext, wishlistId: string) => Promise<void>;
const callRecordWishlistVisit = recordWishlistVisit as unknown as RecordWishlistVisitHandler;
const callUnfollowWishlist = unfollowWishlist as unknown as RecordWishlistVisitHandler;
const callRefollowWishlist = refollowWishlist as unknown as RecordWishlistVisitHandler;
type GetHomeOverviewHandler = (userId: string) => Promise<{
	recent: unknown[];
	own: { items: Record<string, unknown>[]; total: number };
	moderated: { items: unknown[]; total: number };
	followed: { items: unknown[]; total: number };
}>;
const callGetHomeOverview = getHomeOverview as unknown as GetHomeOverviewHandler;
const createWishlistInputSchemaFixture = CreateWishlistInputSchema;
const flipRecipientToFreeTextInputSchemaFixture = FlipRecipientToFreeTextInputSchema;
const notificationTypeFixture = NOTIFICATION_TYPE;
const callGetMyWishlists = getMyWishlists as unknown as (
	auth: AuthContext,
) => Promise<Record<string, unknown>[]>;
const callGetModeratedWishlists = getModeratedWishlists as unknown as (
	auth: AuthContext,
) => Promise<Record<string, unknown>[]>;
const callGetFollowedWishlists = getFollowedWishlists as unknown as (
	auth: AuthContext,
) => Promise<Record<string, unknown>[]>;

export {
	vi,
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	mockDbInstance,
	mockDeleteObjects,
	mockDispatchNotification,
	RECIPIENT_ID,
	OTHER_USER_ID,
	MODERATOR_ID,
	WISHLIST_ID,
	WISHLIST_SHORT_ID,
	makeWishlistRow,
	makeForSomeoneWishlistRow,
	bannerAssignmentToken,
	makeRecipientAuthContext,
	makeOtherAuthContext,
	makeModeratorAuthContext,
	callDeleteWishlist,
	callUpdateWishlist,
	callArchiveWishlist,
	callCreateWishlist,
	callRenameRecipient,
	callFlipRecipientToFreeText,
	callFollowWishlist,
	callGetWishlistByShortId,
	callSetWishlistPalette,
	callGetMyWishlists,
	callGetModeratedWishlists,
	callGetFollowedWishlists,
	callUnfollowWishlist,
	callRefollowWishlist,
	callRecordWishlistVisit,
	callGetHomeOverview,
	createWishlistInputSchemaFixture,
	flipRecipientToFreeTextInputSchemaFixture,
	notificationTypeFixture,
};
