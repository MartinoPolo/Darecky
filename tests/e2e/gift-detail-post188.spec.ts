import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	addGift,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';
import { GIFT_CROP_TARGET_SPECS } from '../../src/lib/modules/images/crop_targets.js';
import * as m from '../../src/lib/paraglide/messages.js';

/**
 * E2E coverage for the issue #328 gift-state matrix plus detail gaps that the
 * #188/#189 work left open:
 *
 *  1. Issues #328/#341: received and reservation states use one centered overlay with
 *     full-size sibling pills and card/list parity across roles.
 *  2. The "Upraveno po sdílení" (edited-after-share) transparency line renders
 *     on BOTH the owner's edit form (`GiftDetailForm.svelte`
 *     `editedAfterShareLine`) and the read-only visitor detail view
 *     (`GiftDetailView.svelte`, message key `gift_edited_after_share_line`)
 *     once a gift is edited after its wishlist was shared (issue #185).
 *  3. The read-only visitor detail view (`GiftDetailView.svelte` ~L64-71,
 *     issue #183 REQ-10) renders the full, uncropped photo at its natural
 *     aspect ratio instead of a crop-target aspect.
 */

const SAMPLE_IMAGE_PORTRAIT_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

/** Wait for the same-origin upload proxy to confirm a stored object (PUT → 201). */
function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

function gift(page: Page, name: string): Locator {
	return page
		.locator('[data-gift-item]')
		.filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function reserveGift(page: Page, name: string): Promise<void> {
	const giftItem = gift(page, name);
	await giftItem.getByTestId('reserve-button').click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

async function exposeReceivedGifts(page: Page, giftName: string): Promise<void> {
	const activeFilterRemovalButton = page
		.getByTestId('wishlist-toolbar-active-filters')
		.getByRole('button', {
			name: m.filter_remove({ label: m.gift_filter_show_received() }),
			exact: true,
		});
	const filterButton = page.getByRole('button', { name: /^Filtrovat/ });
	const option = page.getByRole('menuitemcheckbox', {
		name: m.gift_filter_show_received(),
		exact: true,
	});
	if (await activeFilterRemovalButton.isVisible()) {
		return;
	}

	await filterButton.click();
	await expect(async () => {
		if ((await activeFilterRemovalButton.isVisible()) || (await option.isVisible())) {
			return;
		}
		if ((await filterButton.getAttribute('aria-expanded')) !== 'true') {
			await filterButton.click();
		}
		await expect(activeFilterRemovalButton.or(option)).toBeVisible({ timeout: 1_000 });
	}).toPass();

	if (await activeFilterRemovalButton.isVisible()) {
		if ((await filterButton.getAttribute('aria-expanded')) === 'true') {
			await page.keyboard.press('Escape');
			await expect(filterButton).toHaveAttribute('aria-expanded', 'false');
		}
		return;
	}

	await expect(option).toBeVisible();
	if (!(await option.isChecked())) {
		await option.click();
	}
	if ((await filterButton.getAttribute('aria-expanded')) === 'true') {
		await page.keyboard.press('Escape');
		await expect(filterButton).toHaveAttribute('aria-expanded', 'false');
	}
	await expect(activeFilterRemovalButton).toBeVisible();
	await expect(gift(page, giftName)).toBeVisible();
}

interface OverlayExpectation {
	primary: string;
	support?: string;
	bodyName?: string;
	forbiddenText?: RegExp;
}

async function assertCenteredOverlay(
	giftItem: Locator,
	{ primary, support, bodyName, forbiddenText }: OverlayExpectation,
): Promise<void> {
	const overlay = giftItem.getByTestId('gift-state-overlay');
	await expect(overlay).toHaveCount(1);
	await expect(overlay.locator('[data-state-primary]')).toHaveText(primary);
	const supportElement = overlay.locator('[data-reservation-support]');
	if (support === undefined) {
		await expect(supportElement).toHaveCount(0);
	} else {
		await expect(supportElement).toHaveText(support);
	}
	if (bodyName !== undefined) {
		await expect(giftItem.getByText(bodyName)).toBeVisible();
		await expect(overlay.getByText(bodyName)).toHaveCount(0);
	}
	if (forbiddenText !== undefined) {
		await expect(giftItem).not.toContainText(forbiddenText);
	}

	const pills = overlay.locator(':scope > span');
	await expect(pills).toHaveCount(support === undefined ? 1 : 2);
	if (support !== undefined) {
		const [primaryStyle, supportStyle] = await Promise.all([
			pills.nth(0).evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					fontSize: style.fontSize,
					fontWeight: style.fontWeight,
					padding: style.padding,
					borderWidth: style.borderWidth,
					boxShadow: style.boxShadow,
				};
			}),
			pills.nth(1).evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					fontSize: style.fontSize,
					fontWeight: style.fontWeight,
					padding: style.padding,
					borderWidth: style.borderWidth,
					boxShadow: style.boxShadow,
				};
			}),
		]);
		expect(supportStyle).toEqual(primaryStyle);
	}

	const imageFrame = overlay.locator('xpath=..');
	await expect(imageFrame).toHaveAttribute(
		'data-testid',
		/^(gift-card-image-frame|gift-list-image)$/,
	);
	const [imageFrameBox, imageFrameBorders, pillBoxes] = await Promise.all([
		imageFrame.boundingBox(),
		imageFrame.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				left: Number.parseFloat(style.borderLeftWidth),
				right: Number.parseFloat(style.borderRightWidth),
				top: Number.parseFloat(style.borderTopWidth),
				bottom: Number.parseFloat(style.borderBottomWidth),
			};
		}),
		pills.evaluateAll((elements) =>
			elements.map((element) => element.getBoundingClientRect().toJSON()),
		),
	]);
	expect(imageFrameBox, 'active image frame has a bounding box').not.toBeNull();
	expect(pillBoxes.length, 'overlay pills have bounding boxes').toBeGreaterThan(0);
	const stackBox = {
		x: Math.min(...pillBoxes.map((box) => box.x)),
		y: Math.min(...pillBoxes.map((box) => box.y)),
		right: Math.max(...pillBoxes.map((box) => box.right)),
		bottom: Math.max(...pillBoxes.map((box) => box.bottom)),
	};
	const imageContentCenter = {
		x:
			imageFrameBox!.x +
			imageFrameBorders.left +
			(imageFrameBox!.width - imageFrameBorders.left - imageFrameBorders.right) / 2,
		y:
			imageFrameBox!.y +
			imageFrameBorders.top +
			(imageFrameBox!.height - imageFrameBorders.top - imageFrameBorders.bottom) / 2,
	};
	expect(stackBox.x + (stackBox.right - stackBox.x) / 2).toBeCloseTo(imageContentCenter.x, 0);
	if ((await overlay.evaluate((element) => getComputedStyle(element).paddingTop)) === '0px') {
		expect(stackBox.y + (stackBox.bottom - stackBox.y) / 2).toBeCloseTo(
			imageContentCenter.y,
			0,
		);
	}
}

