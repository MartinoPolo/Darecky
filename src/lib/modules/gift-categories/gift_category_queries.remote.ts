import * as v from 'valibot';
import { guardedQueryWithArgs } from '$lib/server/remote.js';
import { verifyManagerAccess } from '$lib/modules/wishlists/wishlist_access.js';
import {
	getManagedGiftCategories,
	getManagedGiftCategorySettingsRows,
} from './gift_categories_service.js';

export const getGiftCategories = guardedQueryWithArgs(v.string(), async ({ user }, wishlistId) => {
	await verifyManagerAccess(user.id, wishlistId);
	return getManagedGiftCategories(wishlistId);
});

export const getGiftCategorySettingsRows = guardedQueryWithArgs(
	v.string(),
	async ({ user }, wishlistId) => {
		await verifyManagerAccess(user.id, wishlistId);
		return getManagedGiftCategorySettingsRows(wishlistId);
	},
);
