import { sharedChromeLaunchOptions } from '../../scripts/browser-automation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch(sharedChromeLaunchOptions);
const results = [];
async function scenario(name, callback) {
	const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	try {
		await callback(page);
		assert.deepEqual(errors, []);
		results.push({ name, passed: true });
	} catch (error) {
		results.push({ name, passed: false, error: error.message, browserErrors: errors });
	} finally {
		await page.close();
	}
}
async function open(page, relativePath) {
	await page.goto(new URL(relativePath, import.meta.url).href);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			document
				.getAnimations()
				.filter(
					(animation) => animation.effect?.getComputedTiming().iterations !== Infinity,
				)
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});
}
async function choose(page, group, value) {
	const button = page.locator(`[data-control="${group}"] [data-value="${value}"]`);
	if (await button.count()) {
		await button.click();
	} else {
		await page.locator(`#${group}`).selectOption(value);
	}
}
for (const variant of ['a', 'b']) {
	await scenario(
		`Gift ${variant}: recipient privacy, actions, role/view geometry`,
		async (page) => {
			await open(page, `../gift-geometry-review/variants/variant-${variant}.html`);
			for (const width of [320, 390, 768, 1440]) {
				await page.setViewportSize({ width, height: 900 });
				for (const role of ['recipient', 'visitor', 'gifter', 'manager']) {
					await choose(page, 'role', role);
					for (const view of ['list', 'cards']) {
						await choose(page, 'view', view);
						if (role === 'recipient') {
							assert.equal(
								await page.locator('.like,.reserver').count(),
								0,
								'Recipient hidden data rendered',
							);
							assert.ok(
								await page
									.getByRole('button', { name: /Označit jako přijatý/ })
									.count(),
								'Recipient has no received action',
							);
						}
						const failures = await page.evaluate(() => {
							const failures = [];
							if (document.documentElement.scrollWidth > innerWidth + 1) {
								failures.push('document overflow');
							}
							const cards = document.querySelectorAll('article.gift');
							if (!cards.length) {
								failures.push('no rendered gift specimens');
							}
							for (const card of cards) {
								const bounds = card.getBoundingClientRect();
								for (const button of card.querySelectorAll('button')) {
									const rectangle = button.getBoundingClientRect();
									if (
										rectangle.width &&
										(rectangle.left < bounds.left ||
											rectangle.right > bounds.right + 1 ||
											rectangle.bottom > bounds.bottom + 1)
									) {
										failures.push(`button outside card: ${button.textContent}`);
									}
								}
								const actions = [
									...card.querySelectorAll('.actions > button'),
								].filter((button) => button.getBoundingClientRect().width);
								if (
									actions.length > 1 &&
									Math.max(
										...actions.map(
											(button) => button.getBoundingClientRect().height,
										),
									) -
										Math.min(
											...actions.map(
												(button) => button.getBoundingClientRect().height,
											),
										) >
										1
								) {
									failures.push('unequal action heights');
								}
							}
							return failures;
						});
						assert.deepEqual(failures, [], `${width}/${role}/${view}`);
					}
				}
			}
		},
	);
}
await scenario(
	'Settings: picker draft cancellation, acceptance, failure and exit guard',
	async (page) => {
		await open(page, '../settings-control-review/variants/variant-a.html');
		const trigger = page.locator('[data-color="books"]');
		const saved = await page.locator('#savedLedger').textContent();
		const original = await trigger.getAttribute('style');
		await trigger.click();
		assert.equal(await page.locator('#pickerSave').isDisabled(), true);
		await page.locator('#hexInput').fill('#123456');
		assert.equal(await page.locator('#pickerSave').isEnabled(), true);
		await page.locator('#pickerCancel').click();
		assert.equal(await trigger.getAttribute('style'), original);
		await trigger.click();
		await page.locator('#hexInput').fill('#123456');
		await page.locator('#pickerSave').click();
		assert.notEqual(await trigger.getAttribute('style'), original);
		assert.equal(await page.locator('#savedLedger').textContent(), saved);
		assert.equal(
			await page.evaluate(() => document.activeElement?.getAttribute('data-color')),
			'books',
		);
		await page.locator('[data-tab="appearance"]').click();
		assert.equal(await page.locator('[data-palette-choice]').count(), 10);
		await page.locator('[data-palette-choice="mint"]').click();
		await page.locator('[data-tab="categories"]').click();
		assert.notEqual(await trigger.getAttribute('style'), original);
		if (!(await page.locator('#failToggle').isVisible())) {
			await page.locator('.review summary').click();
		}
		await page.locator('#failToggle').check();
		await page.locator('#globalSave').click();
		await page.locator('#toast:not([hidden])').waitFor();
		assert.equal(await page.locator('#settings').isVisible(), true);
		assert.equal(await page.locator('#savedLedger').textContent(), saved);
		await page.locator('#closeModal').click();
		await page.locator('#guard:not([hidden])').waitFor();
		await page.locator('#continueEdit').click();
		assert.equal(await page.locator('#settings').isVisible(), true);
	},
);
await scenario('Commands: mobile Display privacy and bulk nesting', async (page) => {
	await open(page, '../wishlist-command-review/variants/variant-a.html');
	await page.locator('[data-open="display"]').click();
	await page.locator('[data-sheet]:not([hidden])').waitFor();
	await page.locator('[data-section="filter"]').click();
	assert.ok(await page.locator('[data-sheet] [data-filter="available"]').count());
	await page.keyboard.press('Escape');
	await page.locator('[data-role="recipient"]').click();
	await page.locator('[data-open="display"]').click();
	await page.locator('[data-section="filter"]').click();
	assert.equal(
		await page
			.locator('[data-sheet] [data-filter="available"],[data-sheet] [data-filter="liked"]')
			.count(),
		0,
	);
	await page.keyboard.press('Escape');
	await page.locator('[data-mode="selection"]').click();
	await page.locator('[data-open="bulk"]').click();
	assert.equal(await page.locator('[data-sheet] [data-bulk]').count(), 6);
	await page.locator('[data-sheet] [data-bulk="priority"]').click();
	await page.locator('[data-sheet] .back').click();
	assert.equal(await page.locator('[data-sheet] [data-bulk]').count(), 6);
	await page.keyboard.press('Escape');
	await page.waitForFunction(() => document.activeElement?.getAttribute('data-open') === 'bulk');
});
await browser.close();
await writeFile(
	new URL('./interaction-results.json', import.meta.url),
	`${JSON.stringify(results, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) {
	process.exitCode = 1;
}
