import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	addGift,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';

function gift(page: Page, name: string) {
	return page
		.locator('[data-gift-item]')
		.filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function openSelectionFromContext(page: Page, giftName: string) {
	await gift(page, giftName).getByRole('heading', { name: giftName, exact: true }).click({
		button: 'right',
	});
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
	return page.getByRole('region', { name: 'Nástroje výběru' });
}

async function openFilterMenu(page: Page) {
	await page.getByRole('button', { name: /Filtrovat/ }).click();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function toggleFilterCheckbox(page: Page, name: string) {
	await openFilterMenu(page);
	await page.getByRole('menuitemcheckbox', { name }).click();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function selectPriorityFilter(page: Page, name: string) {
	if (!(await page.getByRole('menu').isVisible())) {
		await openFilterMenu(page);
	}
	await expect(async () => {
		const option = page.getByRole('menuitemcheckbox', { name });
		await option.click();
		await expect(option).toHaveAttribute('aria-checked', 'true');
	}).toPass();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function waitForReceivedState(giftRow: Locator, received: boolean) {
	const action = giftRow.getByTestId('gift-received-toggle');
	await expect(action).toHaveAccessibleName(
		received ? m.gift_mark_unreceived() : m.gift_mark_received(),
	);
	await expect(action).toHaveText(
		received ? m.gift_unreceived_compact() : m.gift_received_compact(),
	);
}

async function waitForToast(page: Page, text: string | RegExp) {
	await expect(page.locator('[data-sonner-toast]').filter({ hasText: text })).toBeVisible();
}

async function dismissToasts(page: Page) {
	const toasts = page.locator('[data-sonner-toast]');
	await toasts.locator('button[aria-label="Dismiss"]').evaluateAll((buttons) => {
		for (const button of buttons) {
			(button as HTMLButtonElement).click();
		}
	});
	await expect(toasts).toHaveCount(0);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	const body = await page.screenshot(
		process.env.ISSUE345_SCREENSHOTS === '1'
			? { path: `test-results/issue345-visual-${name}.png` }
			: undefined,
	);
	await testInfo.attach(name, { body, contentType: 'image/png' });
}

async function openMobileBulkAction(page: Page, action: string) {
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	const sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
	await sheet.locator(`[data-mobile-bulk-action="${action}"]`).click();
	return sheet;
}

async function createActionFixture(page: Page) {
	await createWishlistAndNavigate(page, 'Akce s dárky');
	await addGift(page, 'Kolo pro výlety');
	await addGift(page, 'Stan pro dva');
	await expect(page.locator('[data-gift-item]')).toHaveCount(2, { timeout: 10_000 });
}

async function createAdditionalWishlist(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('button', { name: /^Vytvořit(?: seznam)?$/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
	return new URL(page.url()).pathname;
}

async function applyNestedBulkOption(
	page: Page,
	sheet: Locator,
	action: string,
	option: string | number,
	selectedCount: number,
) {
	await sheet.locator(`[data-mobile-bulk-action="${action}"]`).click();
	const radio =
		typeof option === 'number'
			? sheet.getByRole('radio').nth(option)
			: sheet.getByRole('radio', { name: option });
	const selectedLabel = await radio.evaluate((element) =>
		element.closest('label')?.innerText.trim(),
	);
	expect(selectedLabel).toBeTruthy();
	await radio.click();
	await waitForToast(page, m.gift_bulk_success({ count: selectedCount }));
	await dismissToasts(page);
	await sheet.getByRole('button', { name: m.gift_context_back() }).click();
	await expect(sheet.locator(`[data-mobile-bulk-action="${action}"]`)).toContainText(
		selectedLabel!,
	);
	return selectedLabel!;
}

async function selectionCount(toolbar: Locator, count: number) {
	await expect(
		toolbar.locator('.mobile-selection-label:visible, .selection-count:visible'),
	).toContainText(`Vybráno ${count}`);
}

async function touchPoint(target: Locator) {
	const box = await target.boundingBox();
	expect(box).not.toBeNull();
	return { x: box!.x + 20, y: box!.y + 20 };
}

async function beginTouchLongPress(target: Locator) {
	const point = await touchPoint(target);
	await target.dispatchEvent('pointerdown', {
		pointerType: 'touch',
		clientX: point.x,
		clientY: point.y,
	});
	return point;
}

async function openMobileGiftActions(page: Page, target: Locator, giftName: string) {
	await beginTouchLongPress(target);
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByRole('heading', { name: giftName })).toBeVisible();
	await target.dispatchEvent('pointerup', { pointerType: 'touch' });
	return sheet;
}

test('desktop contextual selection works in both supported card and list views', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-desktop'),
	);
	await createActionFixture(page);

	await gift(page, 'Kolo pro výlety').click({ button: 'right', position: { x: 30, y: 30 } });
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Upravit dárek/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Priorita/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Kategorie/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /rezerv|líbí/i })).toHaveCount(0);
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();

	const toolbar = page.getByRole('region', { name: 'Nástroje výběru' });
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 1);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('button', { name: 'Hotovo' })).toBeVisible();
	await gift(page, 'Stan pro dva').click();
	await selectionCount(toolbar, 2);
	await page.getByRole('button', { name: 'Hotovo' }).click();
	await expect(toolbar).toBeHidden();

	await page.getByRole('radio', { name: /Seznam/ }).click();
	await gift(page, 'Stan pro dva').click({ button: 'right', position: { x: 30, y: 20 } });
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 1);
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: 'Hotovo' }).click();
	await expect(toolbar).toBeHidden();
	await page.context().close();
});

