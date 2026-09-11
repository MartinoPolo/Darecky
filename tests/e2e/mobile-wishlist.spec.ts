import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	archiveWishlist,
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';

const MOBILE_HEIGHT = 844;
const WIDTHS = [320, 360, 390] as const;

async function createManagerWishlist(
	page: Page,
	title = 'Mobilní seznam pro Aničku',
): Promise<string> {
	await createWishlistForSomeoneAndNavigate(page, { title, recipientName: 'Anička' });
	await addGift(page, 'Dlouhý název dárku který se musí bezpečně vejít na přesně dva řádky', {
		price: '1299',
	});
	await addGift(page, 'Dárek bez ceny');
	await addGift(page, 'Třetí dárek', { price: '499' });
	// The reusable share helper targets the labeled desktop action; narrow production uses
	// the approved hero overflow sheet, so temporarily expose that same action without
	// duplicating the share-wizard implementation in this spec.
	await page.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
	await shareWishlist(page);
	await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
	await dismissToasts(page);
	return new URL(page.url()).pathname;
}

async function addQuantityGift(page: Page, name: string, quantity: number) {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('textbox', { name: 'Název' }).fill(name);
	await dialog.locator('#gift-quantity').fill(String(quantity));
	await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
}

function gift(page: Page, name: string) {
	return page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name, exact: true }),
	});
}

async function dismissToasts(page: Page) {
	const toasts = page.locator('[data-sonner-toast]');
	// Sonner reorders its live stack as each toast exits, so cached nth() locators can start
	// targeting an already-moving toast underneath the next one. Dismiss the current buttons in
	// one DOM turn and then wait for every exit animation to remove its toast.
	await toasts.locator('button[aria-label="Dismiss"]').evaluateAll((buttons) => {
		for (const button of buttons) {
			(button as HTMLButtonElement).click();
		}
	});
	await expect(toasts).toHaveCount(0);
}

async function resetAllScroll(page: Page) {
	await page.evaluate(() => {
		document.querySelectorAll<HTMLElement>('*').forEach((element) => {
			element.scrollTop = 0;
		});
		window.scrollTo(0, 0);
	});
}

async function waitForGiftAnimationsToSettle(page: Page) {
	await page.locator('[data-gift-item]:visible').evaluateAll(async (elements) => {
		const animations = elements.flatMap((element) => element.getAnimations({ subtree: true }));
		await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	});
}

async function box(locator: Locator) {
	const value = await locator.boundingBox();
	expect(value, `Expected ${locator} to have a bounding box`).not.toBeNull();
	return value!;
}

async function expectInsideViewport(locator: Locator, width: number) {
	const bounds = await box(locator);
	expect(bounds.x).toBeGreaterThanOrEqual(12);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 12 + 0.5);
}

async function expectContainedReceivedActions(page: Page) {
	const giftItems = page.locator('[data-gift-item]');
	await expect(giftItems).not.toHaveCount(0);
	for (const item of await giftItems.all()) {
		const receivedAction = item.getByTestId('gift-received-toggle');
		await expect(receivedAction).toBeVisible();
		const [itemBox, actionBox, labelBox] = await Promise.all([
			box(item),
			box(receivedAction),
			receivedAction.evaluate((action) => {
				const surface = action.querySelector(':scope > .elevation-surface');
				if (!(surface instanceof HTMLElement)) {
					throw new Error('Received action has no direct elevation surface');
				}
				const range = document.createRange();
				range.selectNodeContents(surface);
				const contentRect = range.getBoundingClientRect();
				const surfaceRect = surface.getBoundingClientRect();
				return {
					contentX: contentRect.x,
					contentWidth: contentRect.width,
					surfaceX: surfaceRect.x,
					surfaceWidth: surfaceRect.width,
				};
			}),
		]);
		expect(actionBox.width).toBeGreaterThanOrEqual(32);
		expect(actionBox.height).toBeGreaterThanOrEqual(32);
		expect(actionBox.x).toBeGreaterThanOrEqual(itemBox.x - 0.5);
		expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width + 0.5);
		expect(
			Math.abs(
				labelBox.contentX -
					labelBox.surfaceX -
					(labelBox.surfaceX +
						labelBox.surfaceWidth -
						labelBox.contentX -
						labelBox.contentWidth),
			),
		).toBeLessThanOrEqual(4);
		expect(await receivedAction.evaluate((action) => action.scrollWidth)).toBeLessThanOrEqual(
			await receivedAction.evaluate((action) => action.clientWidth),
		);

		const moreAction = item.getByTestId('gift-more-actions');
		if ((await moreAction.count()) === 0) {
			continue;
		}
		const moreBox = await box(moreAction);
		expect(moreBox.width).toBeGreaterThanOrEqual(32);
		expect(moreBox.height).toBeGreaterThanOrEqual(32);
		const horizontallySeparated =
			actionBox.x + actionBox.width <= moreBox.x + 0.5 ||
			moreBox.x + moreBox.width <= actionBox.x + 0.5;
		expect(horizontallySeparated).toBe(true);
	}
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	const directory = 'test-results/mobile-wishlist-screenshots';
	const path = `${directory}/${name}.png`;
	await mkdir(directory, { recursive: true });
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, { path, contentType: 'image/png' });
}

