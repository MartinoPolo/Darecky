import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { loginViaApi, parseCookiesForContext } from './fixtures/auth-helpers.js';

const VIEWPORT_PADDING = 8;

async function openSeedWishlist(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
) {
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
	await expect(page.locator('[data-gift-item]').first()).toBeVisible();
}

async function pinTrigger(trigger: Locator, top: number, left: number) {
	await trigger.evaluate(
		(element, position) => {
			element.style.position = 'fixed';
			element.style.top = `${position.top}px`;
			element.style.left = `${position.left}px`;
			element.style.width = 'max-content';
			element.style.zIndex = '999';
		},
		{ top, left },
	);
}

async function unpinTrigger(trigger: Locator) {
	await trigger.evaluate((element) => {
		for (const property of ['position', 'top', 'left', 'width', 'z-index']) {
			element.style.removeProperty(property);
		}
	});
}

async function expectDropdownViewportCap(menu: Locator, height: number) {
	await expect
		.poll(() => menu.evaluate((element) => getComputedStyle(element).maxHeight))
		.toBe(`${height - VIEWPORT_PADDING * 2}px`);
}

async function expectInsideViewport(menu: Locator, width: number, height: number) {
	const rect = await menu.boundingBox();
	expect(rect).not.toBeNull();
	expect(rect!.x).toBeGreaterThanOrEqual(VIEWPORT_PADDING - 1);
	expect(rect!.y).toBeGreaterThanOrEqual(VIEWPORT_PADDING - 1);
	expect(rect!.x + rect!.width).toBeLessThanOrEqual(width - VIEWPORT_PADDING + 1);
	expect(rect!.y + rect!.height).toBeLessThanOrEqual(height - VIEWPORT_PADDING + 1);
}

async function openDesktopDisplayRoot(page: Page) {
	const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
	await expect(trigger).toBeVisible();
	await trigger.click();
	const root = page.getByRole('menu', { name: 'Možnosti zobrazení' });
	await expect(root).toBeVisible();
	return { trigger, root };
}

async function openDisplaySubmenu(
	page: Page,
	name: RegExp,
	position?: { top: number; left: number },
) {
	const { trigger, root } = await openDesktopDisplayRoot(page);
	const subTrigger = root.getByRole('menuitem', { name });
	await expect(subTrigger).toBeVisible();
	if (position) {
		await pinTrigger(subTrigger, position.top, position.left);
	}
	await subTrigger.focus();
	await page.keyboard.press('ArrowRight');
	const submenu = page.locator('[data-slot="dropdown-menu-sub-content"]:visible');
	await expect(submenu).toBeVisible();
	return { trigger, root, subTrigger, submenu };
}

async function closeDropdownHierarchy(page: Page) {
	const visibleLayers = page.locator(
		'[data-slot="dropdown-menu-sub-content"]:visible, [data-slot="dropdown-menu-content"]:visible',
	);
	for (let layer = 0; layer < 2 && (await visibleLayers.count()) > 0; layer += 1) {
		await page.keyboard.press('Escape');
	}
	await expect(visibleLayers).toHaveCount(0);
}

async function visibleDropdown(page: Page) {
	const menu = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	await expect(menu).toBeVisible();
	return menu;
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	await testInfo.attach(name, {
		body: await page.screenshot(),
		contentType: 'image/png',
	});
}

