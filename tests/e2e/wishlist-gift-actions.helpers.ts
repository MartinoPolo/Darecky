import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import {
	createWishlistAndNavigate,
	openCreateWishlistDialog,
	addGift,
	openDesktopDisplaySubmenu,
} from './fixtures/wishlist-helpers.js';

export function gift(page: Page, name: string) {
	return page
		.locator('[data-gift-item]')
		.filter({ has: page.getByRole('heading', { name, exact: true }) });
}

export function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function openSelectionFromContext(page: Page, giftName: string) {
	await gift(page, giftName).getByRole('heading', { name: giftName, exact: true }).click({
		button: 'right',
	});
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
	return page.getByRole('region', { name: 'Nástroje výběru' });
}

export async function openFilterMenu(page: Page, optionName: string) {
	const filterMenu = await openDesktopDisplaySubmenu(
		page,
		new RegExp(`^${escapeRegex(m.gift_filter())}`),
	);
	const option = filterMenu.getByRole('menuitemcheckbox', { name: optionName, exact: true });
	await expect(option).toHaveCount(1);
	await expect(option).toBeVisible();
	return { displayMenu: filterMenu, option };
}

async function closeDisplayMenu(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-slot="dropdown-menu-sub-content"]:visible')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(
		page.getByRole('menu', { name: m.gift_display_options(), exact: true }),
	).toBeHidden();
}

export async function toggleFilterCheckbox(page: Page, name: string) {
	const { displayMenu, option } = await openFilterMenu(page, name);
	await option.focus();
	await option.press('Space');
	await expect(displayMenu).toBeVisible();
	await closeDisplayMenu(page);
}

export async function selectPriorityFilter(page: Page, name: string) {
	const displayMenu = page.getByRole('menu', { name: m.gift_display_options(), exact: true });
	let option = page
		.getByRole('menuitemcheckbox', { name, exact: true })
		.filter({ visible: true });
	if ((await option.count()) === 0) {
		({ option } = await openFilterMenu(page, name));
	}
	await expect(option).toHaveCount(1);
	await option.focus();
	await option.press('Space');
	await expect(option).toHaveAttribute('aria-checked', 'true');
	await expect(displayMenu).toBeVisible();
	await closeDisplayMenu(page);
}

export async function waitForReceivedState(giftRow: Locator, received: boolean) {
	const action = giftRow.getByTestId('gift-received-toggle');
	await expect(action).toHaveAccessibleName(
		received ? m.gift_mark_unreceived() : m.gift_mark_received(),
	);
	await expect(action).toHaveText(
		received ? m.gift_unreceived_compact() : m.gift_received_compact(),
	);
}

export async function waitForToast(page: Page, text: string | RegExp) {
	await expect(page.locator('[data-sonner-toast]').filter({ hasText: text })).toBeVisible();
}

export async function dismissToasts(page: Page) {
	const toasts = page.locator('[data-sonner-toast]');
	await toasts.locator('button[aria-label="Dismiss"]').evaluateAll((buttons) => {
		for (const button of buttons) {
			(button as HTMLButtonElement).click();
		}
	});
	await expect(toasts).toHaveCount(0);
}

export async function expectBodyPointerEventsRestored(page: Page) {
	await expect
		.poll(() => page.locator('body').evaluate((body) => body.style.pointerEvents))
		.toBe('');
	await expect
		.poll(() => page.locator('body').evaluate((body) => getComputedStyle(body).pointerEvents))
		.toBe('auto');
}

export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	const body = await page.screenshot(
		process.env.ISSUE345_SCREENSHOTS === '1'
			? { path: `test-results/issue345-visual-${name}.png` }
			: undefined,
	);
	await testInfo.attach(name, { body, contentType: 'image/png' });
}

export async function openMobileBulkAction(page: Page, action: string) {
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	const sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
	await sheet.locator(`[data-mobile-bulk-action="${action}"]`).click();
	return sheet;
}

export async function createActionFixture(page: Page) {
	await createWishlistAndNavigate(page, 'Akce s dárky');
	await addGift(page, 'Kolo pro výlety');
	await addGift(page, 'Stan pro dva');
	await expect(page.locator('[data-gift-item]')).toHaveCount(2, { timeout: 10_000 });
}

export async function createAdditionalWishlist(page: Page, title: string) {
	await page.goto('/my-lists');
	const dialog = await openCreateWishlistDialog(page);
	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
	return new URL(page.url()).pathname;
}

export async function applyNestedBulkOption(
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

export async function selectionCount(toolbar: Locator, count: number) {
	await expect(
		toolbar.locator('.mobile-selection-label:visible, .selection-count:visible'),
	).toContainText(`Vybráno ${count}`);
}

export async function touchPoint(target: Locator) {
	const box = await target.boundingBox();
	expect(box).not.toBeNull();
	return { x: box!.x + 20, y: box!.y + 20 };
}

export async function beginTouchLongPress(target: Locator) {
	const point = await touchPoint(target);
	await target.dispatchEvent('pointerdown', {
		pointerType: 'touch',
		clientX: point.x,
		clientY: point.y,
	});
	return point;
}

export async function openMobileGiftActions(page: Page, target: Locator, giftName: string) {
	await beginTouchLongPress(target);
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByRole('heading', { name: giftName })).toBeVisible();
	await target.dispatchEvent('pointerup', { pointerType: 'touch' });
	return sheet;
}
