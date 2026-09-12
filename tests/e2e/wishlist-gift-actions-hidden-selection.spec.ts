import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { DEFAULT_PRIORITY_LEVELS } from '../../src/lib/modules/wishlists/types.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { addGift, createWishlistForSomeoneAndNavigate } from './fixtures/wishlist-helpers.js';
import {
	escapeRegex,
	gift,
	openSelectionFromContext,
	selectPriorityFilter,
	selectionCount,
	toggleFilterCheckbox,
	waitForReceivedState,
	waitForToast,
} from './wishlist-gift-actions.helpers.js';

test('bulk hidden-selection confirmation preserves exact received state on undo', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-hidden-undo'),
	);
	await createWishlistForSomeoneAndNavigate(page, {
		title: 'Skrytý výběr',
		recipientName: 'Rosie',
	});
	await addGift(page, 'Kolo pro výlety');
	await addGift(page, 'Stan pro dva');
	await expect(page.locator('[data-gift-item]')).toHaveCount(2, { timeout: 10_000 });

	const firstGift = gift(page, 'Kolo pro výlety');
	const secondGift = gift(page, 'Stan pro dva');
	await toggleFilterCheckbox(page, m.gift_filter_show_received());
	await firstGift.getByTestId('gift-received-toggle').click();
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
	await selectPriorityFilter(page, m.gift_priority_none());
	const toolbar = await openSelectionFromContext(page, 'Kolo pro výlety');
	await gift(page, 'Stan pro dva').click();
	await selectionCount(toolbar, 2);

	await toolbar.getByTestId('desktop-selection-actions-trigger').click();
	const selectionActionsMenu = page.getByRole('menu', {
		name: m.gift_selection_actions(),
		exact: true,
	});
	await expect(selectionActionsMenu).toBeVisible();
	await selectionActionsMenu
		.getByRole('menuitem', {
			name: new RegExp(`^${escapeRegex(m.gift_priority_label())}`),
		})
		.click();
	const highPriorityOption = page
		.getByRole('menuitemradio', { name: DEFAULT_PRIORITY_LEVELS[0].label, exact: true })
		.filter({ visible: true });
	await expect(highPriorityOption).toHaveCount(1);
	await highPriorityOption.click();
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();

	await toolbar.getByTestId('desktop-selection-actions-trigger').click();
	await expect(selectionActionsMenu).toBeVisible();
	await selectionActionsMenu
		.getByRole('menuitem', {
			name: new RegExp(`^${escapeRegex(m.gift_selection_received_state())}`),
		})
		.click();
	await page.getByTestId('selection-received-true').click();
	await expect(page.getByRole('dialog')).toContainText(
		m.gift_hidden_selection_description({ count: 2 }),
	);
	await page.getByRole('button', { name: m.gift_hidden_selection_continue() }).click();
	await waitForToast(page, m.gift_bulk_success({ count: 2 }));
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();
	await page.getByRole('button', { name: m.gift_bulk_undo() }).click();
	await waitForToast(page, m.gift_bulk_undo_success());
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();

	await page.getByRole('button', { name: m.done() }).click();
	await page
		.getByTestId('wishlist-toolbar-active-filters')
		.getByRole('button', { name: m.wishlist_detail_clear_filters(), exact: true })
		.click();
	await expect(firstGift).toHaveCount(0);
	await waitForReceivedState(secondGift, false);
	await toggleFilterCheckbox(page, m.gift_filter_show_received());
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);
	await page.context().close();
});
