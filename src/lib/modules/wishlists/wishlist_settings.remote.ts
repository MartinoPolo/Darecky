import { getDb } from '$lib/server/db/index.js';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import {
	getGiftCategories,
	getGiftCategorySettingsRows,
} from '$lib/modules/gift-categories/gift_category_queries.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { getWishlistByShortId } from './wishlists.remote.js';
import { saveLockedWishlistSettings } from './wishlist_settings_service.js';
import { SaveWishlistSettingsInputSchema } from './wishlist_settings_types.js';

export const saveWishlistSettings = guardedCommand(
	SaveWishlistSettingsInputSchema,
	async ({ user }, input) => {
		const database = getDb();
		const { replacedImageKey, shortId } = await database.transaction((tx) =>
			saveLockedWishlistSettings(tx, user.id, input),
		);

		// R2 cannot participate in the database transaction. The locked transaction returns
		// the key it actually replaced, so concurrent A→B→C saves clean both A and B.
		if (replacedImageKey !== null) {
			await deleteObjectsBestEffort([replacedImageKey]);
		}

		void singleFlightRefresh(getWishlistByShortId, shortId);
		if (input.categories !== undefined) {
			void singleFlightRefresh(getGiftCategories, input.wishlistId);
			void singleFlightRefresh(getGiftCategorySettingsRows, input.wishlistId);
			void singleFlightRefresh(getGiftsByWishlistShortId, shortId);
		}
	},
);
