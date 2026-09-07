import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: vi.fn() }));
vi.mock('$app/server', () => ({ command: vi.fn((...args: unknown[]) => args.at(-1)) }));

const guardedCommand = vi.fn((_schema: unknown, handler: (...args: never[]) => unknown) =>
	Object.assign(handler, { __: {} }),
);
const singleFlightRefresh = vi.fn();
vi.mock('$lib/server/remote.js', () => ({ guardedCommand, singleFlightRefresh }));

const tx = { marker: 'transaction' };
const transaction = vi.fn(async (callback: (database: typeof tx) => Promise<unknown>) =>
	callback(tx),
);
vi.mock('$lib/server/db/index.js', () => ({ getDb: () => ({ transaction }) }));

const saveLockedWishlistSettings = vi.fn();
vi.mock('./wishlist_settings_service.js', () => ({ saveLockedWishlistSettings }));

const deleteObjectsBestEffort = vi.fn();
vi.mock('$lib/server/storage/r2.js', () => ({ deleteObjectsBestEffort }));

const getWishlistByShortId = Object.assign(vi.fn(), { __: {} });
vi.mock('./wishlists.remote.js', () => ({ getWishlistByShortId }));
const getGiftCategories = Object.assign(vi.fn(), { __: {} });
const getGiftCategorySettingsRows = Object.assign(vi.fn(), { __: {} });
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategories,
	getGiftCategorySettingsRows,
}));
const getGiftsByWishlistShortId = Object.assign(vi.fn(), { __: {} });
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({ getGiftsByWishlistShortId }));

vi.mock('./wishlist_settings_types.js', () => ({ SaveWishlistSettingsInputSchema: {} }));

const { saveWishlistSettings } = await import('./wishlist_settings.remote.js');

beforeEach(() => vi.clearAllMocks());

describe('saveWishlistSettings', () => {
	it('commits every database-backed settings domain in one transaction before deleting the replaced image', async () => {
		const wishlistRow = {
			id: 'wishlist-1',
			shortId: 'short-1',
			imageKey: 'wishlists/old.webp',
			status: 'active',
		};
		saveLockedWishlistSettings.mockResolvedValue({
			replacedImageKey: wishlistRow.imageKey,
			shortId: wishlistRow.shortId,
		});
		const input = {
			wishlistId: 'wishlist-1',
			details: { title: 'Nový název', description: null },
			categories: {
				customCategories: [],
				presetKeys: [],
				presetColors: [],
				confirmedRemovalCategoryIds: [],
			},
			palette: 'ocean',
			image: { imageKey: 'wishlists/new.webp', imageSlots: null },
		};

		type CommandInput = typeof input;
		const call = saveWishlistSettings as unknown as (
			context: { user: { id: string } },
			commandInput: CommandInput,
		) => Promise<void>;
		await call({ user: { id: 'user-1' } }, input);

		expect(transaction).toHaveBeenCalledOnce();
		expect(saveLockedWishlistSettings).toHaveBeenCalledWith(tx, 'user-1', input);
		expect(deleteObjectsBestEffort).toHaveBeenCalledWith(['wishlists/old.webp']);
		expect(saveLockedWishlistSettings.mock.invocationCallOrder[0]).toBeLessThan(
			deleteObjectsBestEffort.mock.invocationCallOrder[0],
		);
		expect(singleFlightRefresh).toHaveBeenCalledWith(getWishlistByShortId, 'short-1');
	});
});