test.describe('mobile wishlist acceptance', () => {
	test('320/360/390 card geometry keeps the approved gutter, hero, grid and bounds', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-geometry'),
		);
		await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await createManagerWishlist(page);

		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const logo = page.locator('.topbar .logo');
			const logoMark = logo.locator('.logo-icon-wrap');
			await expect(logo).toBeVisible();
			await expect(logo.locator('.logo-text')).toContainText('přejeme si');
			expect(await logoMark.evaluate((mark) => getComputedStyle(mark).width)).toBe('40px');
			for (const action of await page.locator('.topbar button:visible').all()) {
				expect((await box(action)).height).toBeGreaterThanOrEqual(40);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			await expect(page.getByTestId('wishlist-mobile-hero')).toBeVisible();
			await expect(page.getByTestId('wishlist-gift-card-grid')).toBeVisible();
			const routeLayout = await page.getByTestId('wishlist-page-shell').evaluate((shell) => {
				const shellStyle = getComputedStyle(shell);
				const content = shell.closest('main');
				const shellRect = shell.getBoundingClientRect();
				const contentRect = content?.getBoundingClientRect();
				return {
					rowGap: Number.parseFloat(shellStyle.rowGap),
					paddingLeft: Number.parseFloat(shellStyle.paddingLeft),
					paddingRight: Number.parseFloat(shellStyle.paddingRight),
					marginLeft: Number.parseFloat(shellStyle.marginLeft),
					topInset: contentRect === undefined ? null : shellRect.top - contentRect.top,
				};
			});
			expect(routeLayout).toEqual({
				rowGap: 12,
				paddingLeft: 12,
				paddingRight: 12,
				marginLeft: 0,
				topInset: 12,
			});

			const hero = await box(page.getByTestId('wishlist-mobile-hero'));
			const photo = await box(page.getByTestId('wishlist-mobile-photo'));
			expect(hero.height).toBeGreaterThanOrEqual(104);
			expect(hero.height).toBeLessThanOrEqual(120);
			expect(photo.width).toBeGreaterThanOrEqual(84);
			expect(photo.width).toBeLessThanOrEqual(96);
			expect(photo.height).toBeGreaterThanOrEqual(84);
			expect(photo.height).toBeLessThanOrEqual(96);

			await expectInsideViewport(page.getByTestId('wishlist-mobile-hero'), width);
			await expectInsideViewport(page.getByTestId('wishlist-toolbar'), width);
			await expectInsideViewport(page.getByTestId('wishlist-gift-card-grid'), width);
			for (const item of await page.locator('[data-gift-item]').all()) {
				await expectInsideViewport(item, width);
			}
			await expectContainedReceivedActions(page);
			const mobileImageState = await page
				.getByTestId('gift-card-image-frame')
				.first()
				.evaluate((frame) => {
					const imageFrame = frame.querySelector<HTMLElement>(
						'[data-testid="image-frame"]',
					);
					const fallback = imageFrame?.querySelector<HTMLElement>('[role="img"]');
					const pattern = frame.querySelector<HTMLElement>(
						'[data-testid="gift-card-image-pattern"]',
					);
					const title = frame.parentElement?.querySelector('h3');
					const frameRect = frame.getBoundingClientRect();
					const frameStyle = getComputedStyle(frame);
					const borderTop = Number.parseFloat(frameStyle.borderTopWidth) || 0;
					const borderRight = Number.parseFloat(frameStyle.borderRightWidth) || 0;
					const borderBottom = Number.parseFloat(frameStyle.borderBottomWidth) || 0;
					const borderLeft = Number.parseFloat(frameStyle.borderLeftWidth) || 0;
					const contentBox = {
						x: frameRect.x + borderLeft,
						y: frameRect.y + borderTop,
						width: frameRect.width - borderLeft - borderRight,
						height: frameRect.height - borderTop - borderBottom,
					};
					return {
						contentBox,
						frameRect: frameRect.toJSON(),
						borders: { borderTop, borderRight, borderBottom, borderLeft },
						imageFrame: imageFrame?.getBoundingClientRect().toJSON() ?? null,
						fallback: fallback?.getBoundingClientRect().toJSON() ?? null,
						patternDisplay: pattern === null ? null : getComputedStyle(pattern).display,
						titleSize:
							title == null
								? null
								: Number.parseFloat(getComputedStyle(title).fontSize),
					};
				});
			expect(mobileImageState.imageFrame?.width).toBeCloseTo(
				mobileImageState.contentBox.width,
				2,
			);
			expect(mobileImageState.imageFrame?.height).toBeCloseTo(
				mobileImageState.contentBox.height,
				2,
			);
			expect(mobileImageState.imageFrame?.x).toBeCloseTo(mobileImageState.contentBox.x, 2);
			expect(mobileImageState.imageFrame?.y).toBeCloseTo(mobileImageState.contentBox.y, 2);
			expect(mobileImageState.fallback?.width).toBeCloseTo(
				mobileImageState.contentBox.width,
				2,
			);
			expect(mobileImageState.fallback?.height).toBeCloseTo(
				mobileImageState.contentBox.height,
				2,
			);
			expect(mobileImageState.fallback?.x).toBeCloseTo(mobileImageState.contentBox.x, 2);
			expect(mobileImageState.fallback?.y).toBeCloseTo(mobileImageState.contentBox.y, 2);
			expect(mobileImageState.patternDisplay).toBe('none');
			expect(mobileImageState.titleSize).toBeGreaterThanOrEqual(13);
			expect(mobileImageState.titleSize).toBeLessThanOrEqual(15);

			const cards = await page.locator('[data-gift-item]').evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();
					return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
				}),
			);
			const expectedColumns = width === 320 ? 1 : 2;
			expect(new Set(cards.map((card) => Math.round(card.x))).size).toBe(expectedColumns);
			if (expectedColumns === 2) {
				const firstRow = cards.filter((card) => Math.abs(card.y - cards[0]!.y) < 1);
				expect(firstRow).toHaveLength(2);
				expect(firstRow[1]!.x - (firstRow[0]!.x + firstRow[0]!.width)).toBeCloseTo(8, 0);
				expect(firstRow[0]!.height).toBeCloseTo(firstRow[1]!.height, 0);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			await resetAllScroll(page);
			await attachScreenshot(page, testInfo, `manager-card-${width}`);
		}

		await page.context().close();
	});

	test('manager list presentation remains horizontal with full-height square images and contained mobile actions', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-list'),
		);
		await createManagerWishlist(page, 'Mobilní seznamové zobrazení');
		const listChoice = page.getByTestId('gift-view-list');
		await listChoice.click();
		await expect(listChoice).toHaveAttribute('aria-checked', 'true');
		await page.reload({ waitUntil: 'load' });
		await expect(page.getByTestId('gift-view-list')).toHaveAttribute('aria-checked', 'true');

		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const list = page.getByTestId('wishlist-gift-list');
			await expect(list).toBeVisible();
			await expectInsideViewport(list, width);
			const items = await page.getByTestId('gift-list-item').all();
			expect(items).toHaveLength(3);
			const itemBoxes = await Promise.all(items.map(box));
			expect(new Set(itemBoxes.map((item) => Math.round(item.height))).size).toBe(1);
			for (let index = 1; index < itemBoxes.length; index += 1) {
				expect(
					itemBoxes[index]!.y - (itemBoxes[index - 1]!.y + itemBoxes[index - 1]!.height),
				).toBeCloseTo(10, 0);
			}
			for (const item of items) {
				const imageBox = await box(item.getByTestId('gift-list-image'));
				const itemBox = await box(item);
				const border = await item.evaluate((element) =>
					Number.parseFloat(getComputedStyle(element).borderTopWidth),
				);
				expect(imageBox.width).toBeCloseTo(imageBox.height, 0);
				expect(imageBox.y).toBeCloseTo(itemBox.y + border, 0);
				expect(imageBox.y + imageBox.height).toBeCloseTo(
					itemBox.y + itemBox.height - border,
					0,
				);
				const contentBox = await box(item.getByTestId('gift-list-content'));
				expect(contentBox.y).toBeCloseTo(imageBox.y, 0);
				expect(contentBox.x).toBeCloseTo(imageBox.x + imageBox.width, 0);
				expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(
					itemBox.x + itemBox.width - border,
				);
				const reserve = item.getByTestId('reserve-button');
				await expect(
					item.getByTestId('gift-list-image').getByTestId('reserve-button'),
				).toHaveCount(0);
				await expect(
					item.getByTestId('gift-action-row').getByTestId('reserve-button'),
				).toBeVisible();
				const reserveBox = await box(reserve);
				expect(reserveBox.y + reserveBox.height).toBeLessThanOrEqual(
					itemBox.y + itemBox.height - border,
				);
			}
			const titleSizes = await list
				.locator('h3')
				.evaluateAll((titles) =>
					titles.map((title) => Number.parseFloat(getComputedStyle(title).fontSize)),
				);
			expect(titleSizes.every((size) => size >= 13 && size <= 15)).toBe(true);
			const surface = await items[0]!.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					background: style.backgroundColor,
					border: style.borderStyle,
					shadow: style.boxShadow,
				};
			});
			expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
			expect(surface.border).not.toBe('none');
			expect(surface.shadow).not.toBe('none');
			await expectContainedReceivedActions(page);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			await resetAllScroll(page);
			await attachScreenshot(page, testInfo, `manager-list-${width}`);
		}
		await page.context().close();
	});

	test('English Card and List received actions wrap within manager items at every mobile width', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-english-actions'),
		);
		const wishlistPath = await createManagerWishlist(page, 'English mobile actions');
		await page.goto(`/en${wishlistPath}`, { waitUntil: 'load' });
		await expect(page.locator('[data-gift-item]')).toHaveCount(3);
		await page.getByTestId('gift-received-toggle').first().click();
		await expect(
			page.getByRole('button', { name: 'Mark as not received', exact: true }),
		).toBeVisible();
		await waitForGiftAnimationsToSettle(page);

		for (const view of ['card', 'list'] as const) {
			const viewControl = page.getByTestId(`gift-view-${view}`);
			await viewControl.click();
			await expect(viewControl).toHaveAttribute('aria-checked', 'true');
			await expect(
				page.getByTestId(
					view === 'card' ? 'wishlist-gift-card-grid' : 'wishlist-gift-list',
				),
			).toBeVisible();
			for (const width of WIDTHS) {
				await page.setViewportSize({ width, height: MOBILE_HEIGHT });
				await expectContainedReceivedActions(page);
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
				await resetAllScroll(page);
				await attachScreenshot(page, testInfo, `manager-en-${view}-${width}`);
			}
		}
		await page.context().close();
	});

	test('manager toolbar and dedicated sheets preserve geometry, masking, stacking, scroll and focus', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-sheets'),
		);
		await createManagerWishlist(page, 'Mobilní panely nástrojů');
		await page.setViewportSize({ width: 390, height: 500 });
		const toolbar = page.getByTestId('wishlist-toolbar');
		const toolbarMask = page.getByTestId('wishlist-toolbar-mask');
		const rows = toolbar.locator('[data-mobile-toolbar-row]');
		await expect(rows).toHaveCount(1);
		for (const control of await toolbar
			.locator('button:visible, [role="radio"]:visible')
			.all()) {
			const controlBox = await box(control);
			expect(controlBox.height).toBeGreaterThanOrEqual(40);
		}
		expect(await rows.evaluate((row) => row.scrollWidth)).toBeLessThanOrEqual(
			await rows.evaluate((row) => row.clientWidth),
		);

		const scrollContainer = page.locator('main.app-content');
		const wishlistShell = page.getByTestId('wishlist-page-shell');
		await expect(wishlistShell).toHaveAttribute('data-palette', 'sky');
		await page.locator('html').evaluate((element) => {
			element.dataset.palette = 'grape';
		});
		await page.locator('body').evaluate((body) => {
			body.dataset.maskInteractionProbe = 'active';
		});
		await page.locator('[data-gift-item]').evaluateAll((items) => {
			for (const item of items) {
				item.addEventListener(
					'click',
					(event) => {
						if (document.body.dataset.maskInteractionProbe !== 'active') {
							return;
						}
						event.preventDefault();
						event.stopImmediatePropagation();
						document.body.dataset.maskGiftClicked = 'true';
					},
					{ capture: true },
				);
			}
		});

		const maskViewports = [320, 360, 390, 768, 1280] as const;
		for (const mode of ['light', 'dark'] as const) {
			await page.locator('html').evaluate((element, dark) => {
				element.classList.toggle('dark', dark);
			}, mode === 'dark');
			for (const width of maskViewports) {
				await page.setViewportSize({ width, height: 500 });
				await page
					.locator('[data-gift-item]')
					.first()
					.evaluate((element) => {
						element.scrollIntoView({ block: 'start' });
					});
				await page.evaluate(
					() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
				);

				const [
					toolbarBox,
					maskBox,
					scrollContainerBox,
					firstGiftBox,
					toolbarStyle,
					maskStyle,
					pageColors,
					scrollContainerClientWidth,
				] = await Promise.all([
					box(toolbar),
					box(toolbarMask),
					box(scrollContainer),
					box(page.locator('[data-gift-item]').first()),
					toolbar.evaluate((element) => {
						const style = getComputedStyle(element);
						return {
							backgroundColor: style.backgroundColor,
							borderColors: [
								style.borderTopColor,
								style.borderRightColor,
								style.borderBottomColor,
								style.borderLeftColor,
							],
							borderStyles: [
								style.borderTopStyle,
								style.borderRightStyle,
								style.borderBottomStyle,
								style.borderLeftStyle,
							],
							zIndex: style.zIndex,
						};
					}),
					toolbarMask.evaluate((element) => {
						const style = getComputedStyle(element);
						const fadeStyle = getComputedStyle(element, '::after');
						return {
							backgroundColor: style.backgroundColor,
							backdropFilter: style.backdropFilter,
							pointerEvents: style.pointerEvents,
							zIndex: style.zIndex,
							fadeBackgroundColor: fadeStyle.backgroundColor,
							fadeBackdropFilter: fadeStyle.backdropFilter,
							fadeHeight: Number.parseFloat(fadeStyle.height),
							fadeMaskImage: fadeStyle.maskImage,
							fadePointerEvents: fadeStyle.pointerEvents,
						};
					}),
					wishlistShell.evaluate((shell) => {
						function resolveBackground(element: Element, token: string) {
							const probe = document.createElement('div');
							probe.style.backgroundColor = `var(${token})`;
							element.append(probe);
							const color = getComputedStyle(probe).backgroundColor;
							probe.remove();
							return color;
						}

						const root = document.documentElement;
						return {
							rootBackground: getComputedStyle(document.body).backgroundColor,
							rootAppBackground: resolveBackground(
								document.body,
								'--app-page-background',
							),
							wishlistAppBackground: resolveBackground(
								shell,
								'--app-page-background',
							),
							wishlistBackground: resolveBackground(shell, '--background'),
							rootToken: getComputedStyle(root)
								.getPropertyValue('--app-page-background')
								.trim(),
							wishlistToken: getComputedStyle(shell)
								.getPropertyValue('--app-page-background')
								.trim(),
						};
					}),
					scrollContainer.evaluate((element) => element.clientWidth),
				]);

				expect(toolbarBox.y).toBeCloseTo(scrollContainerBox.y + 12, 0);
				expect(toolbarStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
				expect(new Set(toolbarStyle.borderColors).size).toBe(1);
				expect(toolbarStyle.borderColors[0]).not.toBe('rgba(0, 0, 0, 0)');
				expect(toolbarStyle.borderStyles).toEqual(['solid', 'solid', 'solid', 'solid']);
				expect(toolbarStyle.zIndex).toBe('1');
				expect(maskStyle.backgroundColor).toBe(pageColors.rootBackground);
				expect(maskStyle.backgroundColor).toBe(pageColors.rootAppBackground);
				expect(pageColors.wishlistAppBackground).toBe(pageColors.rootAppBackground);
				expect(pageColors.wishlistBackground).not.toBe(pageColors.rootBackground);
				expect(pageColors.wishlistToken).toBe(pageColors.rootToken);
				expect(maskStyle.backdropFilter).toContain('blur');
				expect(maskStyle.pointerEvents).toBe('auto');
				expect(maskStyle.zIndex).toBe('0');
				expect(maskStyle.fadeBackgroundColor).toBe(pageColors.rootBackground);
				expect(maskStyle.fadeBackdropFilter).toContain('blur');
				expect(maskStyle.fadeHeight).toBe(24);
				expect(maskStyle.fadeMaskImage).toContain('linear-gradient');
				expect(maskStyle.fadePointerEvents).toBe('none');
				expect(maskBox.x).toBeCloseTo(scrollContainerBox.x, 0);
				expect(maskBox.width).toBeCloseTo(scrollContainerClientWidth, 0);
				expect(maskBox.y).toBeCloseTo(scrollContainerBox.y, 0);
				expect(maskBox.y + maskBox.height).toBeCloseTo(toolbarBox.y + toolbarBox.height, 0);
				expect(
					await page
						.locator(
							'[data-testid="wishlist-gift-card-grid"], [data-testid="wishlist-gift-list"]',
						)
						.evaluate((collection) => getComputedStyle(collection).isolation),
				).toBe('isolate');

				const maskedPoint = {
					x: toolbarBox.x + toolbarBox.width / 2,
					y: toolbarBox.y - 6,
				};
				const maskedHitTest = await page.evaluate(({ x, y }) => {
					const elements = document.elementsFromPoint(x, y);
					return {
						maskParticipates: elements.some(
							(element) =>
								(element as HTMLElement).dataset.testid === 'wishlist-toolbar-mask',
						),
						topIsGift: Boolean(
							(elements[0] as HTMLElement | undefined)?.closest('[data-gift-item]'),
						),
					};
				}, maskedPoint);
				expect(maskedHitTest.maskParticipates).toBe(true);
				expect(maskedHitTest.topIsGift).toBe(false);
				await page.mouse.click(maskedPoint.x, maskedPoint.y);
				expect(
					await page.locator('body').getAttribute('data-mask-gift-clicked'),
				).toBeNull();

				const usableCardPoint = {
					x: firstGiftBox.x + firstGiftBox.width / 2,
					y: toolbarBox.y + toolbarBox.height + 28,
				};
				expect(
					await page.evaluate(
						({ x, y }) =>
							(document.elementFromPoint(x, y) as HTMLElement | null)?.closest(
								'[data-gift-item]',
							) !== null,
						usableCardPoint,
					),
				).toBe(true);
				await page.mouse.click(usableCardPoint.x, usableCardPoint.y);
				expect(await page.locator('body').getAttribute('data-mask-gift-clicked')).toBe(
					'true',
				);
				await page.locator('body').evaluate((body) => {
					delete body.dataset.maskGiftClicked;
				});
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
				await attachScreenshot(page, testInfo, `toolbar-mask-${mode}-${width}`);
			}
		}
		await page.locator('body').evaluate((body) => {
			delete body.dataset.maskInteractionProbe;
			delete body.dataset.maskGiftClicked;
		});

		await page.setViewportSize({ width: 390, height: 500 });
		await scrollContainer.evaluate((element) => {
			element.scrollTop = 180;
		});
		const trigger = page.getByTestId('mobile-display-trigger');
		const beforeToolbar = await box(toolbar);
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: m.gift_display_options() });
		const options = dialog.getByTestId('mobile-sheet-scroll');
		const switcher = dialog.getByTestId('mobile-sheet-switcher');
		const sectionSwitches = {
			sort: dialog.getByTestId('mobile-sheet-sort-switch'),
			grouping: dialog.getByTestId('mobile-sheet-grouping-switch'),
			filter: dialog.getByTestId('mobile-sheet-filter-switch'),
		};
		await expect(dialog).toBeVisible();
		await dialog.evaluate(async (element) => {
			await Promise.all(
				element
					.getAnimations({ subtree: true })
					.map((animation) => animation.finished.catch(() => undefined)),
			);
		});
		const [sheetZIndex, stickyZIndex] = await Promise.all([
			dialog.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10)),
			toolbar.evaluate((element) =>
				Number.parseInt(getComputedStyle(element.parentElement!).zIndex, 10),
			),
		]);
		expect(sheetZIndex).toBeGreaterThan(stickyZIndex);

		const displayGeometry: Array<{
			width: number;
			section: 'sort' | 'grouping' | 'filter';
			x: number;
			y: number;
			boxWidth: number;
			height: number;
		}> = [];
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: 500 });
			const sectionBounds: Record<string, Awaited<ReturnType<typeof box>>> = {};
			for (const section of ['sort', 'grouping', 'filter'] as const) {
				await sectionSwitches[section].click();
				await expect(sectionSwitches[section]).toHaveAttribute('aria-pressed', 'true');
				await expect(sectionSwitches[section]).toBeFocused();
				expect(
					await dialog.locator('[aria-pressed="true"]').count(),
					'exactly one Display section is selected',
				).toBe(1);
				expect(await page.getByRole('dialog').count(), 'one sheet stays open').toBe(1);
				sectionBounds[section] = await box(switcher);
				displayGeometry.push({
					width,
					section,
					x: sectionBounds[section].x,
					y: sectionBounds[section].y,
					boxWidth: sectionBounds[section].width,
					height: sectionBounds[section].height,
				});
				await attachScreenshot(page, testInfo, `display-${section}-${width}`);
			}

			const reference = sectionBounds.sort!;
			for (const current of Object.values(sectionBounds)) {
				expect(Math.abs(current.x - reference.x)).toBeLessThanOrEqual(1);
				expect(Math.abs(current.y - reference.y)).toBeLessThanOrEqual(1);
				expect(Math.abs(current.width - reference.width)).toBeLessThanOrEqual(1);
				expect(Math.abs(current.height - reference.height)).toBeLessThanOrEqual(1);
			}
			const dialogBox = await box(dialog);
			const safeAreaPadding = await dialog.evaluate((element) =>
				Number.parseFloat(getComputedStyle(element).paddingBottom),
			);
			expect(reference.y + reference.height).toBeLessThanOrEqual(
				dialogBox.y + dialogBox.height - safeAreaPadding + 1,
			);
		}
		const geometryPath =
			'test-results/mobile-wishlist-screenshots/display-switcher-geometry.json';
		await writeFile(geometryPath, `${JSON.stringify(displayGeometry, null, 2)}\n`);
		await testInfo.attach('display-switcher-geometry', {
			path: geometryPath,
			contentType: 'application/json',
		});

		await sectionSwitches.sort.click();
		await expect(options).toHaveCSS('overflow-y', 'auto');
		expect(await options.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
			await options.evaluate((element) => element.clientHeight),
		);
		const fixedBeforeScroll = await box(switcher);
		await options.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		const fixedAfterScroll = await box(switcher);
		expect(Math.abs(fixedAfterScroll.y - fixedBeforeScroll.y)).toBeLessThanOrEqual(1);
		expect((await box(options)).y + (await box(options)).height).toBeLessThanOrEqual(
			fixedAfterScroll.y + 1,
		);
		const finalSortOption = await box(
			dialog.getByRole('radio', { name: m.gift_sort_date_added() }),
		);
		expect(finalSortOption.y + finalSortOption.height).toBeLessThanOrEqual(
			fixedAfterScroll.y + 1,
		);

		await sectionSwitches.filter.click();
		await dialog.getByRole('checkbox', { name: m.gift_filter_show_received() }).click();
		await expect(trigger).toContainText('1');
		await sectionSwitches.grouping.click();
		await sectionSwitches.sort.click();
		await expect(dialog.getByRole('radio', { name: m.gift_sort_owner_order() })).toBeChecked();
		await sectionSwitches.filter.click();
		await expect(
			dialog.getByRole('checkbox', { name: m.gift_filter_show_received() }),
		).toBeChecked();
		await expect(dialog.getByText(m.filter_active_count({ count: 1 }))).toBeVisible();
		await page.keyboard.press('Tab');
		expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
			true,
		);
		const scrollTopBeforeEscape = await scrollContainer.evaluate(
			(element) => element.scrollTop,
		);
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
		expect(await scrollContainer.evaluate((element) => element.scrollTop)).toBe(
			scrollTopBeforeEscape,
		);
		const afterToolbar = await box(toolbar);
		expect(afterToolbar.x).toBeCloseTo(beforeToolbar.x, 0);
		expect(afterToolbar.width).toBeCloseTo(beforeToolbar.width, 0);

		await trigger.click();
		await expect(dialog).toBeVisible();
		const scrollTopBeforeBackdrop = await scrollContainer.evaluate(
			(element) => element.scrollTop,
		);
		await page.mouse.click(4, 20);
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
		expect(await scrollContainer.evaluate((element) => element.scrollTop)).toBe(
			scrollTopBeforeBackdrop,
		);

		await resetAllScroll(page);
		await page.locator('[data-gift-item]').first().getByRole('heading', { level: 3 }).click();
		const giftDialog = page.getByRole('dialog');
		await expect(giftDialog).toBeVisible();
		expect(
			await giftDialog.evaluate((element) =>
				Number.parseInt(getComputedStyle(element).zIndex, 10),
			),
		).toBeGreaterThan(stickyZIndex);
		await page.keyboard.press('Escape');
		await expect(giftDialog).toBeHidden();

		await addGift(page, 'Dárek pro ověření vrstvy oznámení');
		const toast = page.locator('[data-sonner-toast]').last();
		await expect(toast).toBeVisible();
		const toaster = toast.locator('xpath=ancestor::*[@data-sonner-toaster]').first();
		expect(
			await toaster.evaluate((element) =>
				Number.parseInt(getComputedStyle(element).zIndex, 10),
			),
		).toBeGreaterThan(stickyZIndex);
		await dismissToasts(page);
		await page.context().close();
	});

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
		await visitor.goto(wishlistPath, { waitUntil: 'networkidle' });
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

		await visitor.reload({ waitUntil: 'networkidle' });
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
		await visitor.goto(path, { waitUntil: 'networkidle' });
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
		await visitor.goto(path, { waitUntil: 'networkidle' });
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
		const firstRow = await visitor
			.locator('[data-gift-item]')
			.evaluateAll((elements) =>
				elements.slice(0, 2).map((element) => element.getBoundingClientRect().height),
			);
		expect(firstRow[0]).toBeCloseTo(firstRow[1]!, 0);
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
		const privateGift = gift(visitor, 'Dárek s utajenou rezervací');
		await privateGift.getByTestId('reserve-button').click();
		const reservationDialog = visitor.getByRole('dialog');
		await reservationDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reservationDialog).toBeHidden();
		await page.reload({ waitUntil: 'load' });
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const items = page.locator('[data-gift-item]');
			await expect(items).toHaveCount(2);
			await expect(page.getByText(/Rezervov|Volné \d+\//i)).toHaveCount(0);
			await expect(page.getByTestId('reserve-button')).toHaveCount(0);
			await expect(page.getByText(/Koupen|Zakoupen|Purchased/i)).toHaveCount(0);
			await expect(page.getByRole('button', { name: /líbí|like/i })).toHaveCount(0);
			const heights = await items.evaluateAll((elements) =>
				elements.map((element) => Math.round(element.getBoundingClientRect().height)),
			);
			expect(new Set(heights).size).toBe(1);
			await expectContainedReceivedActions(page);
			await attachScreenshot(page, testInfo, `recipient-card-${width}`);
		}
		await page.getByTestId('gift-view-list').click();
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const items = page.locator('[data-gift-item]');
			await expect(page.getByTestId('wishlist-gift-list')).toBeVisible();
			await expect(page.getByText(/Rezervov|Volné \d+\//i)).toHaveCount(0);
			await expect(page.getByTestId('reserve-button')).toHaveCount(0);
			const heights = await items.evaluateAll((elements) =>
				elements.map((element) => Math.round(element.getBoundingClientRect().height)),
			);
			expect(new Set(heights).size).toBe(1);
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
