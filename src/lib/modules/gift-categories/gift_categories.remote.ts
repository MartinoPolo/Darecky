import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import {
	verifyManagerAccess,
	assertWishlistMutable,
} from '$lib/modules/wishlists/wishlist_access.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { SaveGiftCategorySettingsInputSchema } from './types.js';
import { saveGiftCategorySettings } from './gift_categories_service.js';
import { getGiftCategories, getGiftCategorySettingsRows } from './gift_category_queries.remote.js';

export const saveGiftCategorySettingsCommand = guardedCommand(
	SaveGiftCategorySettingsInputSchema,
	async ({ user }, input) => {
		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);
		await saveGiftCategorySettings(input);
		void singleFlightRefresh(getGiftCategories, input.wishlistId);
		void singleFlightRefresh(getGiftCategorySettingsRows, input.wishlistId);
		void singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
	},
);
