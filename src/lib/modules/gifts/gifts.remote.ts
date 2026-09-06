import * as v from 'valibot';
import { eq, and, isNull, sql, count as drizzleCount, inArray, ne, or } from 'drizzle-orm';
import { error, isHttpError } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftCategory, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import {
	publicQuery,
	guardedCommand,
	guardedQueryWithArgs,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { getAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import {
	verifyManagerAccess,
	assertWishlistMutable,
	resolveWishlistRole,
} from '$lib/modules/wishlists/wishlist_access.js';
import {
	hidesReservationState,
	canSeeReserverNames,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CreateGiftInputSchema,
	UpdateGiftInputSchema,
	ReorderGiftItemSchema,
	MarkGiftReceivedInputSchema,
	BulkUpdateGiftsInputSchema,
	isPriceRangeValid,
	type GiftForRecipient,
	type GiftForVisitor,
} from './types.js';
import { normalizeGiftLinks } from './gift_url.js';
import {
	computePreShareOwnerEdit,
	computePostShareEditTransparency,
	toPreShareGiftSnapshot,
	jsonChanged,
} from './gift_post_share.js';
import {
	isOwnerSharedGiftDeleteGraceOpen,
	isPreShareOwnerFullEditGraceOpen,
} from './gift_deletion_rules.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { appendGifts } from './gift_creation_service.js';
import { mapGiftCreationError } from './gift_creation_transport.js';
import { bulkGiftUpdateData, isBulkPresentationAction } from './gift_bulk_update.js';
import { runBulkUpdateAfterRowsLockedHookForTest } from './gifts.remote.test-hook.js';
import { BulkCopyGiftsInputSchema, copyGifts } from './gift_bulk_copy.js';
import {
	assertActiveGiftCategoryAssignment,
	publicGiftCategory,
} from '$lib/modules/gift-categories/gift_categories_service.js';

export const getGiftsByWishlistShortId = publicQuery(v.string(), async (authContext, shortId) => {
	const database = getDb();

	// Find wishlist
	const wishlistRows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}

	// Determine role
	const role: WishlistRole = await resolveWishlistRole(authContext, wishlistRow);

	// Fetch gifts with priority/category info
	const giftRows = await database
		.select({
			id: gift.id,
			wishlistId: gift.wishlistId,
			name: gift.name,
			description: gift.description,
			descriptionAppends: gift.descriptionAppends,
			editedAfterShareAt: gift.editedAfterShareAt,
			links: gift.links,
			price: gift.price,
			priceMax: gift.priceMax,
			currency: gift.currency,
			imageUrl: gift.imageUrl,
			imageKey: gift.imageKey,
			imageMeta: gift.imageMeta,
			quantity: gift.quantity,
			sortOrder: gift.sortOrder,
			received: gift.received,
			createdAt: gift.createdAt,
			priorityLevelId: gift.priorityLevelId,
			priorityLabel: priorityLevel.label,
			prioritySortOrder: priorityLevel.sortOrder,
			categoryId: gift.categoryId,
			categoryPresetKey: giftCategory.presetKey,
			categoryCustomLabel: giftCategory.customLabel,
			categoryColor: giftCategory.color,
			categorySortOrder: giftCategory.sortOrder,
		})
		.from(gift)
		.leftJoin(priorityLevel, eq(gift.priorityLevelId, priorityLevel.id))
		.leftJoin(
			giftCategory,
			and(
				eq(gift.categoryId, giftCategory.id),
				eq(gift.wishlistId, giftCategory.wishlistId),
				isNull(giftCategory.deletedAt),
			),
		)
		.where(and(eq(gift.wishlistId, wishlistRow.id), isNull(gift.deletedAt)))
		.orderBy(gift.sortOrder);

	const giftCategoryForRow = (row: (typeof giftRows)[number]) =>
		row.categoryId === null ||
		(row.categoryPresetKey === null && row.categoryCustomLabel === null)
			? null
			: publicGiftCategory({
					id: row.categoryId,
					wishlistId: wishlistRow.id,
					presetKey: row.categoryPresetKey,
					customLabel: row.categoryCustomLabel,
					color: row.categoryColor!,
					sortOrder: row.categorySortOrder ?? 0,
					deletedAt: null,
					createdAt: new Date(0),
					updatedAt: new Date(0),
				});

	if (hidesReservationState(role, wishlistRow.recipientIsModerator)) {
		// Recipient without self-promote: no reservation data, no like counts (protects the surprise)
		const recipientGifts: GiftForRecipient[] = giftRows.map((row) => ({
			id: row.id,
			wishlistId: row.wishlistId,
			name: row.name,
			description: row.description,
			descriptionAppends: row.descriptionAppends,
			editedAfterShareAt: row.editedAfterShareAt,
			links: row.links,
			price: row.price,
			priceMax: row.priceMax,
			currency: row.currency,
			imageUrl: row.imageUrl,
			imageKey: row.imageKey,
			imageMeta: row.imageMeta,
			quantity: row.quantity,
			sortOrder: row.sortOrder,
			received: row.received,
			createdAt: row.createdAt,
			priorityLevelId: row.priorityLevelId,
			priorityLabel: row.priorityLabel,
			prioritySortOrder: row.prioritySortOrder,
			categoryId: row.categoryId ?? null,
			category: giftCategoryForRow(row),
		}));

		return { role, gifts: recipientGifts } as const;
	}

	// Visitor/Moderator: include reservation counts and like counts
	const giftIds = giftRows.map((row) => row.id);

	// Batch fetch active reservations with reserver display names (scoped to this
	// wishlist's gifts): account name for authenticated reservers, the signed
	// anonymous name otherwise. Counts and names derive from the same rows so they
	// can never disagree — names are only EMITTED to moderators (issue #198) via
	// the canSeeReserverNames gate below; every other non-recipient viewer (visitor,
	// self-promoted recipient) still sees counts derived from these same rows.
	const reservationCounts = new Map<string, number>();
	const reserverNamesByGiftId = new Map<string, string[]>();
	if (giftIds.length > 0) {
		const reservationRows = await database
			.select({
				giftId: reservation.giftId,
				quantity: reservation.quantity,
				reserverName: sql<
					string | null
				>`COALESCE(${user.name}, ${reservation.anonymousName})`,
			})
			.from(reservation)
			.leftJoin(user, eq(reservation.userId, user.id))
			.where(and(inArray(reservation.giftId, giftIds), isNull(reservation.deletedAt)))
			.orderBy(reservation.createdAt);

		for (const row of reservationRows) {
			reservationCounts.set(
				row.giftId,
				(reservationCounts.get(row.giftId) ?? 0) + Number(row.quantity),
			);
			if (row.reserverName !== null && row.reserverName.trim() !== '') {
				const names = reserverNamesByGiftId.get(row.giftId);
				if (names === undefined) {
					reserverNamesByGiftId.set(row.giftId, [row.reserverName]);
				} else if (!names.includes(row.reserverName)) {
					names.push(row.reserverName);
				}
			}
		}
	}

	// Batch fetch like counts (scoped to this wishlist's gifts)
	const likeCounts = new Map<string, number>();
	if (giftIds.length > 0) {
		const lkCounts = await database
			.select({
				giftId: giftLike.giftId,
				count: drizzleCount(),
			})
			.from(giftLike)
			.where(and(inArray(giftLike.giftId, giftIds), isNull(giftLike.deletedAt)))
			.groupBy(giftLike.giftId);

		for (const row of lkCounts) {
			likeCounts.set(row.giftId, Number(row.count));
		}
	}

	// Batch fetch the current visitor's active reservation per gift (powers the unreserve UI).
	// Authenticated visitors match by userId; anonymous visitors match by their per-browser
	// capability cookie against reservation.anonymousVisitorId.
	const myReservations = new Map<string, { id: string; purchasedAt: Date | null }>();
	if (giftIds.length > 0) {
		const anonVisitorId = authContext === null ? getAnonVisitorId() : null;
		const ownershipFilter =
			authContext !== null
				? eq(reservation.userId, authContext.user.id)
				: anonVisitorId !== null
					? and(
							isNull(reservation.userId),
							eq(reservation.anonymousVisitorId, anonVisitorId),
						)
					: null;

		if (ownershipFilter !== undefined && ownershipFilter !== null) {
			const myRows = await database
				.select({
					id: reservation.id,
					giftId: reservation.giftId,
					purchasedAt: reservation.purchasedAt,
				})
				.from(reservation)
				.where(
					and(
						inArray(reservation.giftId, giftIds),
						ownershipFilter,
						isNull(reservation.deletedAt),
					),
				)
				.orderBy(reservation.createdAt);

			for (const row of myRows) {
				// Keep the earliest active reservation per gift
				if (!myReservations.has(row.giftId)) {
					myReservations.set(row.giftId, { id: row.id, purchasedAt: row.purchasedAt });
				}
			}
		}
	}

	const includeReserverNames = canSeeReserverNames(role);

	const visitorGifts: GiftForVisitor[] = giftRows.map((row) => {
		const qty = row.quantity ?? 1;
		const reserved = reservationCounts.get(row.id) ?? 0;
		return {
			id: row.id,
			wishlistId: row.wishlistId,
			name: row.name,
			description: row.description,
			descriptionAppends: row.descriptionAppends,
			editedAfterShareAt: row.editedAfterShareAt,
			links: row.links,
			price: row.price,
			priceMax: row.priceMax,
			currency: row.currency,
			imageUrl: row.imageUrl,
			imageKey: row.imageKey,
			imageMeta: row.imageMeta,
			quantity: row.quantity,
			sortOrder: row.sortOrder,
			received: row.received,
			createdAt: row.createdAt,
			priorityLevelId: row.priorityLevelId,
			priorityLabel: row.priorityLabel,
			prioritySortOrder: row.prioritySortOrder,
			categoryId: row.categoryId ?? null,
			category: giftCategoryForRow(row),
			likeCount: likeCounts.get(row.id) ?? 0,
			reservedCount: reserved,
			isFullyReserved: reserved >= qty,
			reserverNames: includeReserverNames ? (reserverNamesByGiftId.get(row.id) ?? []) : [],
			myReservationId: myReservations.get(row.id)?.id ?? null,
			myReservationPurchasedAt: myReservations.get(row.id)?.purchasedAt ?? null,
		};
	});

	return { role, gifts: visitorGifts } as const;
});

// ── Commands ────────────────────────────────────────────────────────────────

export const createGift = guardedCommand(CreateGiftInputSchema, async ({ user }, input) => {
	const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
	assertWishlistMutable(wishlistRow);

	let created: typeof gift.$inferSelect | undefined;
	try {
		[created] = await appendGifts({
			wishlistId: input.wishlistId,
			actorId: user.id,
			gifts: [input],
		});
	} catch (thrown) {
		mapGiftCreationError(thrown);
	}

	if (created === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
	}

	// Single-flight refresh (issue #108, REQ-3/4): only the gift list rides back —
	// wishlist metadata, likes, and dashboards are not invalidated by a new gift.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);

	return created;
});

/**
 * Root of the "Upraveno po sdílení" transparency tracking (issue #124): given a changed gift edit,
 * decides the next `editedAfterShareAt` / `preEditShareSnapshot` values and writes them onto
 * `updateData`. Shared by both `updateGift` write paths (per-field pre-share engine and the
 * general full-write path) so the net-zero revert behaves identically regardless of role or
 * which fields were editable.
 */
function applyPostShareEditTransparency(params: {
	giftRow: typeof gift.$inferSelect;
	updateData: Partial<typeof gift.$inferInsert>;
	now: Date;
	wishlistRow: typeof wishlist.$inferSelect;
}): void {
	const { giftRow, updateData, now, wishlistRow } = params;

	const graceOpen = isOwnerSharedGiftDeleteGraceOpen(
		{ wishlistSharedAt: wishlistRow.sharedAt, giftCreatedAt: giftRow.createdAt },
		now,
	);
	const beforeEdit = toPreShareGiftSnapshot(giftRow);
	const afterEdit = toPreShareGiftSnapshot({ ...giftRow, ...updateData });

	const outcome = computePostShareEditTransparency({
		existingSnapshot: giftRow.preEditShareSnapshot,
		graceOpen,
		beforeEdit,
		afterEdit,
		now,
	});

	updateData.editedAfterShareAt = outcome.editedAfterShareAt;
	updateData.preEditShareSnapshot = outcome.preEditShareSnapshot;
}

const NOTIFICATION_DISPATCH_CONCURRENCY = 4;

async function notifyReserversOfEditedGifts(params: {
	database: ReturnType<typeof getDb>;
	changedGifts: Array<{ id: string; wishlistId: string; name: string }>;
	actorId: string;
	actorName: string;
	wishlist: { title: string; shortId: string };
}): Promise<void> {
	const { database, changedGifts, actorId, actorName, wishlist } = params;
	if (changedGifts.length === 0) {
		return;
	}

	const reservationRows = await database
		.select({
			giftId: reservation.giftId,
			userId: reservation.userId,
			anonymousEmail: reservation.anonymousEmail,
		})
		.from(reservation)
		.where(
			and(
				inArray(
					reservation.giftId,
					changedGifts.map((giftItem) => giftItem.id),
				),
				isNull(reservation.deletedAt),
			),
		);

	const reservationsByGiftId = new Map<
		string,
		Array<{ userId: string | null; anonymousEmail: string | null }>
	>();
	for (const row of reservationRows) {
		const rows = reservationsByGiftId.get(row.giftId);
		if (rows === undefined) {
			reservationsByGiftId.set(row.giftId, [row]);
		} else {
			rows.push(row);
		}
	}

	let nextGiftIndex = 0;
	let firstFailure: unknown;
	const dispatchNext = async (): Promise<void> => {
		while (nextGiftIndex < changedGifts.length) {
			const changedGift = changedGifts[nextGiftIndex++];
			if (changedGift === undefined) {
				return;
			}
			const targets = reservationsByGiftId.get(changedGift.id) ?? [];
			try {
				await dispatchNotification({
					type: NOTIFICATION_TYPE.RESERVED_GIFT_EDITED,
					targetUserIds: targets
						.map((row) => row.userId)
						.filter(
							(userId): userId is string => userId !== null && userId !== actorId,
						),
					targetEmails: targets
						.map((row) => row.anonymousEmail)
						.filter((email): email is string => email !== null && email !== ''),
					wishlistId: changedGift.wishlistId,
					giftId: changedGift.id,
					giftName: changedGift.name,
					actorId,
					actorName,
					wishlist,
				});
			} catch (thrown) {
				firstFailure ??= thrown;
			}
		}
	};

	await Promise.all(
		Array.from(
			{ length: Math.min(NOTIFICATION_DISPATCH_CONCURRENCY, changedGifts.length) },
			dispatchNext,
		),
	);
	if (firstFailure !== undefined) {
		throw firstFailure;
	}
}

async function notifyReserversOfEditedGiftsBestEffort(
	params: Parameters<typeof notifyReserversOfEditedGifts>[0],
): Promise<void> {
	try {
		await notifyReserversOfEditedGifts(params);
	} catch (thrown) {
		console.error('[Notification] reserver edit notification failed', thrown);
	}
}

export const updateGift = guardedCommand(UpdateGiftInputSchema, async ({ user }, input) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, input.id), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	const { role, wishlistRow } = await verifyManagerAccess(user.id, giftRow.wishlistId);
	assertWishlistMutable(wishlistRow);

	// Cross-field guard on the MERGED row (issue #155): the wire schema only validates bounds present
	// in the same payload, so a partial update carrying one bound must not invert the persisted range.
	const mergedPrice = input.price !== undefined ? input.price : giftRow.price;
	const mergedPriceMax = input.priceMax !== undefined ? input.priceMax : giftRow.priceMax;
	if (!isPriceRangeValid({ price: mergedPrice, priceMax: mergedPriceMax })) {
		error(400, SERVER_ERROR.INVALID_PRICE_RANGE);
	}

	const now = new Date();
	const isShared = wishlistRow.sharedAt !== null;
	const isPreShareGift = isShared && giftRow.createdAt <= wishlistRow.sharedAt!;
	// Within the initial 2-minute share grace window the recipient regains full edit. Later edits
	// deliberately do not reopen name or delete grace.
	const shareGraceOpen = isPreShareOwnerFullEditGraceOpen(
		{
			wishlistSharedAt: wishlistRow.sharedAt,
			giftCreatedAt: giftRow.createdAt,
		},
		now,
	);
	// The recipient editing a pre-share gift once the grace window has closed follows the per-field
	// rules (REQ-4/5): name is locked, quantity may only rise, description edits accrue as appends —
	// these protect gifters from the surprise-blind recipient. Správci (moderators), recipient edits
	// to post-share-created gifts, and in-window edits fall through to the full per-field write below.
	// A targeted segment edit (`descriptionAppendEdit`, issue #83) is always routed through the engine
	// – it carries its own per-segment window check that the full-write path cannot enforce – so it
	// stays validated even while the share window is open.
	const isPreShareRecipientEdit =
		role === WISHLIST_ROLES.recipient &&
		isPreShareGift &&
		(!shareGraceOpen || input.descriptionAppendEdit !== undefined);

	if (isPreShareRecipientEdit) {
		const outcome = computePreShareOwnerEdit(giftRow, input, now);
		if (outcome.rejection !== null) {
			error(outcome.rejection.status, outcome.rejection.code);
		}

		const updateData: Partial<typeof gift.$inferInsert> = {
			...outcome.updateData,
			updatedAt: now,
		};
		if (outcome.changed) {
			applyPostShareEditTransparency({ giftRow, updateData, now, wishlistRow });
		}

		const updated = await database.transaction(async (tx) => {
			if (input.categoryId !== undefined && updateData.categoryId !== undefined) {
				updateData.categoryId = await assertActiveGiftCategoryAssignment(
					tx,
					giftRow.wishlistId,
					input.categoryId,
				);
			}
			const [row] = await tx
				.update(gift)
				.set(updateData)
				.where(eq(gift.id, input.id))
				.returning();
			return row;
		});

		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);

		return updated;
	}

	const updateData: Partial<typeof gift.$inferInsert> = { updatedAt: now };
	let didChange = false;

	if (input.name !== undefined && input.name !== giftRow.name) {
		updateData.name = input.name;
		didChange = true;
	}
	if (input.description !== undefined && input.description !== giftRow.description) {
		updateData.description = input.description;
		didChange = true;
	}
	if (input.links !== undefined) {
		const normalized = normalizeGiftLinks(input.links);
		if (jsonChanged(normalized, giftRow.links)) {
			updateData.links = normalized;
			didChange = true;
		}
	}
	if (input.price !== undefined && input.price !== giftRow.price) {
		updateData.price = input.price;
		didChange = true;
	}
	if (input.priceMax !== undefined && input.priceMax !== giftRow.priceMax) {
		updateData.priceMax = input.priceMax;
		didChange = true;
	}
	if (input.currency !== undefined && input.currency !== giftRow.currency) {
		updateData.currency = input.currency;
		didChange = true;
	}
	if (input.imageUrl !== undefined && input.imageUrl !== giftRow.imageUrl) {
		updateData.imageUrl = input.imageUrl;
		didChange = true;
	}
	if (input.imageKey !== undefined && input.imageKey !== giftRow.imageKey) {
		updateData.imageKey = input.imageKey;
		didChange = true;
	}
	if (input.imageMeta !== undefined && jsonChanged(input.imageMeta, giftRow.imageMeta)) {
		updateData.imageMeta = input.imageMeta;
		didChange = true;
	}
	if (input.quantity !== undefined && input.quantity !== giftRow.quantity) {
		updateData.quantity = input.quantity;
		didChange = true;
	}
	if (input.priorityLevelId !== undefined && input.priorityLevelId !== giftRow.priorityLevelId) {
		updateData.priorityLevelId = input.priorityLevelId;
		didChange = true;
	}
	if (input.categoryId !== undefined && input.categoryId !== giftRow.categoryId) {
		updateData.categoryId = input.categoryId;
		didChange = true;
	}

	// Transparency: any post-share edit (moderator, or recipient on a post-share-created gift) that
	// actually changes a field flags the gift as edited after sharing (REQ-6), unless it nets out to
	// a byte-identical revert within the post-share grace window (REQ-1/2, issue #124).
	if (isShared && didChange) {
		applyPostShareEditTransparency({ giftRow, updateData, now, wishlistRow });
	}

	const updated = await database.transaction(async (tx) => {
		if (input.categoryId !== undefined && input.categoryId !== giftRow.categoryId) {
			updateData.categoryId = await assertActiveGiftCategoryAssignment(
				tx,
				giftRow.wishlistId,
				input.categoryId,
			);
		}
		const [row] = await tx
			.update(gift)
			.set(updateData)
			.where(eq(gift.id, input.id))
			.returning();
		return row;
	});

	// Storage cleanup (issue #107, REQ-6): replacing or removing an uploaded
	// image leaves no unreferenced R2 object behind.
	if (
		updated !== undefined &&
		updateData.imageKey !== undefined &&
		giftRow.imageKey !== null &&
		giftRow.imageKey !== updateData.imageKey
	) {
		await deleteObjectsBestEffort([giftRow.imageKey]);
	}

	if (updated !== undefined && role === WISHLIST_ROLES.moderator && didChange) {
		await notifyReserversOfEditedGiftsBestEffort({
			database,
			changedGifts: [
				{
					id: input.id,
					wishlistId: giftRow.wishlistId,
					name: updated?.name ?? giftRow.name,
				},
			],
			actorId: user.id,
			actorName: user.name,
			wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
		});
	}

	// Single-flight refresh (issue #108, REQ-3/4): only the gift list rides back.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);

	return updated;
});

