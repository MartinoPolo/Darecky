import { expect, test } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

test('authenticated 320px navbar keeps every action visible with touch-sized targets', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-mobile-bounds');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto('/my-lists');
	await page.waitForSelector('h1');

	const header = page.locator('header.topbar');
	await expect(header.getByRole('button', { name: /^(Otevření menu|Open menu)$/ })).toBeVisible();
	await expect(
		header.getByRole('link', {
			name: /^(Přejeme si – domovská stránka|Přejeme si – home)$/,
		}),
	).toBeVisible();
	await expect(header.getByRole('button', { name: /^(Vytvořit|Create)$/ })).toBeVisible();
	await expect(
		header.getByRole('button', { name: /^(Upozornění \(|Notifications \()/ }),
	).toBeVisible();
	await expect(
		header.getByRole('button', { name: /(– menu uživatele|– user menu)$/ }),
	).toBeVisible();

	const controls = header.locator('button:visible, a:visible');
	const boxes = await controls.evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
		}),
	);

	for (const box of boxes) {
		expect(
			box.left,
			'navbar control stays inside the left viewport edge',
		).toBeGreaterThanOrEqual(0);
		expect(
			box.right,
			'navbar control stays inside the right viewport edge',
		).toBeLessThanOrEqual(320);
		expect(box.width, 'navbar control has a 40px minimum target width').toBeGreaterThanOrEqual(
			40,
		);
		expect(
			box.height,
			'navbar control has a 40px minimum target height',
		).toBeGreaterThanOrEqual(40);
	}

	const documentWidth = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(
		documentWidth.scrollWidth,
		'document has no horizontal overflow at 320px',
	).toBeLessThanOrEqual(documentWidth.clientWidth);

	await page.context().close();
});