test('selection survives responsive reflow while normal controls remain replaced', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-selection-persistence'),
	);
	await createActionFixture(page);
	const toolbar = await openSelectionFromContext(page, 'Stan pro dva');
	await gift(page, 'Kolo pro výlety').click();
	await selectionCount(toolbar, 2);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('radio', { name: /Seznam/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Seskupení:/ })).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	await selectionCount(toolbar, 2);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await expect(
		toolbar.getByRole('checkbox', { name: 'Vybrat všechny viditelné dárky' }),
	).toBeChecked();
	await page.context().close();
});

test('mobile toolbar starts an empty selection from deterministic SSR markup', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-toolbar-selection'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const serverResponse = await page.context().request.get(page.url());
	expect(serverResponse.ok()).toBe(true);
	const serverRenderedHtml = await serverResponse.text();
	expect(
		serverRenderedHtml.match(/data-testid=(?:"gift-view-switcher"|'gift-view-switcher')/g) ??
			[],
	).toHaveLength(1);

	await page.getByTestId('mobile-more-trigger').click();
	await page
		.getByRole('dialog', { name: m.wishlist_more_actions() })
		.getByRole('button', { name: m.gift_selection_toolbar(), exact: true })
		.click();
	const toolbar = page.getByRole('region', {
		name: m.gift_selection_toolbar(),
		exact: true,
	});
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 0);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'false');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'false');
	await expect(page.getByTestId('gift-view-switcher')).toHaveCount(0);
	await page.context().close();
});

test('mobile long press opens Sheet drill-in and selection toolbar Actions row', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-actions-mobile');
	const authenticated = await registerAndGetPage(browser, request, baseURL!, user);
	await authenticated.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(authenticated);

	const target = gift(authenticated, 'Kolo pro výlety');
	await openMobileGiftActions(authenticated, target, 'Kolo pro výlety');
	await authenticated.getByRole('button', { name: 'Priorita' }).click();
	await expect(authenticated.getByRole('button', { name: 'Zpět' })).toBeVisible();
	await authenticated.getByRole('button', { name: 'Zpět' }).click();
	await authenticated.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = authenticated.getByRole('region', { name: 'Nástroje výběru' });
	const actions = toolbar.getByRole('button', { name: /Akce/ });
	await expect(actions).toBeVisible();
	await expect(toolbar.getByRole('button', { name: m.cancel() })).toBeVisible();

	await actions.click();
	const bulkSheet = authenticated.getByRole('dialog', {
		name: m.gift_selection_actions(),
	});
	await expect(bulkSheet).toBeVisible();
	await authenticated.keyboard.press('Escape');
	await expect(bulkSheet).toBeHidden();
	await selectionCount(toolbar, 1);
	await expect(target).toHaveAttribute('aria-selected', 'true');

	await authenticated.keyboard.press('Escape');
	await expect(toolbar).toBeHidden();
	await authenticated.context().close();
});