export const deleteGift = guardedCommand(v.string(), async ({ user }, giftId) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	const { role, wishlistRow } = await verifyManagerAccess(user.id, giftRow.wishlistId);
	assertWishlistMutable(wishlistRow);

	// Delete lock: recipient delete on shared wishlists is limited to the initial share grace for
	// pre-share gifts, or the creation grace for gifts added after sharing. Later edits do not reopen it.
	// Správci (moderators) are exempt — they see reservation state, so no inference leak to guard.
	const now = new Date();
	const isShared = wishlistRow.sharedAt !== null;
	if (role === WISHLIST_ROLES.recipient && isShared) {
		const deleteGraceOpen = isOwnerSharedGiftDeleteGraceOpen(
			{
				wishlistSharedAt: wishlistRow.sharedAt,
				giftCreatedAt: giftRow.createdAt,
			},
			now,
		);
		if (!deleteGraceOpen) {
			error(403, SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);
		}
	}

	// Cannot delete reserved gifts
	const reservationRows = await database
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.limit(1);

	if (reservationRows[0] !== undefined) {
		error(400, SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);
	}

	// Soft delete
	await database.update(gift).set({ deletedAt: now, updatedAt: now }).where(eq(gift.id, giftId));

	// Storage cleanup (issue #107, REQ-6): the uploaded image is unreachable
	// once the gift is deleted (no restore path exists) – drop the object.
	await deleteObjectsBestEffort([giftRow.imageKey]);

	// Single-flight refresh (issue #108, REQ-3/4): only the gift list rides back.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
});

