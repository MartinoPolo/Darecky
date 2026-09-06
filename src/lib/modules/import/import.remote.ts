import * as v from 'valibot';
import { and, eq, asc, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import {
	verifyManagerAccess,
	assertWishlistMutable,
} from '$lib/modules/wishlists/wishlist_access.js';
import { seedNewWishlist } from '$lib/modules/wishlists/wishlist_create.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import {
	DEFAULT_GIFT_CURRENCY,
	DRAFT_PRIORITY,
	type DraftPriority,
	type GiftDraftInput,
} from '$lib/modules/gifts/types.js';
import {
	appendGiftsUsingTransaction,
	type NormalizedGiftCreationInput,
} from '$lib/modules/gifts/gift_creation_service.js';
import { canonicalGiftLinkKey } from '$lib/modules/gifts/gift_url.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { mapGiftCreationError } from '$lib/modules/gifts/gift_creation_transport.js';
import { resolveImportGiftCategoryAssignments } from '$lib/modules/gift-categories/gift_categories_service.js';
import { getGiftCategorySettingsRows } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
import {
	buildSheetsCsvExportUrl,
	classifySheetCsvResponse,
	MAX_SHEET_BYTES,
} from './sheets_link.js';
import { ImportGiftsInputSchema, CreateWishlistFromImportInputSchema } from './import_types.js';

const SheetLinkSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

/**
 * Fetch a Google Sheet as CSV, server-side. The raw user URL is never fetched –
 * {@link buildSheetsCsvExportUrl} reconstructs a pinned `docs.google.com` export
 * URL or returns a typed error (invalid / not-a-sheet). The fetched response is
 * classified for private-sheet / failure cases before the CSV text is returned.
 *
 * Auth-gated (any signed-in user) so the server isn't an open fetch proxy.
 * Returns the raw CSV string; parsing happens client-side to keep the Worker thin.
 */
export const fetchGoogleSheetCsv = guardedCommand(SheetLinkSchema, async (_authContext, link) => {
	const built = buildSheetsCsvExportUrl(link);
	if (!built.ok) {
		error(400, built.code);
	}

	let response: Response;
	try {
		response = await fetch(built.target.exportUrl, {
			redirect: 'follow',
			headers: { accept: 'text/csv,text/plain' },
			signal: AbortSignal.timeout(15_000),
		});
	} catch (err) {
		if (
			typeof err === 'object' &&
			err !== null &&
			(err as { name?: string }).name === 'TimeoutError'
		) {
			error(504, SERVER_ERROR.SHEETS_FETCH_FAILED);
		}
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	const verdict = classifySheetCsvResponse(response.status, response.headers.get('content-type'));
	if (!verdict.ok) {
		const status = verdict.code === SERVER_ERROR.SHEETS_PRIVATE ? 403 : 502;
		error(status, verdict.code);
	}

	const contentLength = response.headers.get('content-length');
	const declaredLength = contentLength !== null ? Number(contentLength) : null;
	if (declaredLength !== null && declaredLength > MAX_SHEET_BYTES) {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	const csv = await response.text();
	if (csv.length > MAX_SHEET_BYTES) {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	return csv;
});

function draftToGiftInput(
	draft: GiftDraftInput,
	priorityLevelId: string | null,
	categoryId: string | null,
): NormalizedGiftCreationInput {
	return {
		name: draft.name,
		description: draft.description ?? null,
		links: draft.links,
		price: draft.price ?? null,
		priceMax: draft.priceMax ?? null,
		currency: draft.currency ?? DEFAULT_GIFT_CURRENCY,
		imageUrl: draft.imageUrl,
		quantity: draft.quantity,
		priorityLevelId,
		categoryId,
	};
}

function resolvedDraftCategoryId(
	draft: GiftDraftInput,
	resolvedImportedCategories: ReadonlyMap<string, string>,
): string | null {
	if (draft.categoryId != null && draft.categoryId !== '') {
		return draft.categoryId;
	}
	const importedLabel = draft.importedCategoryLabel?.trim() ?? '';
	return importedLabel === '' ? null : (resolvedImportedCategories.get(importedLabel) ?? null);
}

/**
 * Resolve a draft's binary priority to a concrete priority-level id by rank:
 * high → lowest sortOrder, medium → second. Returns null when the needed rank
 * is absent (the grid hides the toggle in that case — this is a safety net).
 */
function resolvePriorityLevelId(
	priority: DraftPriority,
	rankedLevelIds: readonly string[],
): string | null {
	const rank = priority === DRAFT_PRIORITY.high ? 0 : 1;
	return rankedLevelIds[rank] ?? null;
}

type SelectExecutor = Pick<ReturnType<typeof getDb>, 'select'>;

/** Priority-level ids for a wishlist, ranked by sortOrder (index 0 = highest priority). */
async function rankedPriorityLevelIds(
	database: SelectExecutor,
	wishlistId: string,
): Promise<string[]> {
	const rows = await database
		.select({ id: priorityLevel.id })
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(asc(priorityLevel.sortOrder));
	return rows.map((row) => row.id);
}

/**
 * Defense-in-depth duplicate advisory at the server boundary. The review grid
 * catches ordinary duplicates; this query catches stale or racing matches and
 * requires a separate explicit retry before preserving every reviewed row.
 */
async function findCanonicalLinkDuplicateIndexes(
	database: SelectExecutor,
	wishlistId: string,
	drafts: readonly GiftDraftInput[],
): Promise<number[]> {
	const draftKeySets = drafts.map(
		(draft) =>
			new Set(
				(draft.links ?? [])
					.map((link) => canonicalGiftLinkKey(link.url))
					.filter((key): key is string => key !== null),
			),
	);
	if (draftKeySets.every((keys) => keys.size === 0)) {
		return [];
	}

	const existing = await database
		.select({ links: gift.links })
		.from(gift)
		.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)));
	const existingKeys = new Set(
		existing.flatMap((row) =>
			(row.links ?? [])
				.map((link) => canonicalGiftLinkKey(link.url))
				.filter((key): key is string => key !== null),
		),
	);
	return draftKeySets.flatMap((keys, index) =>
		[...keys].some((key) => existingKeys.has(key)) ? [index] : [],
	);
}