test('mobile bulk hierarchy fits all actions and restores focus through every nested level', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-hierarchy'),
	);
	await createActionFixture(page);
	await dismissToasts(page);
	await page.setViewportSize({ width: 320, height: 640 });
	await page.getByTestId('mobile-more-trigger').click();
	await page
		.getByRole('dialog', { name: m.wishlist_more_actions() })
		.getByRole('button', { name: m.gift_selection_toolbar(), exact: true })
		.click();
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
	const toolbarCheckbox = toolbar.getByRole('checkbox', { name: m.gift_selection_visible_all() });
	const toolbarChildren = toolbar.locator('.mobile-selection-row').locator(':scope > *');
	await expect(toolbarChildren.nth(0)).toHaveAttribute('role', 'checkbox');
	await expect(toolbarChildren.nth(1)).toHaveClass(/mobile-selection-label/);
	await expect(toolbar).not.toContainText(m.draft_grid_select_all());
	await toolbarCheckbox.click();
	await expect(toolbarCheckbox).toBeChecked();
	for (const width of [320, 360, 390]) {
		await page.setViewportSize({ width, height: 640 });
		await attachScreenshot(page, testInfo, `selection-toolbar-${width}x640`);
	}
	await page.setViewportSize({ width: 320, height: 640 });
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	const sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
	const actionRows = sheet.locator('[data-mobile-bulk-action]');
	await expect(actionRows).toHaveCount(6);
	await page.waitForTimeout(400);

	for (const width of [320, 360, 390]) {
		await page.setViewportSize({ width, height: 640 });
		await expect(actionRows).toHaveCount(6);
		await attachScreenshot(page, testInfo, `bulk-actions-${width}x640`);
	}

	await page.setViewportSize({ width: 320, height: 320 });
	const rootGeometry = await sheet
		.getByTestId('selection-bulk-sheet-actions')
		.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			rowBottoms: Array.from(
				element.querySelectorAll<HTMLElement>('[data-mobile-bulk-action]'),
			).map((row) => row.getBoundingClientRect().bottom),
		}));
	expect(rootGeometry.scrollHeight).toBeLessThanOrEqual(rootGeometry.clientHeight);
	expect(Math.max(...rootGeometry.rowBottoms)).toBeLessThanOrEqual(320);
	await attachScreenshot(page, testInfo, 'bulk-actions-320x320');

	for (const action of ['priority', 'category', 'imageFit', 'imageBackground', 'received']) {
		const invokingRow = sheet.locator(`[data-mobile-bulk-action="${action}"]`);
		await invokingRow.click();
		const back = sheet.getByRole('button', { name: m.gift_context_back() });
		await expect(back).toBeFocused();
		const options = sheet.getByTestId('selection-bulk-sheet-options');
		await expect(options).toBeVisible();
		if (action !== 'category') {
			const geometry = await options.evaluate((element) => ({
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
			}));
			expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight);
		}
		await attachScreenshot(page, testInfo, `bulk-${action}-320x320`);
		await back.click();
		await expect(sheet.locator(`[data-mobile-bulk-action="${action}"]`)).toBeFocused();
	}

	await sheet.locator('[data-mobile-bulk-action="copy"]').click();
	const copySheet = page.getByRole('dialog', { name: m.gift_bulk_copy_title() });
	await expect(copySheet).toBeVisible();
	await page.waitForTimeout(400);
	for (const button of [
		copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() }),
		copySheet.getByRole('button', { name: m.gift_context_back() }),
	]) {
		const box = await button.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.y + box!.height).toBeLessThanOrEqual(320);
	}
	await attachScreenshot(page, testInfo, 'bulk-copy-320x320');
	await copySheet.getByRole('button', { name: m.gift_context_back() }).click();
	await expect(sheet.locator('[data-mobile-bulk-action="copy"]')).toBeFocused();
	await expect(actionRows).toHaveCount(6);
	await page.context().close();
});

test('mobile bulk priority succeeds for one and multiple selected gifts', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-priority-regression'),
	);
	await page.setViewportSize({ width: 390, height: 760 });
	await createActionFixture(page);
	const firstGift = gift(page, 'Kolo pro výlety');
	const secondGift = gift(page, 'Stan pro dva');
	const contextSheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
	await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });

	let bulkSheet = await openMobileBulkAction(page, 'priority');
	await bulkSheet.getByRole('radio').nth(1).click();
	await waitForToast(page, m.gift_bulk_success({ count: 1 }));
	await bulkSheet.getByRole('button', { name: m.gift_context_back() }).click();
	await page.keyboard.press('Escape');
	await expect(bulkSheet).toBeHidden();
	await secondGift.click();
	await selectionCount(toolbar, 2);
	bulkSheet = await openMobileBulkAction(page, 'priority');
	await bulkSheet.getByRole('radio').nth(2).click();
	await waitForToast(page, m.gift_bulk_success({ count: 2 }));
	await expect(firstGift).toHaveAttribute('aria-selected', 'true');
	await expect(secondGift).toHaveAttribute('aria-selected', 'true');
	await expect(
		page.locator('[data-sonner-toast]').filter({ hasText: m.error_generic() }),
	).toHaveCount(0);
	await page.context().close();
});

