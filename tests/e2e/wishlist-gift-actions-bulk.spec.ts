import { test, expect, type Locator } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { shareWishlist } from './fixtures/wishlist-helpers.js';
import {
	gift,
	createActionFixture,
	dismissToasts,
	attachScreenshot,
	openMobileGiftActions,
	openMobileBulkAction,
	selectionCount,
	waitForToast,
	applyNestedBulkOption,
	waitForReceivedState,
	createAdditionalWishlist,
} from './wishlist-gift-actions.helpers.js';

async function waitForSheetAnimations(sheet: Locator): Promise<void> {
	await sheet.evaluate(async (element) => {
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});
}

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
	await waitForSheetAnimations(sheet);

	for (const width of [320, 360, 390]) {
		await page.setViewportSize({ width, height: 640 });
		await expect(actionRows).toHaveCount(6);
		const fittingBody = sheet.getByTestId('selection-bulk-sheet-actions').locator('..');
		const fittingGeometry = await fittingBody.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
		}));
		expect(fittingGeometry.scrollHeight).toBeLessThanOrEqual(fittingGeometry.clientHeight);
		await attachScreenshot(page, testInfo, `bulk-actions-${width}x640`);
	}

	await page.setViewportSize({ width: 320, height: 320 });
	const scrollBody = sheet.getByTestId('selection-bulk-sheet-actions').locator('..');
	const shortGeometry = await sheet.evaluate((dialog) => {
		const body = dialog.querySelector<HTMLElement>(
			'[data-testid="selection-bulk-sheet-actions"]',
		)!.parentElement!;
		const dialogRect = dialog.getBoundingClientRect();
		const bodyRect = body.getBoundingClientRect();
		return {
			dialogTop: dialogRect.top,
			dialogBottom: dialogRect.bottom,
			bodyTop: bodyRect.top,
			bodyBottom: bodyRect.bottom,
			bodyClientHeight: body.clientHeight,
			bodyScrollHeight: body.scrollHeight,
			rowMinHeights: Array.from(
				dialog.querySelectorAll<HTMLElement>('[data-mobile-bulk-action]'),
			).map((row) => Number.parseFloat(getComputedStyle(row).minHeight)),
		};
	});
	expect(shortGeometry.dialogTop).toBeGreaterThanOrEqual(0);
	expect(shortGeometry.dialogBottom).toBeLessThanOrEqual(320);
	expect(shortGeometry.bodyTop).toBeGreaterThanOrEqual(0);
	expect(shortGeometry.bodyBottom).toBeLessThanOrEqual(320);
	expect(shortGeometry.bodyScrollHeight).toBeGreaterThan(shortGeometry.bodyClientHeight);
	expect(shortGeometry.rowMinHeights.every((height) => height >= 48)).toBe(true);

	const physicalPixelTolerance = await page.evaluate(() => 1 / window.devicePixelRatio);
	for (const actionRow of await actionRows.all()) {
		await actionRow.scrollIntoViewIfNeeded();
		const rowBox = await actionRow.boundingBox();
		const bodyBox = await scrollBody.boundingBox();
		expect(rowBox).not.toBeNull();
		expect(bodyBox).not.toBeNull();
		const clipTop = Math.max(0, bodyBox!.y);
		const clipBottom = Math.min(320, bodyBox!.y + bodyBox!.height);
		expect(rowBox!.y).toBeGreaterThanOrEqual(clipTop - physicalPixelTolerance);
		expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(clipBottom + physicalPixelTolerance);
	}
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
	await waitForSheetAnimations(copySheet);
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
