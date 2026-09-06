import { test, expect, type Page, type Response } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift } from './fixtures/wishlist-helpers.js';

const REORDER_ACTION = 'Změnit pořadí';
const REORDER_HANDLE = 'Přesunout dárek';

function isSuccessfulRemoteMutation(response: Response): boolean {
	return (
		response.request().method() === 'POST' &&
		response.url().includes('/_app/remote/') &&
		response.ok()
	);
}

async function visibleGiftNames(page: Page, expectedCount = 3): Promise<string[]> {
	const items = page.locator('[data-gift-item]:not([data-gift-reorder-overlay])');
	await expect(items).toHaveCount(expectedCount, { timeout: 10_000 });
	return items.getByRole('heading', { level: 3 }).allTextContents();
}

function giftItem(page: Page, name: string) {
	return page.locator('[data-gift-item]:not([data-gift-reorder-overlay])').filter({
		has: page.getByRole('heading', { name, exact: true, level: 3 }),
	});
}

test('card drag preview stays stable while the pointer rests on a gift boundary', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-boundary');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await createWishlistAndNavigate(page, 'Gift Reorder Boundary Stability');

	const names = [
		'Reorder Boundary Gift A',
		'Reorder Boundary Gift B',
		'Reorder Boundary Gift C',
		'Reorder Boundary Gift D',
		'Reorder Boundary Gift E',
	];
	for (const name of names) {
		await addGift(page, name);
	}

	await expect(page.locator('[data-gift-item]')).toHaveCount(names.length, { timeout: 10_000 });
	await page.getByRole('button', { name: REORDER_ACTION, exact: true }).click();

	const aHandle = giftItem(page, names[0]!).getByRole('button', {
		name: REORDER_HANDLE,
		exact: true,
	});
	const bBox = await giftItem(page, names[1]!).boundingBox();
	const cBox = await giftItem(page, names[2]!).boundingBox();
	const handleBox = await aHandle.boundingBox();
	const initialOrder = await visibleGiftNames(page, names.length);
	expect(bBox, 'B card has a bounding box').not.toBeNull();
	expect(cBox, 'C card has a bounding box').not.toBeNull();
	expect(handleBox, 'A reorder handle has a bounding box').not.toBeNull();
	const boundaryX = (bBox!.x + bBox!.width + cBox!.x) / 2;
	const boundaryY = bBox!.y + bBox!.height / 2;

	await page.mouse.move(
		handleBox!.x + handleBox!.width / 2,
		handleBox!.y + handleBox!.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(boundaryX, boundaryY, { steps: 12 });

	const sampledOrders: string[] = [];
	for (let sample = 0; sample < 8; sample += 1) {
		await page.mouse.move(boundaryX, boundaryY);
		await page.waitForTimeout(60);
		sampledOrders.push((await visibleGiftNames(page, names.length)).join('|'));
	}

	expect(sampledOrders[0]).not.toBe(initialOrder.join('|'));
	expect(new Set(sampledOrders).size).toBe(1);
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await expect
		.poll(() => visibleGiftNames(page, names.length), { timeout: 10_000 })
		.toEqual(initialOrder);
});

