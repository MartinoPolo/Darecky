import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate, shareWishlist } from './fixtures/wishlist-helpers.js';
import {
	MOBILE_HEIGHT,
	WIDTHS,
	createManagerWishlist,
	addQuantityGift,
	gift,
	dismissToasts,
	resetAllScroll,
	waitForGiftAnimationsToSettle,
	box,
	expectInsideViewport,
	expectContainedReceivedActions,
	attachScreenshot,
} from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist acceptance', () => {
	test('visitor card space cannot activate Like; only the Like button changes state', async ({
		browser,
		request,
		baseURL,
	}) => {
		const manager = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-like-source'),
		);
		const path = await createManagerWishlist(manager, 'Přímá aktivace oblíbení');
		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-like-visitor'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(path, { waitUntil: 'load' });
		await waitForAppHydration(visitor);
		const card = visitor.locator('[data-gift-item]').first();
		const like = card.locator('button:has([data-like-heart])');
		await expect(like).toHaveAccessibleName(/Přidat.*oblíbených/i);
		await expect(like).toHaveAttribute('aria-pressed', 'false');
		await card.getByRole('heading', { level: 3 }).click();
		await expect(visitor.getByRole('dialog')).toBeVisible();
		await expect(like).toHaveAttribute('aria-pressed', 'false');
		await visitor.keyboard.press('Escape');
		await like.click();
		await expect(like).toHaveAttribute('aria-pressed', 'true');
		await manager.context().close();
		await visitor.context().close();
	});
	test('partial own reservation and received cards keep exact compact state anatomy', async ({
		browser,
		request,
		baseURL,
	}) => {
		const manager = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-state-source'),
		);
		await createManagerWishlist(manager, 'Mobilní stavové příklady');
		await addQuantityGift(manager, 'Tři kusy bez ceny a obrázku', 3);
		const received = gift(manager, 'Třetí dárek');
		await received.getByTestId('gift-received-toggle').click();
		await expect(received.getByText('Přijato', { exact: true })).toBeVisible();
		const path = new URL(manager.url()).pathname;

		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-state-visitor'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(path, { waitUntil: 'load' });
		await waitForAppHydration(visitor);
		await visitor.getByTestId('mobile-display-trigger').click();
		const filterDialog = visitor.getByRole('dialog', { name: m.gift_display_options() });
		await expect(filterDialog).toBeVisible();
		await filterDialog.getByTestId('mobile-sheet-filter-switch').click();
		await filterDialog.getByRole('checkbox', { name: m.gift_filter_show_received() }).click();
		await visitor.keyboard.press('Escape');
		await expect(filterDialog).toBeHidden();

		const visitorReceived = gift(visitor, 'Třetí dárek');
		await expect(visitorReceived).toBeVisible();
		const receivedOverlay = visitorReceived.getByTestId('gift-state-overlay');
		await expect(receivedOverlay).toBeVisible();
		await expect(receivedOverlay).toHaveText(m.gift_received_badge(), { useInnerText: true });
		await expect(receivedOverlay).not.toHaveAttribute('role', 'status');
		await expect(receivedOverlay.locator('[data-reservation-support]')).toHaveCount(0);

		const partial = gift(visitor, 'Tři kusy bez ceny a obrázku');
		await partial.getByTestId('reserve-button').click();
		const reserveDialog = visitor.getByRole('dialog');
		await reserveDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reserveDialog).toBeHidden();
		await expect(partial.getByText('Rezervováno vámi', { exact: true })).toBeVisible();
		await expect(partial.getByText('Volné 2/3', { exact: true })).toBeVisible();
		await expect(partial.getByTestId('reserve-button')).toHaveText('Zrušit rezervaci');

		const cards = await visitor.locator('[data-gift-item]').all();
		for (const card of cards) {
			await expectInsideViewport(card, 390);
		}
		expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
		await manager.context().close();
		await visitor.context().close();
	});
	test('recipient face has no reservation, Like, Purchased or structural action trace', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-recipient'),
		);
		await createWishlistAndNavigate(page, 'Soukromí obdarovaného');
		await addGift(page, 'Dárek s utajenou rezervací', { price: '850' });
		await addGift(page, 'Druhý stejně vysoký dárek');
		await page.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
		await shareWishlist(page);
		await dismissToasts(page);
		const wishlistPath = new URL(page.url()).pathname;
		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-recipient-reserver'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(wishlistPath, { waitUntil: 'load' });
		await waitForAppHydration(visitor);
		const privateGift = gift(visitor, 'Dárek s utajenou rezervací');
		await privateGift.getByTestId('reserve-button').click();
		const reservationDialog = visitor.getByRole('dialog');
		await reservationDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reservationDialog).toBeHidden();
		await page.reload({ waitUntil: 'load' });
		await waitForAppHydration(page);
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const items = page.locator('[data-gift-item]');
			await expect(items).toHaveCount(2);
			await expect(page.getByText(/Rezervov|Volné \d+\//i)).toHaveCount(0);
			await expect(page.getByTestId('reserve-button')).toHaveCount(0);
			await expect(page.getByText(/Koupen|Zakoupen|Purchased/i)).toHaveCount(0);
			await expect(page.getByRole('button', { name: /líbí|like/i })).toHaveCount(0);
			await expectContainedReceivedActions(page);
			await attachScreenshot(page, testInfo, `recipient-card-${width}`);
		}
		await page.getByTestId('gift-view-list').click();
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			await expect(page.getByTestId('wishlist-gift-list')).toBeVisible();
			await expect(page.getByText(/Rezervov|Volné \d+\//i)).toHaveCount(0);
			await expect(page.getByTestId('reserve-button')).toHaveCount(0);
			await expectContainedReceivedActions(page);
			await attachScreenshot(page, testInfo, `recipient-list-${width}`);
		}
		await visitor.context().close();
		await page.context().close();
	});
	test('selection replacement and reorder expose one checkbox, 40px grip and keyboard move', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-modes'),
		);
		await createManagerWishlist(page, 'Mobilní režimy');
		await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await page.getByTestId('mobile-more-trigger').click();
		await page
			.getByRole('dialog', { name: m.wishlist_more_actions() })
			.getByRole('button', { name: m.gift_selection_toolbar(), exact: true })
			.click();
		const selection = page.getByRole('region', {
			name: m.gift_selection_toolbar(),
			exact: true,
		});
		await expect(selection).toBeVisible();
		await expect(page.getByTestId('gift-view-switcher')).toHaveCount(0);
		const selectableItems = page.locator('[data-gift-item]');
		for (const item of await selectableItems.all()) {
			// The gift wrapper itself is the single semantic checkbox; the image-corner
			// surface is deliberately aria-hidden visual feedback, not a nested control.
			await expect(item).toHaveAttribute('role', 'checkbox');
			const visualControl = item.getByTestId('gift-selection-control');
			await expect(visualControl).toHaveCount(1);
			expect((await box(visualControl)).width).toBeCloseTo(40, 0);
			await expect(visualControl.locator('[data-slot="checkbox"]')).toHaveCount(0);
		}
		await expect(page.getByRole('checkbox', { name: /Vybrat dárek/ })).toHaveCount(
			await selectableItems.count(),
		);
		const firstSelectableItem = page.locator('[data-gift-item]').first();
		await firstSelectableItem.press('Space');
		await expect(firstSelectableItem).toHaveAttribute('aria-checked', 'true');
		const selectedItemBox = await box(firstSelectableItem);
		const selectedSurfaceBox = await box(
			firstSelectableItem.getByTestId('gift-selection-surface'),
		);
		const checkGlyphBox = await box(
			firstSelectableItem.getByTestId('gift-selection-control').locator('svg'),
		);
		expect(checkGlyphBox.width).toBeGreaterThanOrEqual(18);
		expect(checkGlyphBox.width).toBeLessThanOrEqual(20);
		expect(selectedSurfaceBox.x).toBeCloseTo(selectedItemBox.x, 0);
		expect(selectedSurfaceBox.y).toBeCloseTo(selectedItemBox.y, 0);
		expect(selectedSurfaceBox.width).toBeCloseTo(selectedItemBox.width, 0);
		expect(selectedSurfaceBox.height).toBeCloseTo(selectedItemBox.height, 0);
		expect(await firstSelectableItem.evaluate((item) => document.activeElement === item)).toBe(
			true,
		);
		await page.locator('main.app-content').evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		await expect(firstSelectableItem).toHaveAttribute('aria-checked', 'true');
		await expect(selection).toBeVisible();
		await dismissToasts(page);
		await resetAllScroll(page);
		await attachScreenshot(page, testInfo, 'manager-selection-390');
		// Refined prototype: selection cards show only the image checkbox; direct card
		// actions must not remain as visible duplicate affordances.
		expect.soft(await page.getByTestId('reserve-button').count()).toBe(0);
		expect.soft(await page.getByTestId('gift-received-toggle').count()).toBe(0);
		expect.soft(await page.getByRole('button', { name: /oblíbených/ }).count()).toBe(0);
		await selection.getByRole('button', { name: 'Zrušit', exact: true }).click();

		await page.getByTestId('mobile-more-trigger').click();
		await page
			.getByRole('dialog', { name: m.wishlist_more_actions() })
			.getByRole('button', { name: 'Změnit pořadí', exact: true })
			.click();
		await expect(page.getByRole('button', { name: 'Hotovo', exact: true })).toBeVisible();
		const namesBefore = await page.locator('[data-gift-item] h3').allTextContents();
		const firstMoveUp = page.getByRole('button', {
			name: m.gift_reorder_move_up({ name: namesBefore[0] }),
			exact: true,
		});
		const firstMoveDown = page.getByRole('button', {
			name: m.gift_reorder_move_down({ name: namesBefore[0] }),
			exact: true,
		});
		await expect(firstMoveUp).toBeHidden();
		await expect(firstMoveDown).toBeHidden();

		const namesAfterButtonMove = await page.locator('[data-gift-item] h3').allTextContents();
		const movableGrip = page
			.locator('[data-gift-item]')
			.first()
			.getByRole('button', { name: m.gift_reorder_grip_label(), exact: true });
		await movableGrip.focus();
		await movableGrip.press('ArrowDown');
		await expect
			.poll(() => page.locator('[data-gift-item] h3').allTextContents())
			.not.toEqual(namesAfterButtonMove);
		await waitForGiftAnimationsToSettle(page);
		await resetAllScroll(page);
		await attachScreenshot(page, testInfo, 'manager-reorder-390');
		expect.soft(await page.getByTestId('reserve-button').count()).toBe(0);
		expect.soft(await page.getByTestId('gift-received-toggle').count()).toBe(0);
		await page.context().close();
	});
});
