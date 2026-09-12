import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	archiveWishlist,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';
import {
	MOBILE_HEIGHT,
	WIDTHS,
	createManagerWishlist,
	expectInsideViewport,
	gift,
	attachScreenshot,
} from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist visitor acceptance', () => {
	test('visitor normal state is one-row, bounded and non-action card space opens detail', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const manager = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-visitor-source'),
		);
		const path = await createManagerWishlist(manager, 'Veřejný mobilní seznam');
		const visitorContext = await browser.newContext();
		const page = await visitorContext.newPage();
		await page.goto(path, { waitUntil: 'load' });
		await expect(page.locator('[data-gift-item]')).toHaveCount(3);
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const toolbar = page.getByTestId('wishlist-toolbar');
			await expect(toolbar.locator('[data-mobile-toolbar-row]')).toHaveCount(1);
			await expectInsideViewport(toolbar, width);
			await attachScreenshot(page, testInfo, `visitor-card-${width}`);
		}
		await page.getByTestId('gift-view-list').click();
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			await expect(page.getByTestId('wishlist-gift-list')).toBeVisible();
			await attachScreenshot(page, testInfo, `visitor-list-${width}`);
		}
		const firstGift = page.locator('[data-gift-item]').first();
		await firstGift.getByRole('heading', { level: 3 }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toBeHidden();
		await visitorContext.close();
		await manager.context().close();
	});
	test('visitor can cancel their own reservation after the owner archives the wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-archived-own-reservation-owner'),
		);
		await createWishlistForSomeoneAndNavigate(owner, {
			title: 'Archivovaná rezervace návštěvníka',
			recipientName: 'Anička',
		});
		await addGift(owner, 'Dárek rezervovaný před archivací');
		await shareWishlist(owner);
		const wishlistPath = new URL(owner.url()).pathname;

		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-archived-own-reservation-visitor'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(wishlistPath, { waitUntil: 'load' });
		const reservedGift = gift(visitor, 'Dárek rezervovaný před archivací');
		await reservedGift.getByTestId('reserve-button').click();
		const reservationDialog = visitor.getByRole('dialog');
		await reservationDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reservationDialog).toBeHidden();
		await expect(reservedGift.getByText('Rezervováno vámi', { exact: true })).toBeVisible();

		// Archival is performed by the actual owner while the distinct visitor keeps their
		// authenticated context. This avoids accidentally asserting against the manager face.
		await owner.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
		await archiveWishlist(owner);
		await expect(owner.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible();

		await visitor.reload({ waitUntil: 'load' });
		await expect(visitor.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible();
		const archivedGift = gift(visitor, 'Dárek rezervovaný před archivací');
		const cancel = archivedGift.getByTestId('reserve-button');
		await expect(cancel).toHaveAccessibleName(/Zrušit rezervaci/i);

		// Cancellation remains the only archived reservation/list mutation: purchased,
		// received, creation, selection, and reorder affordances stay unavailable.
		await expect(archivedGift.getByTestId('gift-received-toggle')).toHaveCount(0);
		await expect(
			archivedGift.getByRole('button', {
				name: /Označit jako koupené|Zakoupeno|Mark as bought|Purchased/i,
			}),
		).not.toBeVisible();
		await expect(
			visitor.getByRole('button', { name: /Přidat dárek|Změnit pořadí/i }),
		).toHaveCount(0);
		await expect(visitor.getByRole('button', { name: m.gift_selection_toolbar() })).toHaveCount(
			0,
		);

		await cancel.click();
		await expect(cancel).toHaveCount(0);
		await expect(archivedGift.getByText('Rezervováno vámi', { exact: true })).toHaveCount(0);

		await owner.context().close();
		await visitor.context().close();
	});
});