test('all six mobile bulk actions refresh and persist on a shared list for one and multiple gifts', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-mutation-matrix'),
	);
	await createActionFixture(page);
	await shareWishlist(page);
	const sourcePath = new URL(page.url()).pathname;
	const destinationPath = await createAdditionalWishlist(page, 'Cíl hromadného kopírování');
	await page.goto(sourcePath);
	await expect(page.locator('[data-gift-item]')).toHaveCount(2);
	await dismissToasts(page);
	await page.setViewportSize({ width: 390, height: 760 });
	let firstGift = gift(page, 'Kolo pro výlety');
	let secondGift = gift(page, 'Stan pro dva');
	let contextSheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
	await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	let sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });

	await applyNestedBulkOption(page, sheet, 'priority', 1, 1);
	await applyNestedBulkOption(page, sheet, 'category', 1, 1);
	await applyNestedBulkOption(page, sheet, 'imageFit', m.image_fit_fit(), 1);
	await applyNestedBulkOption(page, sheet, 'imageBackground', m.image_background_black(), 1);
	await applyNestedBulkOption(page, sheet, 'received', m.gift_mark_received(), 1);
	await sheet.locator('[data-mobile-bulk-action="copy"]').click();
	let copySheet = page.getByRole('dialog', { name: m.gift_bulk_copy_title() });
	await expect(copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() })).toBeEnabled();
	await copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() }).click();
	await waitForToast(page, m.gift_bulk_copy_success({ count: 1 }));
	await dismissToasts(page);
	await selectionCount(toolbar, 1);
	await expect(sheet.locator('[data-mobile-bulk-action="copy"]')).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await toolbar.getByRole('button', { name: m.cancel() }).click();
	await page.reload();
	await expect(gift(page, 'Stan pro dva')).toBeVisible();
	await page.getByTestId('mobile-display-trigger').click();
	const displaySheet = page.getByRole('dialog', { name: m.gift_display_options() });
	await displaySheet.getByTestId('mobile-sheet-filter-switch').click();
	await displaySheet.getByRole('checkbox', { name: m.gift_filter_show_received() }).check();
	await page.keyboard.press('Escape');
	await expect(displaySheet).toBeHidden();
	firstGift = gift(page, 'Kolo pro výlety');
	secondGift = gift(page, 'Stan pro dva');
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);
	contextSheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
	await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	await secondGift.click();
	await selectionCount(toolbar, 2);
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
	for (const action of ['priority', 'category', 'imageFit', 'imageBackground', 'received']) {
		await expect(sheet.locator(`[data-mobile-bulk-action="${action}"]`)).toContainText(
			m.gift_selection_mixed(),
		);
	}

	const priorityLabel = await applyNestedBulkOption(page, sheet, 'priority', 2, 2);
	const categoryLabel = await applyNestedBulkOption(page, sheet, 'category', 2, 2);
	const imageFitLabel = await applyNestedBulkOption(
		page,
		sheet,
		'imageFit',
		m.image_fit_fill(),
		2,
	);
	const imageBackgroundLabel = await applyNestedBulkOption(
		page,
		sheet,
		'imageBackground',
		m.image_background_white(),
		2,
	);
	const receivedLabel = await applyNestedBulkOption(
		page,
		sheet,
		'received',
		m.gift_mark_unreceived(),
		2,
	);
	await sheet.locator('[data-mobile-bulk-action="copy"]').click();
	copySheet = page.getByRole('dialog', { name: m.gift_bulk_copy_title() });
	await expect(copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() })).toBeEnabled();
	await copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() }).click();
	await waitForToast(page, m.gift_bulk_copy_success({ count: 2 }));
	await dismissToasts(page);
	await selectionCount(toolbar, 2);
	await expect(firstGift).toHaveAttribute('aria-selected', 'true');
	await expect(secondGift).toHaveAttribute('aria-selected', 'true');
	await expect(
		page.locator('[data-sonner-toast]').filter({ hasText: m.error_generic() }),
	).toHaveCount(0);

	await page.keyboard.press('Escape');
	await toolbar.getByRole('button', { name: m.cancel() }).click();
	await page.reload();
	firstGift = gift(page, 'Kolo pro výlety');
	secondGift = gift(page, 'Stan pro dva');
	await waitForReceivedState(firstGift, false);
	await waitForReceivedState(secondGift, false);
	contextSheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
	await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	await secondGift.click();
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
	for (const [action, label] of [
		['priority', priorityLabel],
		['category', categoryLabel],
		['imageFit', imageFitLabel],
		['imageBackground', imageBackgroundLabel],
		['received', receivedLabel],
	] as const) {
		await expect(sheet.locator(`[data-mobile-bulk-action="${action}"]`)).toContainText(label);
	}

	await page.goto(destinationPath);
	await expect(page.locator('[data-gift-item]')).toHaveCount(3);
	await expect(gift(page, 'Kolo pro výlety')).toHaveCount(2);
	await expect(gift(page, 'Stan pro dva')).toHaveCount(1);
	await page.context().close();
});

