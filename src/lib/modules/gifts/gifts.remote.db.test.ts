import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { asc, and, eq, inArray } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: vi.fn() }));
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
vi.mock('$lib/server/storage/r2.js', () => ({ deleteObjectsBestEffort: vi.fn() }));
vi.mock('$lib/server/anonymous_visitor.js', () => ({ getAnonVisitorId: vi.fn(() => null) }));
vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));
vi.mock('$lib/server/remote.js', async () => {
	const v = await import('valibot');
	const wrapped = (handler: (...args: unknown[]) => unknown) => {
		(handler as unknown as { __: object }).__ = {};
		return handler;
	};
	return {
		guardedCommand: vi.fn(
			(schema: Parameters<typeof v.parse>[0], handler: (...args: unknown[]) => unknown) =>
				wrapped((auth: unknown, input: unknown) => handler(auth, v.parse(schema, input))),
		),
		guardedQueryWithArgs: vi.fn(
			(schema: Parameters<typeof v.parse>[0], handler: (...args: unknown[]) => unknown) =>
				wrapped((auth: unknown, input: unknown) => handler(auth, v.parse(schema, input))),
		),
		publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
			wrapped(handler),
		),
		singleFlightRefresh: vi.fn(),
	};
});

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { gift, giftCategory } from '$lib/server/db/gift.schema.js';
import { newGiftDigestState, notification } from '$lib/server/db/notification.schema.js';
import { bulkUpdateGifts, createGift, updateGift } from './gifts.remote.js';
import { setBulkUpdateAfterRowsLockedHookForTest } from './gifts.remote.test-hook.js';
import { importGifts, type ImportGiftsResult } from '../import/import.remote.js';
import { parseNewGiftDigestPayload } from '$lib/modules/notifications/new_gift_digest.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { BulkUpdateGiftsInput } from './types.js';

