import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

test.describe('Wishlist settings – controls and draft lifecycle', () => {
	test('Knihy picker renders five columns and visible keyboard focus on extreme swatches', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-color-picker');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(page, 'Barevná mřížka');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const settings = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settings.getByRole('tab', { name: 'Kategorie' }).click();
		await settings.getByRole('button', { name: 'Knihy' }).press('Enter');

		const picker = page.getByRole('dialog', { name: 'Knihy' });
		const group = picker.getByRole('group');
		// Opening autofocus runs after mount and must finish before moving focus elsewhere.
		await expect(group.getByRole('button').first()).toBeFocused();
		const columns = await group.evaluate((element) =>
			getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean),
		);
		expect(columns).toHaveLength(5);
		const gray = picker.getByRole('button', { name: '#6B7280' });
		await gray.focus();
		await expect(gray).toBeFocused();
		for (const color of ['#000000', '#FFFFFF']) {
			await page.keyboard.press('Tab');
			const swatch = picker.getByRole('button', { name: color });
			await expect(swatch).toBeFocused();
			const outline = await swatch.evaluate((element) => {
				const style = getComputedStyle(element);
				return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
			});
			expect(outline.style).not.toBe('none');
			expect(outline.width).toBeGreaterThan(0);
		}
		await page.context().close();
	});

	test('real gift numeric fields suppress spinners and wheel only while focused', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-number-inputs');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await page.setViewportSize({ width: 500, height: 360 });
		await createWishlistAndNavigate(page, 'Číselná pole');
		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		const price = dialog.getByRole('spinbutton', { name: 'Cena' });
		const quantity = dialog.getByRole('spinbutton', { name: 'Počet (skryto při 1)' });
		for (const input of [price, quantity]) {
			expect(await input.evaluate((element) => getComputedStyle(element).appearance)).toBe(
				'textfield',
			);
		}

		await price.fill('99.99');
		const unfocused = await price.evaluate((element) => {
			(element as HTMLInputElement).blur();
			const event = new WheelEvent('wheel', { deltaY: -1, cancelable: true, bubbles: true });
			const dispatched = element.dispatchEvent(event);
			return {
				dispatched,
				prevented: event.defaultPrevented,
				value: (element as HTMLInputElement).value,
			};
		});
		expect(unfocused).toEqual({ dispatched: true, prevented: false, value: '99.99' });

		const focused = await price.evaluate((element) => {
			(element as HTMLInputElement).focus();
			const event = new WheelEvent('wheel', { deltaY: -1, cancelable: true, bubbles: true });
			const dispatched = element.dispatchEvent(event);
			return { dispatched, prevented: event.defaultPrevented };
		});
		expect(focused).toEqual({ dispatched: false, prevented: true });
		await expect(price).toHaveValue('100.99');

		// A synthetic dispatch verifies direct cancellation semantics, but does not expose
		// browsers ignoring preventDefault in passive listeners. Exercise a real gesture in
		// the short dialog's actual scroll region to guard against that regression.
		await price.fill('99.99');
		const scrollRegion = dialog.getByTestId('gift-detail-body');
		await price.scrollIntoViewIfNeeded();
		await price.focus();
		const scrollTopBefore = await scrollRegion.evaluate((element) => element.scrollTop);
		expect(scrollTopBefore).toBeGreaterThan(0);
		const priceBox = await price.boundingBox();
		expect(priceBox, 'price input has mouse-wheel geometry').not.toBeNull();
		await page.mouse.move(
			priceBox!.x + priceBox!.width / 2,
			priceBox!.y + priceBox!.height / 2,
		);
		await page.mouse.wheel(0, -100);
		await expect(price).toHaveValue('100.99');
		expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBe(scrollTopBefore);
		await page.context().close();
	});
	test('short viewport keeps settings content scrollable and its stable footer visible', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-short-viewport');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Nastavení v nízkém okně');
		await page.setViewportSize({ width: 900, height: 360 });
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();

		const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		const scrollRegion = dialog.getByTestId('wishlist-settings-scroll-region');
		const footer = dialog.getByTestId('wishlist-settings-footer');
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await expect(footer.getByRole('button', { name: 'Uložit' })).toBeVisible();

		const dialogBox = await dialog.boundingBox();
		expect(dialogBox, 'settings dialog has viewport geometry').not.toBeNull();
		expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
		expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(360);

		const overflow = await scrollRegion.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			overflowY: getComputedStyle(element).overflowY,
		}));
		expect(overflow.overflowY).toBe('auto');
		expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
		await scrollRegion.evaluate((element) => (element.scrollTop = element.scrollHeight));
		expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

		const actionFooterY = (await footer.boundingBox())!.y;
		await dialog.getByRole('tab', { name: 'Import a export' }).click();
		await expect(footer.getByRole('button', { name: 'Uložit' })).toBeVisible();
		await expect
			.poll(async () => Math.abs((await footer.boundingBox())!.y - actionFooterY))
			.toBeLessThanOrEqual(3);
		await expect(footer.getByRole('button', { name: 'Uložit' })).toHaveCount(1);

		await page.context().close();
	});

	test('Image/Crops overflow and body scrolling leave pinned tab geometry unchanged', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-pinned-tabs');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(page, 'Připnuté záložky');
		await page.setViewportSize({ width: 1280, height: 600 });
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();

		const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		const tablist = dialog.getByRole('tablist', { name: 'Nastavení seznamu' });
		const scrollRegion = dialog.getByTestId('wishlist-settings-scroll-region');
		await expect
			.poll(() =>
				tablist
					.getByRole('tab')
					.evaluateAll(
						(tabs) =>
							tabs.length > 0 &&
							tabs.every((tab) => getComputedStyle(tab).justifyContent === 'center'),
					),
			)
			.toBe(true);
		const tabWidths = await tablist
			.getByRole('tab')
			.evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().width));
		expect(Math.max(...tabWidths) - Math.min(...tabWidths)).toBeLessThanOrEqual(1);

		await page.setViewportSize({ width: 900, height: 360 });
		await dialog.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations({ subtree: true }).map((animation) => animation.finished),
			);
		});
		const initialBox = await tablist.boundingBox();
		expect(initialBox, 'tablist has stable geometry').not.toBeNull();

		await dialog.getByRole('tab', { name: 'Obrázek a ořezy' }).click();
		await expect
			.poll(async () => {
				const box = await tablist.boundingBox();
				return { y: Math.round(box!.y), height: Math.round(box!.height) };
			})
			.toEqual({ y: Math.round(initialBox!.y), height: Math.round(initialBox!.height) });

		await scrollRegion.evaluate((element) => (element.scrollTop = element.scrollHeight));
		expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
		const scrolledBox = await tablist.boundingBox();
		expect(Math.abs(scrolledBox!.y - initialBox!.y)).toBeLessThanOrEqual(1);
		expect(Math.abs(scrolledBox!.height - initialBox!.height)).toBeLessThanOrEqual(1);

		await page.context().close();
	});

	test('dirty Escape then Continue editing preserves the visible draft and later reopen', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-dirty-escape');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(page, 'Zavření rozepsaných změn');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();

		const settings = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		const title = settings.getByRole('textbox', { name: 'Název' });
		const unsavedGuard = page.getByRole('dialog', { name: 'Máte neuložené změny' });
		await title.fill('Rozepsaný název');

		await page
			.locator('[data-slot="dialog-overlay"]:visible')
			.click({ position: { x: 8, y: 8 } });
		await expect(unsavedGuard).toBeVisible();
		await unsavedGuard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();
		await expect(unsavedGuard).not.toBeVisible();
		await expect(settings).toBeVisible();
		await expect(title).toHaveValue('Rozepsaný název');

		await page.keyboard.press('Escape');
		await expect(unsavedGuard).toBeVisible();
		await unsavedGuard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();

		await expect(unsavedGuard).not.toBeVisible();
		await expect(settings).toBeVisible();
		await expect(title).toHaveValue('Rozepsaný název');

		await settings.getByRole('button', { name: 'Zavřít' }).click();
		await expect(unsavedGuard).toBeVisible();
		await unsavedGuard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();
		await expect(unsavedGuard).not.toBeVisible();
		await expect(settings).toBeVisible();
		await expect(title).toHaveValue('Rozepsaný název');

		await title.fill('Zavření rozepsaných změn');
		await settings.getByRole('button', { name: 'Zavřít' }).click();
		await expect(settings).not.toBeVisible();
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		await expect(settings).toBeVisible();
		await expect(settings.getByRole('textbox', { name: 'Název' })).toHaveValue(
			'Zavření rozepsaných změn',
		);

		await page.context().close();
	});
});
