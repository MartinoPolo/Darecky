import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { addGift } from './fixtures/wishlist-helpers.js';
import {
	WIDTHS,
	createManagerWishlist,
	dismissToasts,
	resetAllScroll,
	box,
	attachScreenshot,
} from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist acceptance', () => {
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
			expect(controlBox.height).toBeCloseTo(32, 0);
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
});