test('mobile movement beyond the tolerance cancels a pending long press', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-movement-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const point = await beginTouchLongPress(target);
	await expect(target).toHaveAttribute('data-long-press-pending', 'true');
	await target.dispatchEvent('pointermove', {
		pointerType: 'touch',
		clientX: point.x + 9,
		clientY: point.y,
	});
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile scroll cancels a pending long press', async ({ browser, request, baseURL }) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-scroll-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	await beginTouchLongPress(target);
	await expect(target).toHaveAttribute('data-long-press-pending', 'true');
	await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile long press beginning on a card control does not open the actions Sheet', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-control-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const receivedControl = target.getByTestId('gift-received-toggle');
	await expect(receivedControl).toBeVisible();
	await beginTouchLongPress(receivedControl);
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile bulk actions expose mixed received state and apply a common value', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-mixed-bulk'),
	);
	await createActionFixture(page);
	const firstGift = gift(page, 'Kolo pro výlety');
	const secondGift = gift(page, 'Stan pro dva');
	await firstGift.getByTestId('gift-received-toggle').click();
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);

	await page.setViewportSize({ width: 390, height: 844 });
	const sheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
	await sheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = page.getByRole('region', { name: 'Nástroje výběru' });
	await secondGift.click();
	await selectionCount(toolbar, 2);

	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	const bulkSheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
	await expect(bulkSheet).toContainText(m.gift_selection_mixed());
	await bulkSheet.locator('[data-mobile-bulk-action="received"]').click();
	const markReceived = bulkSheet.getByRole('radio', { name: m.gift_mark_received() });
	const markUnreceived = bulkSheet.getByRole('radio', { name: m.gift_mark_unreceived() });
	await expect(markReceived).not.toBeChecked();
	await expect(markUnreceived).not.toBeChecked();
	await markReceived.click();

	await waitForToast(page, m.gift_bulk_success({ count: 2 }));
	await page.keyboard.press('Escape');
	await expect(bulkSheet).toBeHidden();
	await selectionCount(toolbar, 2);
	await expect(firstGift).toHaveAttribute('aria-selected', 'true');
	await expect(secondGift).toHaveAttribute('aria-selected', 'true');
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	await expect(bulkSheet.locator('[data-mobile-bulk-action="received"]')).toContainText(
		m.gift_mark_received(),
	);
	await page.keyboard.press('Escape');

	await toolbar.getByRole('button', { name: m.cancel() }).click();
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, true);
	await page.context().close();
});

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

	await page.getByRole('button', { name: new RegExp(`${m.gift_priority_label()}:`) }).click();
	await page.getByRole('menuitemradio', { name: /Vysok/i }).click();
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();

	const selectionActionsButton = page.getByRole('button', { name: m.gift_selection_actions() });
	if (await selectionActionsButton.count()) {
		await selectionActionsButton.click();
		await page.getByRole('menuitem', { name: m.gift_selection_received_state() }).click();
	} else {
		await page.getByRole('button', { name: m.gift_selection_received_state() }).click();
	}
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
	await page.getByRole('button', { name: m.gift_display_reset_aria() }).click();
	await expect(firstGift).toHaveCount(0);
	await waitForReceivedState(secondGift, false);
	await toggleFilterCheckbox(page, m.gift_filter_show_received());
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);
	await page.context().close();
});

test('list view persists on the local device after reload', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-view-mode-persistence'),
	);
	await createActionFixture(page);

	const listRadio = page.getByRole('radio', { name: m.gift_view_list(), exact: true });
	await listRadio.click();
	await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
	await expect(listRadio).toBeChecked();

	await page.reload();
	await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
	await expect(page.getByRole('radio', { name: m.gift_view_list(), exact: true })).toBeChecked();
	await page.context().close();
});

test('compact view remains excluded from gift actions', async ({ browser, request, baseURL }) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-compact'),
	);
	await createActionFixture(page);
	await expect(page.getByRole('button', { name: /Kompaktní/ })).toHaveCount(0);
	await page.evaluate(() => {
		window.localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify('compact'));
	});
	await page.reload();
	await expect(page.locator('[data-view-mode="compact"]')).toBeVisible();
	await page.getByText('Kolo pro výlety', { exact: true }).click({
		button: 'right',
		position: { x: 30, y: 10 },
	});
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Nástroje výběru' })).toHaveCount(0);
	await page.context().close();
});