test.describe('issue #364 dropdown viewport placement', () => {
	test('stationary constrained filter stays stable and full-height when the viewport can contain it', async ({
		page,
		request,
		baseURL,
	}, testInfo) => {
		await page.setViewportSize({ width: 1000, height: 600 });
		await openSeedWishlist(page, request, baseURL!);
		const displayTrigger = page
			.getByTestId('desktop-display-trigger')
			.filter({ visible: true });
		await pinTrigger(displayTrigger, 280, 300);
		const { submenu: menu } = await openDisplaySubmenu(page, /Filtrovat/, {
			top: 280,
			left: 300,
		});
		await expectDropdownViewportCap(menu, 600);
		await page.mouse.move(10, 580);

		const evidence = await menu.evaluate(async (element) => {
			const samples: Array<{ y: number; side: string | null }> = [];
			for (let frame = 0; frame < 90; frame += 1) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				samples.push({
					y: element.getBoundingClientRect().y,
					side: element.getAttribute('data-side'),
				});
			}
			return {
				samples,
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
			};
		});

		await expectInsideViewport(menu, 1000, 600);
		expect(evidence.clientHeight).toBe(evidence.scrollHeight);
		expect(new Set(evidence.samples.map((sample) => sample.side)).size).toBe(1);
		expect(
			Math.max(...evidence.samples.map((sample) => sample.y)) -
				Math.min(...evidence.samples.map((sample) => sample.y)),
		).toBeLessThan(1);
		await attachScreenshot(page, testInfo, 'stationary-constrained-filter.png');
	});

	test('filter remains contained through inner scroll, edge anchoring, and resize', async ({
		page,
		request,
		baseURL,
	}, testInfo) => {
		await page.setViewportSize({ width: 1000, height: 700 });
		await openSeedWishlist(page, request, baseURL!);
		const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
		await unpinTrigger(trigger);
		await trigger.scrollIntoViewIfNeeded();
		let { submenu: menu } = await openDisplaySubmenu(page, /Filtrovat/);
		await expectDropdownViewportCap(menu, 700);

		const appScroller = page.locator('main.app-content');
		const initialScrollTop = await appScroller.evaluate((element) => element.scrollTop);
		await appScroller.evaluate((element) => element.scrollBy({ top: 120 }));
		await expect
			.poll(() => appScroller.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(initialScrollTop);
		await expectInsideViewport(menu, 1000, 700);
		const scrollSamples = await menu.evaluate(async (element) => {
			const samples: number[] = [];
			for (let frame = 0; frame < 30; frame += 1) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				samples.push(element.getBoundingClientRect().y);
			}
			return samples;
		});
		expect(Math.max(...scrollSamples) - Math.min(...scrollSamples)).toBeLessThan(1);

		await closeDropdownHierarchy(page);
		await pinTrigger(trigger, 12, 12);
		({ submenu: menu } = await openDisplaySubmenu(page, /Filtrovat/, {
			top: 12,
			left: 12,
		}));
		await expectDropdownViewportCap(menu, 700);
		await expectInsideViewport(menu, 1000, 700);
		expect(await menu.getAttribute('data-side')).toBe('right');

		await closeDropdownHierarchy(page);
		await pinTrigger(trigger, 640, 720);
		let filterSubTrigger: Locator;
		({ subTrigger: filterSubTrigger, submenu: menu } = await openDisplaySubmenu(
			page,
			/Filtrovat/,
			{ top: 640, left: 720 },
		));
		await expectDropdownViewportCap(menu, 700);
		await expectInsideViewport(menu, 1000, 700);

		await pinTrigger(trigger, 460, 500);
		await pinTrigger(filterSubTrigger, 460, 500);
		await page.setViewportSize({ width: 760, height: 520 });
		await expectDropdownViewportCap(menu, 520);
		await expectInsideViewport(menu, 760, 520);
		await attachScreenshot(page, testInfo, 'edge-resize-filter.png');
	});

	test('genuinely oversized filter scrolls internally and keeps keyboard endpoints reachable', async ({
		page,
		request,
		baseURL,
	}, testInfo) => {
		await page.setViewportSize({ width: 800, height: 420 });
		await openSeedWishlist(page, request, baseURL!);
		await page.addStyleTag({
			content: '[data-filter-option] { min-height: 7rem; }',
		});
		const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
		await pinTrigger(trigger, 190, 400);
		const {
			root,
			subTrigger,
			submenu: menu,
		} = await openDisplaySubmenu(page, /Filtrovat/, { top: 190, left: 400 });
		await expectDropdownViewportCap(menu, 420);
		const endpoints = menu.locator('[data-filter-option]');
		const first = endpoints.first();
		const last = endpoints.last();
		const geometry = await menu.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
		}));

		await expectInsideViewport(menu, 800, 420);
		expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
		await page.keyboard.press('Home');
		await expect(first).toBeFocused();
		await page.keyboard.press('End');
		await expect(last).toBeFocused();
		await expect(last).toBeInViewport();
		await attachScreenshot(page, testInfo, 'oversized-filter-last-option.png');
		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		await expect(subTrigger).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(root).toBeHidden();
		await expect(trigger).toBeFocused();
	});

	test('submenu corners and nested Sort keyboard selection retain viewport geometry and dismissal', async ({
		page,
		request,
		baseURL,
	}, testInfo) => {
		await page.setViewportSize({ width: 1000, height: 600 });
		await openSeedWishlist(page, request, baseURL!);

		const displayTrigger = page
			.getByTestId('desktop-display-trigger')
			.filter({ visible: true });
		await pinTrigger(displayTrigger, 548, 720);
		const {
			root: displayRoot,
			subTrigger: sortSubTrigger,
			submenu: sortMenu,
		} = await openDisplaySubmenu(page, /Řadit podle/, { top: 548, left: 720 });
		await expectDropdownViewportCap(sortMenu, 600);
		await expectInsideViewport(sortMenu, 1000, 600);
		const selectedSort = sortMenu.locator('[role="menuitemradio"][aria-checked="true"]');
		const initialSort = await selectedSort.innerText();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
		await expect(sortMenu).toBeVisible();
		await expect.poll(() => selectedSort.innerText()).not.toBe(initialSort);
		await page.keyboard.press('Escape');
		await expect(sortMenu).toBeHidden();
		await expect(sortSubTrigger).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(displayRoot).toBeHidden();
		await expect(displayTrigger).toBeFocused();

		const giftHeading = page.locator('[data-gift-item] h3').first();
		await giftHeading.click({ button: 'right' });
		await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
		const actionsTrigger = page.getByRole('button', { name: 'Akce', exact: true });
		await expect(actionsTrigger).toBeVisible();
		await pinTrigger(actionsTrigger, 540, 820);
		await actionsTrigger.click();
		const mainMenu = await visibleDropdown(page);
		await expectDropdownViewportCap(mainMenu, 600);
		const subTrigger = mainMenu.getByRole('menuitem', { name: /Priorita/ });
		await subTrigger.hover();
		const submenu = page.locator('[data-slot="dropdown-menu-sub-content"]:visible');
		await expect(submenu).toBeVisible();
		await expectDropdownViewportCap(submenu, 600);
		await expectInsideViewport(mainMenu, 1000, 600);
		await expectInsideViewport(submenu, 1000, 600);
		await attachScreenshot(page, testInfo, 'submenu-bottom-right.png');
		await page.keyboard.press('Escape');
		await expect(submenu).toBeHidden();
		if (await mainMenu.isVisible()) {
			await page.keyboard.press('Escape');
		}
		await expect(mainMenu).toBeHidden();

		await pinTrigger(actionsTrigger, 12, 12);
		await actionsTrigger.click();
		const topLeftMenu = await visibleDropdown(page);
		await expectDropdownViewportCap(topLeftMenu, 600);
		await topLeftMenu.getByRole('menuitem', { name: /Priorita/ }).hover();
		const topLeftSubmenu = page.locator('[data-slot="dropdown-menu-sub-content"]:visible');
		await expect(topLeftSubmenu).toBeVisible();
		await expectDropdownViewportCap(topLeftSubmenu, 600);
		await expectInsideViewport(topLeftMenu, 1000, 600);
		await expectInsideViewport(topLeftSubmenu, 1000, 600);
		await attachScreenshot(page, testInfo, 'submenu-top-left.png');
	});
});