export const reorderGifts = guardedCommand(
	v.array(ReorderGiftItemSchema),
	async ({ user }, items) => {
		if (items.length === 0) {
			return;
		}

		const database = getDb();

		// Get the wishlistId from the first gift
		const firstGiftRows = await database
			.select({ wishlistId: gift.wishlistId })
			.from(gift)
			.where(eq(gift.id, items[0]!.id))
			.limit(1);

		const firstGift = firstGiftRows[0];
		if (firstGift === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		const { wishlistRow } = await verifyManagerAccess(user.id, firstGift.wishlistId);
		assertWishlistMutable(wishlistRow);

		const uniqueGiftIds = [...new Set(items.map((item) => item.id))];
		const reorderedGiftRows = await database
			.select({ id: gift.id, wishlistId: gift.wishlistId })
			.from(gift)
			.where(and(inArray(gift.id, uniqueGiftIds), isNull(gift.deletedAt)));

		if (
			reorderedGiftRows.length !== uniqueGiftIds.length ||
			reorderedGiftRows.some((row) => row.wishlistId !== firstGift.wishlistId) === true
		) {
			error(403, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
		}

		// Batch update sortOrder in a single CASE WHEN statement
		const now = new Date();
		const sortOrderCase = sql.join(
			items.map((item) => sql`WHEN ${gift.id} = ${item.id} THEN ${item.sortOrder}::integer`),
			sql` `,
		);
		await database
			.update(gift)
			.set({
				sortOrder: sql<number>`CASE ${sortOrderCase} END`,
				updatedAt: now,
			})
			.where(
				and(
					inArray(
						gift.id,
						items.map((item) => item.id),
					),
					eq(gift.wishlistId, firstGift.wishlistId),
					isNull(gift.deletedAt),
				),
			);
	},
);

function bulkJsonbValue(value: unknown) {
	return value === null ? sql`NULL::jsonb` : sql`${JSON.stringify(value)}::jsonb`;
}

function bulkTimestampValue(value: Date | null) {
	return value === null ? sql`NULL::timestamptz` : sql`${value.toISOString()}::timestamptz`;
}

type GiftTransaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function verifyBulkManagerAccess(
	transaction: GiftTransaction,
	userId: string,
	wishlistId: string,
) {
	const wishlistRows = await transaction
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.for('update');
	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}

	if (wishlistRow.recipientUserId === userId) {
		return { role: WISHLIST_ROLES.recipient, wishlistRow };
	}

	const assignments = await transaction
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.for('update');
	if (assignments[0] === undefined) {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}
	return { role: WISHLIST_ROLES.moderator, wishlistRow };
}

export const bulkUpdateGifts = guardedCommand(
	BulkUpdateGiftsInputSchema,
	async ({ user }, input) => {
		const database = getDb();
		const uniqueGiftIds = [...new Set(input.giftIds)];

		const result = await database.transaction(async (tx) => {
			const { role, wishlistRow } = await verifyBulkManagerAccess(
				tx,
				user.id,
				input.wishlistId,
			);
			assertWishlistMutable(wishlistRow);
			if (input.action === 'priority' && input.priorityLevelId !== null) {
				const levels = await tx
					.select({ id: priorityLevel.id })
					.from(priorityLevel)
					.where(
						and(
							eq(priorityLevel.id, input.priorityLevelId),
							eq(priorityLevel.wishlistId, input.wishlistId),
						),
					)
					.for('key share');
				if (levels[0] === undefined) {
					error(400, SERVER_ERROR.GIFT_PRIORITY_WISHLIST_MISMATCH);
				}
			}
			if (input.action === 'category') {
				await assertActiveGiftCategoryAssignment(tx, input.wishlistId, input.categoryId);
			}

			const rows = await tx
				.select()
				.from(gift)
				.where(
					and(
						inArray(gift.id, uniqueGiftIds),
						eq(gift.wishlistId, input.wishlistId),
						isNull(gift.deletedAt),
					),
				)
				.for('update');
			if (rows.length !== uniqueGiftIds.length) {
				error(400, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
			}
			if (
				input.action === 'restoreReceived' &&
				uniqueGiftIds.some((id) => input.states[id] === undefined)
			) {
				error(400, SERVER_ERROR.BULK_GIFT_STATE_MISMATCH);
			}

			const updatedAt = new Date();
			const updatePlans = rows.map((row) => {
				const updateData: Partial<typeof gift.$inferInsert> = bulkGiftUpdateData(
					input,
					row,
				);
				const didChange = Object.entries(updateData).some(([key, value]) =>
					jsonChanged(value, row[key as keyof typeof row]),
				);
				if (didChange && isBulkPresentationAction(input) && wishlistRow.sharedAt !== null) {
					applyPostShareEditTransparency({
						giftRow: row,
						updateData,
						now: updatedAt,
						wishlistRow,
					});
				}
				return { row, updateData, didChange };
			});
			const changedPresentationRows = updatePlans
				.filter((plan) => plan.didChange && isBulkPresentationAction(input))
				.map((plan) => plan.row);

			const updateSet: Record<string, unknown> = { updatedAt };
			switch (input.action) {
				case 'priority':
					updateSet.priorityLevelId = input.priorityLevelId;
					break;
				case 'category':
					updateSet.categoryId = input.categoryId;
					break;
				case 'received':
					updateSet.received = input.received;
					break;
				case 'restoreReceived': {
					const receivedCase = sql.join(
						updatePlans.map(
							(plan) =>
								sql`WHEN ${gift.id} = ${plan.row.id} THEN ${plan.updateData.received ?? false}::boolean`,
						),
						sql` `,
					);
					updateSet.received = sql<boolean>`CASE ${receivedCase} ELSE ${gift.received} END`;
					break;
				}
				case 'imageFit':
				case 'imageBackground': {
					const imageMetaCase = sql.join(
						updatePlans.map(
							(plan) =>
								sql`WHEN ${gift.id} = ${plan.row.id} THEN ${bulkJsonbValue(plan.updateData.imageMeta ?? null)}`,
						),
						sql` `,
					);
					updateSet.imageMeta = sql`CASE ${imageMetaCase} ELSE ${gift.imageMeta} END`;
					break;
				}
			}

			if (changedPresentationRows.length > 0 && wishlistRow.sharedAt !== null) {
				const changedPlans = updatePlans.filter(
					(plan) => plan.didChange && isBulkPresentationAction(input),
				);
				const editedAfterShareCase = sql.join(
					changedPlans.map(
						(plan) =>
							sql`WHEN ${gift.id} = ${plan.row.id} THEN ${bulkTimestampValue(
								('editedAfterShareAt' in plan.updateData
									? (plan.updateData.editedAfterShareAt as Date | null)
									: plan.row.editedAfterShareAt) ?? null,
							)}`,
					),
					sql` `,
				);
				const preEditShareSnapshotCase = sql.join(
					changedPlans.map(
						(plan) =>
							sql`WHEN ${gift.id} = ${plan.row.id} THEN ${bulkJsonbValue(
								'preEditShareSnapshot' in plan.updateData
									? plan.updateData.preEditShareSnapshot
									: plan.row.preEditShareSnapshot,
							)}`,
					),
					sql` `,
				);
				updateSet.editedAfterShareAt = sql<Date | null>`CASE ${editedAfterShareCase} ELSE ${gift.editedAfterShareAt} END`;
				updateSet.preEditShareSnapshot = sql`CASE ${preEditShareSnapshotCase} ELSE ${gift.preEditShareSnapshot} END`;
			}

			await runBulkUpdateAfterRowsLockedHookForTest(tx);

			const updatedRows = await tx
				.update(gift)
				.set(updateSet)
				.where(
					and(
						inArray(gift.id, uniqueGiftIds),
						eq(gift.wishlistId, input.wishlistId),
						isNull(gift.deletedAt),
					),
				)
				.returning({ id: gift.id });
			const updatedIdSet = new Set(updatedRows.map((row) => row.id));
			if (
				updatedRows.length !== uniqueGiftIds.length ||
				updatedIdSet.size !== uniqueGiftIds.length ||
				uniqueGiftIds.some((id) => !updatedIdSet.has(id))
			) {
				error(400, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
			}

			return {
				updatedIds: updatedRows.map((row) => row.id),
				priorReceived: Object.fromEntries(rows.map((row) => [row.id, row.received])),
				changedPresentationRows,
				role,
				wishlistRow,
			};
		});

		if (result.role === WISHLIST_ROLES.moderator) {
			await notifyReserversOfEditedGiftsBestEffort({
				database,
				changedGifts: result.changedPresentationRows.map((changedGift) => ({
					id: changedGift.id,
					wishlistId: changedGift.wishlistId,
					name: changedGift.name,
				})),
				actorId: user.id,
				actorName: user.name,
				wishlist: {
					title: result.wishlistRow.title,
					shortId: result.wishlistRow.shortId,
				},
			});
		}

		await singleFlightRefresh(getGiftsByWishlistShortId, result.wishlistRow.shortId);
		return { updatedIds: result.updatedIds, priorReceived: result.priorReceived };
	},
);

export const markGiftReceived = guardedCommand(
	MarkGiftReceivedInputSchema,
	async ({ user }, input) => {
		const database = getDb();

		const giftRows = await database
			.select()
			.from(gift)
			.where(and(eq(gift.id, input.giftId), isNull(gift.deletedAt)))
			.limit(1);

		const giftRow = giftRows[0];
		if (giftRow === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		// Marking received is a management action (recipient or správce) — the recipient marks
		// their own gifts received; on a for-someone list the správce does it for the recipient.
		const { wishlistRow } = await verifyManagerAccess(user.id, giftRow.wishlistId);
		assertWishlistMutable(wishlistRow);

		const [updated] = await database
			.update(gift)
			.set({ received: input.received, updatedAt: new Date() })
			.where(eq(gift.id, input.giftId))
			.returning();

		// Single-flight refresh (issue #108, REQ-3/4): only the gift list rides back.
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);

		return updated;
	},
);

/** Eligible non-archived destinations managed by the current actor. */
export const getBulkCopyDestinations = guardedQueryWithArgs(
	v.string(),
	async ({ user: currentUser }, sourceWishlistId) => {
		await verifyManagerAccess(currentUser.id, sourceWishlistId);
		const database = getDb();
		return database
			.selectDistinct({
				id: wishlist.id,
				title: wishlist.title,
				status: wishlist.status,
				recipientDisplayName: sql<string>`coalesce(${wishlist.recipientName}, ${user.name})`,
			})
			.from(wishlist)
			.leftJoin(user, eq(user.id, wishlist.recipientUserId))
			.leftJoin(
				moderatorAssignment,
				and(
					eq(moderatorAssignment.wishlistId, wishlist.id),
					eq(moderatorAssignment.userId, currentUser.id),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.where(
				and(
					ne(wishlist.id, sourceWishlistId),
					ne(wishlist.status, 'archived'),
					isNull(wishlist.deletedAt),
					or(
						eq(wishlist.recipientUserId, currentUser.id),
						eq(moderatorAssignment.userId, currentUser.id),
					),
				),
			)
			.orderBy(wishlist.title);
	},
);

export const bulkCopyGifts = guardedCommand(BulkCopyGiftsInputSchema, async ({ user }, input) => {
	try {
		const result = await copyGifts(user.id, input);
		singleFlightRefresh(getGiftsByWishlistShortId, result.destinationShortId);
		return { createdIds: result.created.map((created) => created.id) };
	} catch (thrown) {
		if (isHttpError(thrown)) {
			throw thrown;
		}
		console.error('[Bulk gift copy] failed', thrown);
		error(500, SERVER_ERROR.BULK_COPY_FAILED);
	}
});

/** Fetch priority levels for a wishlist */
export const getPriorityLevels = guardedQueryWithArgs(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	// Verify access
	await verifyManagerAccess(user.id, wishlistId);

	return database
		.select()
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(priorityLevel.sortOrder);
});
