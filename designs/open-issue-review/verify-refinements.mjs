import { sharedChromeLaunchOptions } from '../../scripts/browser-automation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch(sharedChromeLaunchOptions);
const results = [];
const output = new URL('./screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
async function scene(name, width, path, callback) {
	const page = await browser.newPage({ viewport: { width, height: 900 } });
	page.setDefaultTimeout(5000);
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('requestfailed', (request) => errors.push(request.url()));
	try {
		await page.goto(new URL(path, import.meta.url).href);
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all(
				document
					.getAnimations()
					.filter(
						(animation) =>
							animation.effect?.getComputedTiming().iterations !== Infinity,
					)
					.map((animation) => animation.finished.catch(() => undefined)),
			);
		});
		await callback(page);
		assert.deepEqual(errors, []);
		assert.ok(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
		);
		results.push({ name, width, passed: true });
	} catch (error) {
		results.push({ name, width, passed: false, error: error.message, browserErrors: errors });
	} finally {
		await page.close();
	}
}
async function capture(page, name) {
	await page.screenshot({
		path: fileURLToPath(new URL(`${name}-${page.viewportSize().width}.png`, output)),
		fullPage: true,
	});
}
async function contained(locator) {
	assert.ok(await locator.count(), 'No geometry specimen');
	assert.ok(
		await locator.evaluate((element) => {
			const r = element.getBoundingClientRect();
			return (
				r.width > 0 &&
				r.left >= 0 &&
				r.right <= innerWidth + 1 &&
				r.top >= 0 &&
				r.bottom <= innerHeight + 1
			);
		}),
		'Control outside viewport',
	);
}
for (const width of [320, 390, 768, 1440]) {
	await scene(
		'Settings refinement',
		width,
		'../settings-control-review/refined.html',
		async (page) => {
			await capture(page, 'settings-refined');
			const trigger = page.locator('[data-color="books"]');
			const baseline = await trigger.getAttribute('style');
			const saved = await page.locator('#savedLedger').textContent();
			await trigger.click();
			assert.ok(await page.locator('#pickerSave').isDisabled());
			await page.locator('#hexInput').fill('#INVALID');
			assert.ok(await page.locator('#pickerSave').isDisabled());
			await page.locator('#hexInput').fill('#123456');
			assert.ok(await page.locator('#pickerSave').isEnabled());
			await contained(page.locator('#picker'));
			await capture(page, 'settings-picker');
			await page.keyboard.press('Escape');
			assert.equal(await trigger.getAttribute('style'), baseline);
			await trigger.click();
			await page.locator('#hexInput').fill('#123456');
			await page.locator('#pickerSave').click();
			assert.notEqual(await trigger.getAttribute('style'), baseline);
			assert.equal(await page.locator('#savedLedger').textContent(), saved);
			assert.equal(
				await trigger.evaluate((element) => element === document.activeElement),
				true,
			);
			await page.locator('[data-tab="appearance"]').click();
			await page.locator('[data-palette-choice="mint"]').click();
			await capture(page, 'settings-palettes');
			if (!(await page.locator('#failToggle').isVisible())) {
				await page.locator('.review summary').click();
			}
			await page.locator('#failToggle').check();
			await contained(page.locator('#globalSave'));
			await page.locator('#globalSave').click();
			await page.locator('#toast:not([hidden])').waitFor();
			assert.equal(await page.locator('#savedLedger').textContent(), saved);
			await page.locator('#closeModal').click();
			await page.locator('#guard:not([hidden])').waitFor();
			await page.locator('#continueEdit').click();
			await page.locator('#failToggle').uncheck();
			await page.locator('#globalSave').click();
			await page.locator('#settings').waitFor({ state: 'hidden' });
			assert.notEqual(await page.locator('#savedLedger').textContent(), saved);
		},
	);
	await scene(
		'Command refinement',
		width,
		'../wishlist-command-review/refined.html',
		async (page) => {
			assert.equal((await page.locator('[data-hero-settings]').textContent()).trim(), '');
			for (const button of await page
				.locator('[data-open="hero-more"],[data-open="toolbar-more"]')
				.all()) {
				assert.equal((await button.textContent()).trim(), '');
				assert.ok(await button.getAttribute('aria-label'));
			}
			await page.locator('[data-open="display"]').click();
			if (width >= 640) {
				const root = page.locator('[data-popup="display"]');
				await root.locator('[data-display-level="sort"]').hover();
				assert.ok(await root.isVisible());
				assert.equal(await root.locator('[data-display-level]').count(), 3);
				await root.locator('[data-display-level="filter"]').hover();
				const child = page.locator('[data-submenu-portal]>.popup');
				await contained(root);
				await contained(child);
				await capture(page, 'commands-cascade');
				await child.locator('[data-filter="link"]').click();
				assert.equal(
					await child.locator('[data-filter="link"]').getAttribute('aria-checked'),
					'true',
				);
				await page.keyboard.press('Escape');
				assert.ok(await root.isVisible());
				await page.waitForFunction(
					() => document.activeElement?.dataset.displayLevel === 'filter',
				);
				await page.keyboard.press('ArrowRight');
				await child.waitFor();
				await page.keyboard.press('ArrowLeft');
				await page.keyboard.press('Escape');
				await page.waitForFunction(
					() => document.activeElement?.dataset.open === 'display',
				);
			} else {
				await page.locator('[data-section="filter"]').click();
				await page.locator('[data-sheet] [data-filter="link"]').check();
				await capture(page, 'commands-mobile-display');
				await page.keyboard.press('Escape');
			}
			await page.locator('[data-mode="selection"]').click();
			await page.locator('.gift-select').first().click();
			assert.equal(await page.locator('[data-selected-count]').textContent(), '2');
			assert.equal(
				await page
					.locator('[data-select-all]')
					.evaluate((element) => element.indeterminate),
				true,
			);
			assert.equal(await page.locator('.gift-select').first().textContent(), '');
			await page.locator('[data-open="bulk"]').click();
			const bulk = page.locator(width >= 640 ? '[data-popup="bulk"]' : '[data-sheet]');
			await bulk.locator('[data-bulk="priority"]').click();
			if (width >= 640) {
				await contained(page.locator('[data-submenu-portal]>.popup'));
				await capture(page, 'commands-bulk');
				await page.keyboard.press('Escape');
				await page.keyboard.press('Escape');
			} else {
				await page.locator('[data-sheet] .back').click();
				assert.equal(await page.locator('[data-sheet] [data-bulk]').count(), 6);
				assert.equal((await bulk.innerText()).match(/Vybráno 2/g)?.length, 1);
				for (const category of [
					'priority',
					'category',
					'imageFit',
					'imageBackground',
					'received',
				]) {
					await bulk.locator(`[data-bulk="${category}"]`).click();
					const summary =
						category === 'imageBackground' ? 'Aktuálně: Bílé' : 'Různé hodnoty';
					assert.equal(await bulk.getByText(summary, { exact: true }).count(), 1);
					assert.equal((await bulk.innerText()).match(/Vybráno 2/g)?.length, 1);
					if (category === 'imageBackground') {
						await capture(page, 'commands-background-clean');
					}
					await bulk.locator('.back').click();
				}
				await capture(page, 'commands-bulk');
				await page.keyboard.press('Escape');
			}
			await page.locator('[data-mode="reorder"]').click();
			for (const view of ['card', 'list']) {
				await page.locator(`[data-view="${view}"]`).click();
				assert.ok(await page.locator('[data-reorder-done]').isVisible());
				assert.ok(
					await page.locator('.toolbar').evaluate((toolbar) => {
						const bounds = toolbar.getBoundingClientRect();
						return [...toolbar.querySelectorAll('button')]
							.filter((button) => button.getBoundingClientRect().width)
							.every((button) => {
								const r = button.getBoundingClientRect();
								return (
									r.left >= bounds.left &&
									r.right <= bounds.right &&
									r.top >= bounds.top &&
									r.bottom <= bounds.bottom
								);
							});
					}),
					'Reorder toolbar control overflow',
				);
				const geometry = await page
					.locator('.reorder-handle')
					.first()
					.evaluate((element) => {
						const r = element.getBoundingClientRect(),
							card = element.closest('.gift').getBoundingClientRect();
						return {
							width: r.width,
							height: r.height,
							left: r.left - card.left,
							top: r.top - card.top,
							visual: parseFloat(getComputedStyle(element, ':before').width),
						};
					});
				assert.ok(
					geometry.width >= (width >= 640 ? 30 : 60) &&
						geometry.height >= (width >= 640 ? 30 : 60),
				);
				assert.ok(
					geometry.left < 10 && geometry.top < 10 && geometry.visual < geometry.width,
				);
				await capture(page, `commands-reorder-${view}`);
			}
			await page.locator('[data-mode="browse"]').click();
			await page.locator('[data-open="hero-more"]').click();
			if (width < 640) {
				assert.ok(await page.locator('[data-sheet] [data-demo="share"]').isVisible());
				assert.equal(await page.locator('[data-sheet] [data-enter-reorder]').count(), 0);
			}
			await page.keyboard.press('Escape');
		},
	);
}
await browser.close();
await writeFile(
	new URL('./refinement-results.json', import.meta.url),
	JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) {
	process.exitCode = 1;
}