test('gift order persists after card drag and rapid list keyboard moves', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await createWishlistAndNavigate(page, 'Gift Reorder Persistence');

	const names = {
		A: 'Reorder Gift A',
		B: 'Reorder Gift B',
		C: 'Reorder Gift C',
	};
	await addGift(page, names.A);
	await addGift(page, names.B);
	await addGift(page, names.C);

	await expect(page.locator('[data-gift-item]')).toHaveCount(3, { timeout: 10_000 });
	await page.getByRole('button', { name: REORDER_ACTION, exact: true }).click();

	const aHandle = giftItem(page, names.A).getByRole('button', {
		name: REORDER_HANDLE,
		exact: true,
	});
	const cItem = giftItem(page, names.C);
	await expect(aHandle).toBeVisible();
	const handleBox = await aHandle.boundingBox();
	const targetBox = await cItem.boundingBox();
	expect(handleBox, 'A reorder handle has a bounding box').not.toBeNull();
	expect(targetBox, 'C card has a bounding box').not.toBeNull();

	const cardMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
	await page.mouse.move(
		handleBox!.x + handleBox!.width / 2,
		handleBox!.y + handleBox!.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		targetBox!.x + targetBox!.width / 2,
		targetBox!.y + targetBox!.height / 2,
		{ steps: 10 },
	);
	await page.mouse.up();

	await expect
		.poll(() => visibleGiftNames(page), { timeout: 10_000 })
		.not.toEqual([names.A, names.B, names.C]);
	const cardOrder = await visibleGiftNames(page);
	await expect(page.locator('[data-gift-item]')).toHaveCount(3);
	await cardMutation;
	await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
	await page.reload({ waitUntil: 'load' });
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(cardOrder);

	await page.getByRole('radio', { name: 'Seznam', exact: true }).click();
	await expect(page.getByRole('radio', { name: 'Seznam', exact: true })).toBeChecked();
	// The radio changes before the animated card-to-list replacement finishes.
	await expect(page.locator('[data-wishlist-gift-collection]')).toHaveAttribute(
		'data-view-mode',
		'list',
	);
	await page.getByRole('button', { name: REORDER_ACTION, exact: true }).click();

	const mutationResponses: Response[] = [];
	const recordMutation = (response: Response) => {
		if (isSuccessfulRemoteMutation(response)) {
			mutationResponses.push(response);
		}
	};
	page.on('response', recordMutation);
	const bHandle = giftItem(page, names.B).getByRole('button', {
		name: REORDER_HANDLE,
		exact: true,
	});
	await bHandle.focus();
	await bHandle.press('ArrowDown');
	await bHandle.press('ArrowDown');
	await expect
		.poll(async () => (await visibleGiftNames(page)).at(-1), { timeout: 10_000 })
		.toBe(names.B);
	const listOrder = await visibleGiftNames(page);
	await expect(page.locator('[data-gift-item]')).toHaveCount(3);
	await expect
		.poll(() => mutationResponses.length, { timeout: 15_000 })
		.toBeGreaterThanOrEqual(2);
	page.off('response', recordMutation);

	await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
	await page.reload({ waitUntil: 'load' });
	const listRadio = page.getByRole('radio', { name: 'Seznam', exact: true });
	if (!(await listRadio.isChecked())) {
		await listRadio.click();
	}
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(listOrder);
	await expect(page.locator('[data-gift-item]')).toHaveCount(3);
});

test('latest gift order survives immediate reopen, no-op entry, a second reorder, and reload', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-reopen');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await createWishlistAndNavigate(page, 'Gift Reorder Reopen Persistence');

	const names = {
		A: 'Reopen Reorder Gift A',
		B: 'Reopen Reorder Gift B',
		C: 'Reopen Reorder Gift C',
	};
	await addGift(page, names.A);
	await addGift(page, names.B);
	await addGift(page, names.C);

	await expect(page.locator('[data-gift-item]')).toHaveCount(3, { timeout: 10_000 });
	await page.getByRole('radio', { name: 'Seznam', exact: true }).click();
	await expect(page.getByRole('radio', { name: 'Seznam', exact: true })).toBeChecked();
	await page.getByRole('button', { name: REORDER_ACTION, exact: true }).click();

	const firstMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
	const aHandle = giftItem(page, names.A).getByRole('button', {
		name: REORDER_HANDLE,
		exact: true,
	});
	await aHandle.focus();
	await aHandle.press('ArrowDown');
	await firstMutation;
	const firstOrder = [names.B, names.A, names.C];
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(firstOrder);

	await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(firstOrder);

	await page.getByRole('button', { name: REORDER_ACTION, exact: true }).click();
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(firstOrder);
	await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(firstOrder);

	await expect(page.getByRole('radio', { name: 'Seznam', exact: true })).toBeChecked();
	await page.getByRole('button', { name: REORDER_ACTION, exact: true }).click();

	const secondMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
	const cHandle = giftItem(page, names.C).getByRole('button', {
		name: REORDER_HANDLE,
		exact: true,
	});
	await cHandle.focus();
	await expect(cHandle).toBeFocused();
	await cHandle.press('ArrowUp');
	await secondMutation;
	const secondOrder = [names.B, names.C, names.A];
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(secondOrder);

	await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(secondOrder);
	await page.reload({ waitUntil: 'load' });
	const listRadio = page.getByRole('radio', { name: 'Seznam', exact: true });
	if (!(await listRadio.isChecked())) {
		await listRadio.click();
	}
	await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(secondOrder);
	await expect(page.locator('[data-gift-item]')).toHaveCount(3);
});