async function assertOverlayInCardAndList(
	page: Page,
	giftName: string,
	expectation: OverlayExpectation,
): Promise<void> {
	for (const view of ['card', 'list'] as const) {
		const viewControl = page.locator(`[data-testid="gift-view-${view}"]:visible`);
		await viewControl.click();
		await expect(viewControl).toBeChecked();
		await assertCenteredOverlay(gift(page, giftName), expectation);
	}
}

async function expectBefore(first: Locator, second: Locator): Promise<void> {
	await expect
		.poll(async () => {
			const secondElement = await second.elementHandle();
			if (!secondElement) {
				return false;
			}
			return first.evaluate(
				(firstElement, secondNode) =>
					firstElement.isConnected &&
					secondNode.isConnected &&
					Boolean(
						firstElement.compareDocumentPosition(secondNode) &
						Node.DOCUMENT_POSITION_FOLLOWING,
					),
				secondElement,
			);
		})
		.toBe(true);
}

async function assertReceivedSectionOrder(
	page: Page,
	receivedGiftName: string,
	activeGiftNames: readonly string[],
): Promise<void> {
	const receivedHeading = page.getByRole('heading', { name: 'Obdržené', exact: true });
	await expect(receivedHeading).toHaveCount(1);
	for (const activeGiftName of activeGiftNames) {
		await expectBefore(gift(page, activeGiftName), receivedHeading);
	}
	await expectBefore(receivedHeading, gift(page, receivedGiftName));
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Issue #328 gift-state matrix and post-#188/#189 detail gaps', () => {
	test('received recipient state stays private and centered in card and list views', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipient = createTestUser('gift-received-recipient');
		const recipientPage = await registerAndGetPage(browser, request, baseURL!, recipient);
		await createWishlistAndNavigate(recipientPage, 'Received Overlay Coverage');
		const giftName = 'Testovací přijatý dárek';
		const activeGiftNames = ['Testovací aktivní dárek první', 'Testovací aktivní dárek druhý'];
		await addGift(recipientPage, giftName);
		for (const activeGiftName of activeGiftNames) {
			await addGift(recipientPage, activeGiftName);
		}
		await shareWishlist(recipientPage);
		const wishlistPath = new URL(recipientPage.url()).pathname;

		const reserver = createTestUser('gift-received-reserver');
		const reserverPage = await registerAndGetPage(browser, request, baseURL!, reserver);
		await reserverPage.goto(wishlistPath);
		await reserveGift(reserverPage, giftName);
		await reserverPage.context().close();

		await recipientPage.reload();
		const recipientGift = gift(recipientPage, giftName);
		await recipientGift.getByRole('button', { name: 'Označit jako přijatý' }).click();
		await expect(
			recipientGift.locator('[data-state-primary][data-state-kind="received"]'),
		).toHaveText('Přijato', { timeout: 10_000 });
		await expect(recipientPage.getByRole('dialog')).toHaveCount(0);
		await expect(recipientGift.getByTestId('release-reservation-button')).toHaveCount(0);

		await recipientGift.getByRole('button', { name: 'Označit jako nepřijatý' }).click();
		await expect(
			recipientGift.getByRole('button', { name: 'Označit jako přijatý' }),
		).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			recipientGift.locator('[data-state-primary][data-state-kind="received"]'),
		).toHaveCount(0);
		await expect(
			recipientPage.getByRole('heading', { name: 'Obdržené', exact: true }),
		).toHaveCount(0);
		await recipientGift.getByRole('button', { name: 'Označit jako přijatý' }).click();
		await expect(
			recipientGift.locator('[data-state-primary][data-state-kind="received"]'),
		).toHaveText('Přijato', { timeout: 10_000 });

		await assertReceivedSectionOrder(recipientPage, giftName, activeGiftNames);
		await assertOverlayInCardAndList(recipientPage, giftName, {
			primary: 'Přijato',
			forbiddenText: new RegExp(`rezerv|\\d+\\s+rezervováno|${reserver.name}`, 'i'),
		});
		await assertReceivedSectionOrder(recipientPage, giftName, activeGiftNames);
		await expect(
			gift(recipientPage, giftName).locator('[data-reservation-support]'),
		).toHaveCount(0);
		await recipientPage.context().close();
	});

	test('moderator, reserver, and foreign visitor keep overlay parity through receipt', async ({
		browser,
		request,
		baseURL,
	}) => {
		const moderator = createTestUser('gift-state-moderator');
		const moderatorPage = await registerAndGetPage(browser, request, baseURL!, moderator);
		await createWishlistForSomeoneAndNavigate(moderatorPage, {
			title: 'Moderator Overlay Matrix',
			recipientName: 'Anička',
		});
		const giftName = 'Dárek pro stavovou matici';
		await addGift(moderatorPage, giftName);
		await shareWishlist(moderatorPage);
		const wishlistPath = new URL(moderatorPage.url()).pathname;

		const reserver = createTestUser('gift-state-reserver');
		const reserverPage = await registerAndGetPage(browser, request, baseURL!, reserver);
		await reserverPage.goto(wishlistPath);
		await reserveGift(reserverPage, giftName);
		await assertOverlayInCardAndList(reserverPage, giftName, {
			primary: 'Rezervováno vámi',
		});

		const foreignVisitor = createTestUser('gift-state-foreign');
		const foreignPage = await registerAndGetPage(browser, request, baseURL!, foreignVisitor);
		await foreignPage.goto(wishlistPath);
		await assertOverlayInCardAndList(foreignPage, giftName, {
			primary: 'Rezervováno někým jiným',
			forbiddenText: new RegExp(reserver.name, 'i'),
		});

		await moderatorPage.reload();
		await assertOverlayInCardAndList(moderatorPage, giftName, {
			primary: 'Rezervováno někým jiným',
			bodyName: reserver.name,
		});
		const moderatorGift = gift(moderatorPage, giftName);
		await moderatorGift.getByRole('button', { name: 'Označit jako přijatý' }).click();
		await expect(moderatorGift.getByText('Přijato', { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		await assertOverlayInCardAndList(moderatorPage, giftName, {
			primary: 'Přijato',
			support: 'Rezervováno někým jiným',
			bodyName: reserver.name,
		});

		await reserverPage.goto(wishlistPath);
		await exposeReceivedGifts(reserverPage, giftName);
		await assertOverlayInCardAndList(reserverPage, giftName, {
			primary: 'Přijato',
			support: 'Rezervováno vámi',
			forbiddenText: new RegExp(moderator.name, 'i'),
		});

		await foreignPage.goto(wishlistPath);
		await exposeReceivedGifts(foreignPage, giftName);
		await assertOverlayInCardAndList(foreignPage, giftName, {
			primary: 'Přijato',
			support: 'Rezervováno někým jiným',
			forbiddenText: new RegExp(reserver.name, 'i'),
		});

		await foreignPage.context().close();
		await reserverPage.context().close();
		await moderatorPage.context().close();
	});

	test('edited-after-share line appears on both the editor and the visitor detail view', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-edited-after-share');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Edited After Share Coverage');
		const giftName = 'Testovaci darek upraveny';
		await addGift(ownerPage, giftName, { price: '300' });
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;

		// Edit a tracked field (price) after sharing – this is what actually sets
		// `editedAfterShareAt` server-side (gift_post_share.ts
		// computePreShareOwnerEdit + computePostShareEditTransparency): any
		// changed tracked field badges the gift, even inside the post-share
		// grace window.
		const giftItem = ownerPage.locator('[data-gift-item]').filter({ hasText: giftName });
		await giftItem.click();
		const editDialog = ownerPage.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await editDialog.locator('#gift-price').fill('450');
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

		// Reopen the editor: GiftDetailForm's `editedAfterShareLine` derived
		// renders the same i18n'd line the visitor view uses (message key
		// `gift_edited_after_share_line`, stable "Upraveno po sdílení" prefix).
		// The save closes the dialog before its own `refreshData()` resolves, so
		// retry the open/read until the refreshed gift carries the flag instead
		// of racing a single reopen (never `waitUntil: 'networkidle'` – this
		// surface has long-lived query subscriptions that keep the network busy).
		await expect(async () => {
			await giftItem.click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
			const editedLineVisible = await editDialog
				.getByText(/Upraveno po sdílení/)
				.isVisible()
				.catch(() => false);
			if (!editedLineVisible) {
				await ownerPage.keyboard.press('Escape');
				await expect(editDialog).not.toBeVisible({ timeout: 2_000 });
				throw new Error('editedAfterShareLine not visible yet');
			}
		}).toPass({ timeout: 15_000 });
		await ownerPage.keyboard.press('Escape');
		await expect(editDialog).not.toBeVisible({ timeout: 5_000 });
		await ownerPage.context().close();

		// The read-only visitor detail view (GiftDetailView.svelte) renders the
		// identical muted line – a fresh navigation reads the current DB state
		// directly, so no reopen race applies here.
		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.getByText(giftName, { exact: true }).first().click();
		const visitorDialog = visitorPage.getByRole('dialog');
		await expect(visitorDialog).toBeVisible({ timeout: 5_000 });
		await expect(visitorDialog.getByText(/Upraveno po sdílení/)).toBeVisible({
			timeout: 10_000,
		});

		await visitorContext.close();
	});

	test('visitor detail view renders the full uncropped photo at its natural aspect', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-detail-natural-aspect');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Detail Natural Aspect Coverage');
		const giftName = 'Testovaci darek portret';

		await ownerPage
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const addDialog = ownerPage.getByRole('dialog');
		await expect(addDialog).toBeVisible({ timeout: 5_000 });
		await addDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);

		await addDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = addDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(ownerPage);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PORTRAIT_PATH);
		await uploaded;
		await expect(addDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});

		await addDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(ownerPage.getByRole('heading', { name: giftName, level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.getByText(giftName, { exact: true }).first().click();
		const visitorDialog = visitorPage.getByRole('dialog');
		await expect(visitorDialog).toBeVisible({ timeout: 5_000 });

		const detailImage = visitorDialog
			.getByTestId('gift-detail-view-image-column')
			.locator('img');
		await expect(detailImage).toBeVisible({ timeout: 10_000 });
		const box = await detailImage.boundingBox();
		expect(box, 'detail image has a bounding box').not.toBeNull();
		const ratio = box!.width / box!.height;

		// The source is a portrait fixture (20x40px, natural ratio 0.5) – the
		// detail view must render it at that natural ratio, NOT the `square` 4:3
		// card crop target and NOT a 1:1 crop.
		expect(ratio, 'detail image renders portrait, not landscape/square').toBeLessThan(0.95);
		expect(
			Math.abs(ratio - GIFT_CROP_TARGET_SPECS.square.aspect),
			'ratio is clearly not the 4:3 square crop target',
		).toBeGreaterThan(0.3);
		expect(Math.abs(ratio - 1), 'ratio is clearly not 1:1').toBeGreaterThan(0.3);

		await visitorContext.close();
	});
});