export type ImportGiftsResult =
	| { status: 'duplicate-warning'; duplicateIndexes: number[] }
	| { status: 'created'; gifts: { id: string }[] };

/**
 * Append imported/batch drafts to an existing wishlist. Managers (recipient or správce) only;
 * rejected on archived wishlists. New gifts are appended after the current max
 * sortOrder so existing ordering is preserved; the whole batch inserts in one
 * transaction. Returns the created gift rows.
 */
export const importGifts = guardedCommand(ImportGiftsInputSchema, async ({ user }, input) => {
	const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
	assertWishlistMutable(wishlistRow);

	if (input.gifts.length === 0) {
		return { status: 'created', gifts: [] } satisfies ImportGiftsResult;
	}

	let result: ImportGiftsResult;
	try {
		result = await getDb().transaction(async (tx) => {
			await tx
				.select({ id: wishlist.id })
				.from(wishlist)
				.where(eq(wishlist.id, input.wishlistId))
				.limit(1)
				.for('update');
			const rankedLevelIds = await rankedPriorityLevelIds(tx, input.wishlistId);
			const duplicateIndexes = await findCanonicalLinkDuplicateIndexes(
				tx,
				input.wishlistId,
				input.gifts,
			);
			if (duplicateIndexes.length > 0 && !input.acknowledgeDuplicates) {
				return {
					status: 'duplicate-warning',
					duplicateIndexes,
				} satisfies ImportGiftsResult;
			}
			const resolvedImportedCategories = await resolveImportGiftCategoryAssignments({
				database: tx,
				wishlistId: input.wishlistId,
				drafts: input.gifts,
				resolutions: input.categoryResolutions,
			});
			const created = await appendGiftsUsingTransaction(tx, {
				wishlistId: input.wishlistId,
				actorId: user.id,
				gifts: input.gifts.map((draft) =>
					draftToGiftInput(
						draft,
						resolvePriorityLevelId(draft.priority, rankedLevelIds),
						resolvedDraftCategoryId(draft, resolvedImportedCategories),
					),
				),
			});
			return { status: 'created', gifts: created } satisfies ImportGiftsResult;
		});
	} catch (thrown) {
		mapGiftCreationError(thrown);
	}

	if (result.status === 'created') {
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
		singleFlightRefresh(getGiftCategorySettingsRows, input.wishlistId);
	}
	return result;
});

/**
 * Create a new wishlist owned by the caller, seed its default priority levels,
 * and insert the imported drafts (sortOrder sequential from 0) – all atomically
 * in one transaction. Returns the created wishlist row.
 */
export const createWishlistFromImport = guardedCommand(
	CreateWishlistFromImportInputSchema,
	async ({ user }, input) => {
		const database = getDb();

		return database.transaction(async (tx) => {
			const created = await seedNewWishlist(tx, user.id, input);

			if (input.gifts.length > 0) {
				const rankedLevelIds = await rankedPriorityLevelIds(tx, created.id);
				const resolvedImportedCategories = await resolveImportGiftCategoryAssignments({
					database: tx,
					wishlistId: created.id,
					drafts: input.gifts,
					resolutions: input.categoryResolutions,
				});
				await appendGiftsUsingTransaction(tx, {
					wishlistId: created.id,
					actorId: user.id,
					notifyFollowers: false,
					gifts: input.gifts.map((draft) =>
						draftToGiftInput(
							draft,
							resolvePriorityLevelId(draft.priority, rankedLevelIds),
							resolvedDraftCategoryId(draft, resolvedImportedCategories),
						),
					),
				});
			}

			return created;
		});
	},
);