const PREFIX = `test-create-gift-remote-${Date.now()}-`;
const ACTOR_ID = `${PREFIX}actor`;
const FOLLOWER_ID = `${PREFIX}follower`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const SECOND_WISHLIST_ID = `${PREFIX}second-wishlist`;
const PRIORITY_ID = `${PREFIX}priority`;
const CATEGORY_ID = `${PREFIX}category`;
const BULK_GIFT_ONE_ID = `${PREFIX}bulk-gift-one`;
const BULK_GIFT_TWO_ID = `${PREFIX}bulk-gift-two`;
const BULK_GIFT_UNSELECTED_ID = `${PREFIX}bulk-gift-unselected`;

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().transaction(async (tx) => {
			await tx.select({ payload: notification.payload }).from(notification).limit(1);
			await tx
				.select({ userId: newGiftDigestState.userId })
				.from(newGiftDigestState)
				.limit(1);
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
type CreateGiftHandler = (
	auth: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<typeof gift.$inferSelect>;
const callCreateGift = createGift as unknown as CreateGiftHandler;
const callUpdateGift = updateGift as unknown as CreateGiftHandler;
type BulkUpdateGiftsHandler = (
	auth: { user: { id: string } },
	input: BulkUpdateGiftsInput,
) => Promise<{ updatedIds: string[] }>;
const callBulkUpdateGifts = bulkUpdateGifts as unknown as BulkUpdateGiftsHandler;
type ImportGiftsHandler = (
	auth: { user: { id: string } },
	input: {
		wishlistId: string;
		gifts: Array<{ name: string }>;
		acknowledgeDuplicates?: boolean;
	},
) => Promise<ImportGiftsResult>;
const callImportGifts = importGifts as unknown as ImportGiftsHandler;

describe.skipIf(!DB_READY)('createGift remote boundary [real DB]', () => {
	beforeAll(async () => {
		const database = getDb();
		await database.insert(user).values([
			{ id: ACTOR_ID, name: 'Gift creator', email: `${PREFIX}actor@example.com` },
			{ id: FOLLOWER_ID, name: 'Gift follower', email: `${PREFIX}follower@example.com` },
		]);
		await database.insert(wishlist).values([
			{
				id: WISHLIST_ID,
				shortId: `${PREFIX}short`,
				recipientUserId: ACTOR_ID,
				recipientName: null,
				title: 'Integrated gift creation',
				status: 'active',
			},
			{
				id: SECOND_WISHLIST_ID,
				shortId: `${PREFIX}second-short`,
				recipientUserId: ACTOR_ID,
				recipientName: null,
				title: 'Integrated gift import',
				status: 'active',
			},
		]);
		await database.insert(priorityLevel).values({
			id: PRIORITY_ID,
			wishlistId: WISHLIST_ID,
			label: 'High',
			sortOrder: 0,
		});
		await database.insert(giftCategory).values({
			id: CATEGORY_ID,
			wishlistId: WISHLIST_ID,
			customLabel: 'Gear',
			color: '#123456',
			sortOrder: 0,
		});
		await database.insert(gift).values({
			id: `${PREFIX}existing-gift`,
			wishlistId: WISHLIST_ID,
			name: 'Existing gift',
			sortOrder: 4,
		});
		await database.insert(wishlistFollower).values([
			{ wishlistId: WISHLIST_ID, userId: FOLLOWER_ID },
			{ wishlistId: SECOND_WISHLIST_ID, userId: FOLLOWER_ID },
		]);
	});

	afterAll(async () => {
		if (!DB_READY) {
			return;
		}
		await getDb()
			.delete(wishlist)
			.where(inArray(wishlist.id, [WISHLIST_ID, SECOND_WISHLIST_ID]));
		await getDb().delete(user).where(eq(user.id, FOLLOWER_ID));
		await getDb().delete(user).where(eq(user.id, ACTOR_ID));
		await closeDb();
	});

	it('rejects a signed-in non-manager at the public createGift boundary', async () => {
		await expect(
			callCreateGift(
				{ user: { id: FOLLOWER_ID } },
				{ wishlistId: WISHLIST_ID, name: 'Unauthorized gift' },
			),
		).rejects.toMatchObject({
			status: 403,
			body: { message: SERVER_ERROR.ACCESS_DENIED },
		});
		const rows = await getDb()
			.select({ id: gift.id })
			.from(gift)
			.where(eq(gift.name, 'Unauthorized gift'));
		expect(rows).toEqual([]);
	});

	it('maps archived service behavior to the stable public response without persisting', async () => {
		await getDb()
			.update(wishlist)
			.set({ status: 'archived' })
			.where(eq(wishlist.id, WISHLIST_ID));
		try {
			await expect(
				callCreateGift(
					{ user: { id: ACTOR_ID } },
					{ wishlistId: WISHLIST_ID, name: 'Archived gift' },
				),
			).rejects.toMatchObject({
				status: 400,
				body: { message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST },
			});
		} finally {
			await getDb()
				.update(wishlist)
				.set({ status: 'active' })
				.where(eq(wishlist.id, WISHLIST_ID));
		}
	});

	it('persists validated fields at append order and opens one follower digest', async () => {
		const created = await callCreateGift(
			{ user: { id: ACTOR_ID } },
			{
				wishlistId: WISHLIST_ID,
				name: 'Integrated camera',
				description: 'Mirrorless',
				links: [{ url: 'https://shop.example/camera', label: 'Shop' }],
				price: 100,
				priceMax: 120,
				currency: 'EUR',
				imageUrl: 'https://images.example/camera.jpg',
				imageMeta: { fitMode: 'contain-padded' },
				quantity: 2,
				priorityLevelId: PRIORITY_ID,
			},
		);

		const stored = await getDb().select().from(gift).where(eq(gift.id, created.id)).limit(1);
		expect(stored[0]).toMatchObject({
			wishlistId: WISHLIST_ID,
			name: 'Integrated camera',
			description: 'Mirrorless',
			links: [{ url: 'https://shop.example/camera', label: 'Shop' }],
			price: 100,
			priceMax: 120,
			currency: 'EUR',
			imageUrl: 'https://images.example/camera.jpg',
			imageMeta: { fitMode: 'contain-padded' },
			quantity: 2,
			priorityLevelId: PRIORITY_ID,
			sortOrder: 5,
		});

		const digestRows = await getDb()
			.select({
				type: notification.type,
				payload: notification.payload,
				visibleAt: notification.visibleAt,
				read: notification.read,
			})
			.from(notification)
			.where(eq(notification.userId, FOLLOWER_ID))
			.orderBy(asc(notification.createdAt));
		expect(digestRows).toHaveLength(1);
		expect(digestRows[0]).toMatchObject({
			type: NOTIFICATION_TYPE.NEW_GIFT_ADDED,
			read: false,
			payload: {
				version: 1,
				totalCount: 1,
				wishlistCount: 1,
				wishlists: [
					{
						wishlistId: WISHLIST_ID,
						count: 1,
						namePreviews: ['Integrated camera'],
					},
				],
			},
		});
		expect(digestRows[0]?.visibleAt?.getTime()).toBeGreaterThan(Date.now());

		const [state] = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		expect(state).toMatchObject({
			userId: FOLLOWER_ID,
			windowEndsAt: digestRows[0]?.visibleAt,
		});
	});

	it('persists shared-list bulk mutations for one and multiple selected gifts in and after grace', async () => {
		const database = getDb();
		const createdBeforeSharing = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const bulkGiftIds = [BULK_GIFT_ONE_ID, BULK_GIFT_TWO_ID, BULK_GIFT_UNSELECTED_ID];
		await database.insert(gift).values([
			{
				id: BULK_GIFT_ONE_ID,
				wishlistId: WISHLIST_ID,
				name: 'Bulk gift one',
				received: false,
				sortOrder: 20,
				createdAt: createdBeforeSharing,
			},
			{
				id: BULK_GIFT_TWO_ID,
				wishlistId: WISHLIST_ID,
				name: 'Bulk gift two',
				received: false,
				sortOrder: 21,
				createdAt: createdBeforeSharing,
			},
			{
				id: BULK_GIFT_UNSELECTED_ID,
				wishlistId: WISHLIST_ID,
				name: 'Bulk gift unselected',
				received: false,
				sortOrder: 22,
				createdAt: createdBeforeSharing,
			},
		]);

		const presentationActions = [
			{
				input: { action: 'priority' as const, priorityLevelId: PRIORITY_ID },
				assertPersisted: (row: typeof gift.$inferSelect) =>
					expect(row.priorityLevelId).toBe(PRIORITY_ID),
			},
			{
				input: { action: 'category' as const, categoryId: CATEGORY_ID },
				assertPersisted: (row: typeof gift.$inferSelect) =>
					expect(row.categoryId).toBe(CATEGORY_ID),
			},
			{
				input: { action: 'imageFit' as const, fit: 'fit' as const },
				assertPersisted: (row: typeof gift.$inferSelect) =>
					expect(row.imageMeta?.fitMode).toBe('contain-padded'),
			},
			{
				input: { action: 'imageBackground' as const, background: '#000000' as const },
				assertPersisted: (row: typeof gift.$inferSelect) =>
					expect(row.imageMeta?.bgColor).toBe('#000000'),
			},
		];

		try {
			for (const graceOpen of [true, false]) {
				await database
					.update(wishlist)
					.set({ sharedAt: new Date(Date.now() - (graceOpen ? 30_000 : 3 * 60_000)) })
					.where(eq(wishlist.id, WISHLIST_ID));

				for (const selectedGiftIds of [
					[BULK_GIFT_ONE_ID],
					[BULK_GIFT_ONE_ID, BULK_GIFT_TWO_ID],
				]) {
					for (const { input, assertPersisted } of presentationActions) {
						await database
							.update(gift)
							.set({
								priorityLevelId: null,
								categoryId: null,
								imageMeta: null,
								editedAfterShareAt: null,
								preEditShareSnapshot: null,
							})
							.where(inArray(gift.id, bulkGiftIds));

						const result = await callBulkUpdateGifts(
							{ user: { id: ACTOR_ID } },
							{ wishlistId: WISHLIST_ID, giftIds: selectedGiftIds, ...input },
						);
						expect(result.updatedIds).toHaveLength(selectedGiftIds.length);
						expect(result.updatedIds).toEqual(expect.arrayContaining(selectedGiftIds));

						const stored = await database
							.select()
							.from(gift)
							.where(inArray(gift.id, bulkGiftIds));
						for (const row of stored) {
							if (selectedGiftIds.includes(row.id)) {
								assertPersisted(row);
								expect(row.editedAfterShareAt).toBeInstanceOf(Date);
								expect(row.preEditShareSnapshot === null).toBe(!graceOpen);
							} else {
								expect(row).toMatchObject({
									priorityLevelId: null,
									categoryId: null,
									imageMeta: null,
									editedAfterShareAt: null,
									preEditShareSnapshot: null,
								});
							}
						}
					}
				}
			}

			for (const selectedGiftIds of [
				[BULK_GIFT_ONE_ID],
				[BULK_GIFT_ONE_ID, BULK_GIFT_TWO_ID],
			]) {
				await database
					.update(gift)
					.set({ received: false, editedAfterShareAt: null, preEditShareSnapshot: null })
					.where(inArray(gift.id, bulkGiftIds));
				await callBulkUpdateGifts(
					{ user: { id: ACTOR_ID } },
					{
						wishlistId: WISHLIST_ID,
						giftIds: selectedGiftIds,
						action: 'received',
						received: true,
					},
				);
				const stored = await database
					.select()
					.from(gift)
					.where(inArray(gift.id, bulkGiftIds));
				for (const row of stored) {
					expect(row.received).toBe(selectedGiftIds.includes(row.id));
					expect(row.editedAfterShareAt).toBeNull();
				}
			}
		} finally {
			await database.delete(gift).where(inArray(gift.id, bulkGiftIds));
			await database
				.update(wishlist)
				.set({ sharedAt: null })
				.where(eq(wishlist.id, WISHLIST_ID));
		}
	});

	it('rolls back every shared-list presentation update when one locked gift disappears', async () => {
		const database = getDb();
		const createdBeforeSharing = new Date(Date.now() - 24 * 60 * 60 * 1000);
		await database
			.update(wishlist)
			.set({ sharedAt: new Date(Date.now() - 3 * 60_000) })
			.where(eq(wishlist.id, WISHLIST_ID));
		await database.insert(gift).values([
			{
				id: BULK_GIFT_ONE_ID,
				wishlistId: WISHLIST_ID,
				name: 'Bulk gift one',
				priorityLevelId: null,
				sortOrder: 20,
				createdAt: createdBeforeSharing,
			},
			{
				id: BULK_GIFT_TWO_ID,
				wishlistId: WISHLIST_ID,
				name: 'Bulk gift two',
				priorityLevelId: null,
				sortOrder: 21,
				createdAt: createdBeforeSharing,
			},
		]);
		setBulkUpdateAfterRowsLockedHookForTest(async (tx) => {
			await tx.delete(gift).where(eq(gift.id, BULK_GIFT_TWO_ID));
		});
		try {
			await expect(
				callBulkUpdateGifts(
					{ user: { id: ACTOR_ID } },
					{
						wishlistId: WISHLIST_ID,
						giftIds: [BULK_GIFT_ONE_ID, BULK_GIFT_TWO_ID],
						action: 'priority',
						priorityLevelId: PRIORITY_ID,
					},
				),
			).rejects.toMatchObject({
				status: 400,
				body: { message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH },
			});
		} finally {
			setBulkUpdateAfterRowsLockedHookForTest(undefined);
		}

		const stored = await database
			.select({
				id: gift.id,
				priorityLevelId: gift.priorityLevelId,
				editedAfterShareAt: gift.editedAfterShareAt,
			})
			.from(gift)
			.where(inArray(gift.id, [BULK_GIFT_ONE_ID, BULK_GIFT_TWO_ID]))
			.orderBy(asc(gift.id));
		expect(stored).toEqual([
			{ id: BULK_GIFT_ONE_ID, priorityLevelId: null, editedAfterShareAt: null },
			{ id: BULK_GIFT_TWO_ID, priorityLevelId: null, editedAfterShareAt: null },
		]);
		await database.update(wishlist).set({ sharedAt: null }).where(eq(wishlist.id, WISHLIST_ID));
	});

	it('round-trips decimal single and range prices through create and update', async () => {
		const single = await callCreateGift(
			{ user: { id: ACTOR_ID } },
			{ wishlistId: WISHLIST_ID, name: 'Decimal single', price: 49.9, currency: 'EUR' },
		);
		let [stored] = await getDb().select().from(gift).where(eq(gift.id, single.id));
		expect(stored).toMatchObject({ price: 49.9, priceMax: null });

		await callUpdateGift(
			{ user: { id: ACTOR_ID } },
			{ id: single.id, price: 19.95, priceMax: 29.99 },
		);
		[stored] = await getDb().select().from(gift).where(eq(gift.id, single.id));
		expect(stored).toMatchObject({ price: 19.95, priceMax: 29.99 });
	});

	it('coalesces create and import gifts across wishlists into one recipient-global digest', async () => {
		const database = getDb();
		await database.delete(newGiftDigestState).where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		await database.delete(notification).where(eq(notification.userId, FOLLOWER_ID));

		await callCreateGift(
			{ user: { id: ACTOR_ID } },
			{ wishlistId: WISHLIST_ID, name: 'Cross-path camera' },
		);
		const imported = await callImportGifts(
			{ user: { id: ACTOR_ID } },
			{
				wishlistId: SECOND_WISHLIST_ID,
				gifts: [{ name: 'Cross-path book' }],
			},
		);
		expect(imported.status).toBe('created');

		const states = await database
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		const notifications = await database
			.select()
			.from(notification)
			.where(
				and(
					eq(notification.userId, FOLLOWER_ID),
					eq(notification.type, NOTIFICATION_TYPE.NEW_GIFT_ADDED),
				),
			);
		expect(states).toHaveLength(1);
		expect(notifications).toHaveLength(1);
		expect(states[0]).toMatchObject({
			userId: FOLLOWER_ID,
			activeNotificationId: notifications[0]!.id,
		});

		const payload = parseNewGiftDigestPayload(notifications[0]!.payload);
		expect(payload).not.toBeNull();
		expect(payload).toMatchObject({ totalCount: 2, wishlistCount: 2 });
		expect(payload!.wishlists).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					wishlistId: WISHLIST_ID,
					title: 'Integrated gift creation',
					count: 1,
					namePreviews: ['Cross-path camera'],
				}),
				expect.objectContaining({
					wishlistId: SECOND_WISHLIST_ID,
					title: 'Integrated gift import',
					count: 1,
					namePreviews: ['Cross-path book'],
				}),
			]),
		);
		// The state table is keyed by recipient, so both wishlist entries roll into this one row.
		expect(states.map((state) => state.userId)).toEqual([FOLLOWER_ID]);
	});
});
