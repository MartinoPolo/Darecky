import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	archiveWishlist,
} from './fixtures/wishlist-helpers.js';

/** The Details card form is the only one containing the "Popis" (description) textarea. */
function detailsForm(page: Page) {
	return page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Popis' }) });
}

function shortIdFromPath(path: string): string {
	const id = path.split('/').filter(Boolean).pop();
	expect(id, 'wishlist short id present in path').toBeTruthy();
	return id!;
}

test.describe('Wishlist settings – non-image editing', () => {
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

	test('owner can edit title, description, and event date, and changes persist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-owner-edit');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(page, 'Detaily před úpravou');
		const shortId = shortIdFromPath(path);

		// The legacy settings URL redirects to the wishlist page and opens the settings modal.
		await page.goto(`/w/${shortId}/settings`);
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settingsDialog).toBeVisible({ timeout: 10_000 });

		// The event date is a DatePicker popover (not a native input). Pick a deterministic
		// date 3 months out so the calendar – which opens on the current month – needs a fixed
		// number of "next month" steps regardless of when the suite runs.
		const eventDate = new Date();
		eventDate.setDate(1); // avoid month-length rollover when advancing the month
		eventDate.setMonth(eventDate.getMonth() + 3);
		eventDate.setDate(15);
		const eventDayLabel = String(eventDate.getDate());
		const expectedEventDate = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' }).format(
			eventDate,
		);
		const monthsToAdvance = 3;

		const form = detailsForm(page);
		await form.getByRole('textbox', { name: 'Název' }).fill('Detaily po úpravě');
		await form.getByRole('textbox', { name: 'Popis' }).fill('Popis seznamu darů');

		const eventDateField = form.getByLabel('Datum události (volitelné)');
		await eventDateField.click();
		const calendarPopover = page.locator('[data-slot="popover-content"]');
		await expect(calendarPopover).toBeVisible({ timeout: 5_000 });
		for (let i = 0; i < monthsToAdvance; i++) {
			await calendarPopover.getByRole('button', { name: 'Next' }).click();
		}
		await calendarPopover
			.locator('[data-bits-day]:not([data-outside-month])', {
				hasText: new RegExp(`^${eventDayLabel}$`),
			})
			.first()
			.click();
		// Selecting a day closes the popover; the trigger now shows the localized long date.
		await expect(eventDateField).toContainText(expectedEventDate);

		// Save lives in the fixed dialog footer, outside the scrolling details form.
		const saveButton = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(form.getByRole('button', { name: 'Uložit' })).toHaveCount(0);
		await settingsDialog.locator('.overflow-y-auto').evaluate((content) => {
			content.scrollTop = content.scrollHeight;
		});
		await expect(saveButton).toBeVisible();
		await saveButton.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		// Changes survive a full reload / fresh SSR render. The redirect stripped the
		// ?settings marker, so reopen the modal from the toolbar's settings action.
		await page.reload();
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

		const reloaded = detailsForm(page);
		await expect(reloaded.getByRole('textbox', { name: 'Název' })).toHaveValue(
			'Detaily po úpravě',
		);
		await expect(reloaded.getByRole('textbox', { name: 'Popis' })).toHaveValue(
			'Popis seznamu darů',
		);
		await expect(reloaded.getByLabel('Datum události (volitelné)')).toContainText(
			expectedEventDate,
		);

		await page.context().close();
	});

	test('new custom category is available in Add gift without reloading', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-live-refresh');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const categoryLabel = 'Vizuální kategorie';

		await createWishlistAndNavigate(page, 'Kategorie bez obnovení');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();

		const presetCheckboxes = settingsDialog.getByRole('checkbox');
		await expect(presetCheckboxes).toHaveCount(9);
		for (const checkbox of await presetCheckboxes.all()) {
			await expect(checkbox).toBeChecked();
		}

		await settingsDialog.getByPlaceholder('Vlastní kategorie').fill(categoryLabel);
		await settingsDialog.getByRole('button', { name: 'Vytvořit kategorii' }).click();
		await settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' })
			.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const giftDialog = page.getByRole('dialog');
		await giftDialog.getByRole('button', { name: 'Bez kategorie' }).click();
		await expect(page.getByRole('option', { name: categoryLabel, exact: true })).toBeVisible();

		await page.context().close();
	});

	test('custom category labels can be swapped atomically and persist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-label-swap');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Prohození kategorií');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		let settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();

		const newCategory = settingsDialog.getByPlaceholder('Vlastní kategorie');
		await newCategory.fill('Kategorie Alfa');
		await settingsDialog.getByRole('button', { name: 'Vytvořit kategorii' }).click();
		await newCategory.fill('Kategorie Beta');
		await settingsDialog.getByRole('button', { name: 'Vytvořit kategorii' }).click();
		const firstSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(firstSave).toBeEnabled();
		await firstSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 15_000 });
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();

		const customSection = settingsDialog
			.getByRole('heading', { name: 'Vlastní kategorie' })
			.locator('..');
		const labels = customSection.locator('input:not([type="color"])');
		await expect(labels).toHaveCount(2);
		const values = await labels.evaluateAll((inputs) =>
			inputs.map((input) => (input as HTMLInputElement).value),
		);
		const alfaIndex = values.indexOf('Kategorie Alfa');
		const betaIndex = values.indexOf('Kategorie Beta');
		expect(alfaIndex).toBeGreaterThanOrEqual(0);
		expect(betaIndex).toBeGreaterThanOrEqual(0);
		await labels.nth(alfaIndex).fill('Kategorie Beta');
		await labels.nth(betaIndex).fill('Kategorie Alfa');
		const swapSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(swapSave).toBeEnabled();
		await swapSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page.reload();
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		const persistedLabels = settingsDialog
			.getByRole('heading', { name: 'Vlastní kategorie' })
			.locator('..')
			.locator('input:not([type="color"])');
		await expect(persistedLabels).toHaveCount(2);
		await expect(persistedLabels.nth(alfaIndex)).toHaveValue('Kategorie Beta');
		await expect(persistedLabels.nth(betaIndex)).toHaveValue('Kategorie Alfa');

		await page.context().close();
	});

	test('zero-use category removal skips confirmation and persists', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-zero-use-category-removal');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Odebrání nepoužité kategorie');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		let settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		const books = settingsDialog.getByRole('checkbox', { name: 'Knihy' });
		await expect(books).toBeChecked();

		await books.click();

		await expect(books).not.toBeChecked();
		await expect(page.getByRole('dialog', { name: /Odebrat kategorii/ })).toHaveCount(0);
		const save = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(save).toBeEnabled();
		await save.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		await expect(settingsDialog.getByRole('checkbox', { name: 'Knihy' })).not.toBeChecked();

		await page.context().close();
	});

	test('confirmed category removal leaves its assigned gift uncategorized', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-removal');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const giftName = 'Dárek v odebírané kategorii';
		const categoryLabel = 'Dočasná kategorie';

		await createWishlistAndNavigate(page, 'Odebrání přiřazené kategorie');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		let settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		await settingsDialog.getByPlaceholder('Vlastní kategorie').fill(categoryLabel);
		await settingsDialog.getByRole('button', { name: 'Vytvořit kategorii' }).click();
		// Keep one default preset active so the gift editor can visibly render „Bez kategorie"
		// after the custom category is removed.
		const books = settingsDialog.getByRole('checkbox', { name: 'Knihy' });
		if (!(await books.isChecked())) {
			await books.click();
		}
		await expect(books).toBeChecked();
		const categoryCreateSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(categoryCreateSave).toBeEnabled();
		await categoryCreateSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		let giftDialog = page.getByRole('dialog');
		await giftDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
		await giftDialog.getByRole('button', { name: 'Bez kategorie' }).click();
		await page.getByRole('option', { name: categoryLabel }).click();
		await giftDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(giftDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: giftName, level: 3 })).toBeVisible();

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		const customSection = settingsDialog
			.getByRole('heading', { name: 'Vlastní kategorie' })
			.locator('..');
		await expect(customSection.getByTestId('gift-category-used-count')).toHaveText(
			'Použito: 1',
		);
		await customSection.getByRole('button', { name: 'Smazat' }).click();
		const confirmationDialog = page.getByRole('dialog').filter({
			has: page.getByRole('button', { name: 'Potvrdit odebrání', exact: true }),
		});
		await expect(confirmationDialog).toBeVisible();
		await confirmationDialog.getByRole('button', { name: 'Zrušit', exact: true }).click();
		await expect(confirmationDialog).not.toBeVisible();
		await expect(settingsDialog).toBeVisible();
		await expect(customSection.getByTestId('gift-category-used-count')).toHaveText(
			'Použito: 1',
		);
		await customSection.getByRole('button', { name: 'Smazat' }).click();
		await confirmationDialog.getByRole('button', { name: 'Potvrdit odebrání' }).click();
		const categoryRemoveSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(categoryRemoveSave).toBeEnabled();
		await categoryRemoveSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });
		await page.reload();

		await page.getByText(giftName, { exact: true }).click();
		giftDialog = page.getByRole('dialog');
		await expect(giftDialog.getByRole('button', { name: 'Bez kategorie' })).toBeVisible();

		await page.context().close();
	});

	test('manager import and export actions live in settings instead of the toolbar', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-data-actions');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Datové akce');
		await addGift(page, 'Dárek pro export');

		await expect(page.getByRole('button', { name: 'Importovat z tabulky' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Exportovat do tabulky' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Barevná paleta seznamu' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settingsDialog).toBeVisible({ timeout: 10_000 });
		await expect(
			settingsDialog.getByRole('button', { name: 'Importovat z tabulky' }),
		).not.toBeVisible();
		await expect(
			settingsDialog.getByRole('button', { name: 'Exportovat do tabulky' }),
		).not.toBeVisible();
		await settingsDialog.getByRole('tab', { name: 'Import a export' }).click();

		const downloadPromise = page.waitForEvent('download');
		await settingsDialog.getByRole('button', { name: 'Exportovat do tabulky' }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.csv$/);

		await settingsDialog.getByRole('button', { name: 'Importovat z tabulky' }).click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 5_000 });
		await expect(page.getByRole('dialog', { name: 'Importovat dárky' })).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('non-owner cannot use the settings action and cannot edit via direct URL', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-owner');
		const visitor = createTestUser('settings-visitor');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(ownerPage, 'Cizí seznam');
		const shortId = shortIdFromPath(path);
		await addGift(ownerPage, 'Test Gift');
		await shareWishlist(ownerPage);

		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(path);
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByRole('heading', { level: 1 })).toContainText('Cizí seznam', {
			timeout: 10_000,
		});

		// The owner-only settings action must not be visible to a visitor.
		await expect(
			visitorPage.getByRole('button', { name: 'Nastavení seznamu' }),
		).not.toBeVisible();

		// Direct navigation to the legacy settings URL redirects to the wishlist page and opens
		// the settings modal, which shows the manager-only notice instead of the edit form.
		// wishlist_settings_owner_only was reworded from „…pouze vlastník" to the obdarovaný/správce
		// wording („…pouze obdarovaný nebo správce." / „Only the recipient or a manager can edit …").
		await visitorPage.goto(`/w/${shortId}/settings`);
		await visitorPage.waitForLoadState('networkidle');
		await expect(
			visitorPage.getByText(
				/Nastavení seznamu může upravovat pouze obdarovaný nebo správce\.|Only the recipient or a manager can edit the wishlist settings\./,
			),
		).toBeVisible({ timeout: 10_000 });
		await expect(visitorPage.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await ownerPage.context().close();
		await visitorPage.context().close();
	});

	test('archived wishlist cannot be edited from the settings UI', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-archived');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(page, 'Archivovaný seznam');
		const shortId = shortIdFromPath(path);

		await archiveWishlist(page);
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Seznam byl archivován' }),
		).toBeVisible({ timeout: 10_000 });

		// The settings modal (via the legacy URL redirect) surfaces a read-only notice
		// and hides the edit form.
		await page.goto(`/w/${shortId}/settings`);
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText('Tento seznam je archivovaný a nelze jej upravovat.'),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await page.context().close();
	});
});
