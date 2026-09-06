import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
const results = [];
async function geometry(page, context) {
	const errors = await page.locator('.gift:not(.skeleton)').evaluateAll((cards, context) => {
		const errors = [];
		if (!cards.length) {
			return ['No gift specimens rendered'];
		}
		for (const card of cards) {
			const bounds = card.getBoundingClientRect();
			const image = card.querySelector('.photo').getBoundingClientRect();
			const style = getComputedStyle(card);
			if (context.view === 'grid') {
				if (Math.abs(image.width / image.height - 4 / 3) > 0.02) {
					errors.push('Grid image ratio');
				}
			} else if (!context.large) {
				if (Math.abs(image.width - image.height) > 0.5) {
					errors.push('List image not square');
				}
				if (
					Math.abs(
						image.height -
							(bounds.height -
								parseFloat(style.borderTopWidth) -
								parseFloat(style.borderBottomWidth)),
					) > 0.5
				) {
					errors.push('Image not full row height');
				}
			}
			if (card.scrollHeight > card.clientHeight + 1) {
				errors.push('Card content overflow');
			}
			if (
				context.large &&
				parseFloat(getComputedStyle(card.querySelector('.quantity')).fontSize) < 24
			) {
				errors.push('Quantity not enlarged');
			}
			const actions = [...card.querySelectorAll('.actions button')];
			if (
				actions.length === 2 &&
				Math.abs(
					actions[0].getBoundingClientRect().height -
						actions[1].getBoundingClientRect().height,
				) > 0.5
			) {
				errors.push('Unequal action heights');
			}
			for (const button of card.querySelectorAll('.action')) {
				const rectangle = button.getBoundingClientRect();
				const buttonStyle = getComputedStyle(button);
				const shadow = buttonStyle.boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
				const offsetX = shadow ? Math.max(0, Number(shadow[1])) : 0;
				const offsetY = shadow ? Math.max(0, Number(shadow[2])) : 0;
				if (rectangle.height < 40 || rectangle.width < 40) {
					errors.push('Action below target size');
				}
				if (
					rectangle.right + offsetX > bounds.right - 1 ||
					rectangle.bottom + offsetY > bounds.bottom - 1 ||
					rectangle.left < bounds.left ||
					rectangle.top < bounds.top
				) {
					errors.push('Action/shadow outside card');
				}
				if (
					button.scrollWidth > button.clientWidth + 1 ||
					button.scrollHeight > button.clientHeight + 1
				) {
					errors.push('Clipped action label');
				}
				if (buttonStyle.boxShadow === 'none') {
					errors.push('Missing canonical action shadow');
				}
			}
			if (
				context.role === 'recipient' &&
				card.querySelector(
					'.like,[data-state="reserved"],.manager-identity,[data-action="reserve"],[data-action="cancel"]',
				)
			) {
				errors.push('Recipient spoiler in DOM');
			}
			if (context.role === 'visitor' && card.querySelector('.manager-identity')) {
				errors.push('Visitor identity disclosure');
			}
			const like = card.querySelector('.like');
			if (like) {
				const b = like.getBoundingClientRect();
				if (
					b.top < image.top ||
					b.bottom > image.bottom ||
					b.left < image.left ||
					b.right > image.right
				) {
					errors.push('Like not over image');
				}
			}
			const grip = card.querySelector('.reorder-handle');
			if (grip) {
				const b = grip.getBoundingClientRect();
				if (b.left - bounds.left > 10 || b.top - bounds.top > 10) {
					errors.push('Grip not top-left');
				}
				if (b.width < (innerWidth < 640 ? 60 : 30)) {
					errors.push('Grip too small');
				}
			}
		}
		if (document.documentElement.scrollWidth > innerWidth + 1) {
			errors.push('Page horizontal overflow');
		}
		return errors;
	}, context);
	assert.deepEqual(errors, [], JSON.stringify(context));
}
try {
	for (const width of [320, 390, 768, 1440]) {
		const page = await browser.newPage({ viewport: { width, height: 1000 } });
		page.setDefaultTimeout(5000);
		const browserErrors = [];
		page.on('pageerror', (e) => browserErrors.push(e.message));
		page.on('requestfailed', (r) => browserErrors.push(r.url()));
		try {
			await page.goto(new URL('../gift-geometry-review/refined.html', import.meta.url).href);
			await page.evaluate(() => document.fonts.ready);
			for (const view of ['list', 'grid', 'reorder']) {
				await page.locator(`[data-view="${view}"]`).click();
				await geometry(page, { width, view, role: 'mixed', large: false });
				await page.screenshot({
					path: fileURLToPath(
						new URL(`./screenshots/gift-focused-${view}-${width}.png`, import.meta.url),
					),
					fullPage: true,
				});
			}
			await page.locator('[data-reorder-layout="grid"]').click();
			await geometry(page, { width, view: 'grid', role: 'mixed', large: false });
			await page.screenshot({
				path: fileURLToPath(
					new URL(
						`./screenshots/gift-focused-reorder-grid-${width}.png`,
						import.meta.url,
					),
				),
				fullPage: true,
			});
			await page.locator('[data-reorder-layout="list"]').click();
			await page.locator('.test-tools summary').click();
			for (const view of ['list', 'grid', 'reorder']) {
				for (const role of ['visitor', 'gifter', 'recipient', 'manager']) {
					for (const english of [false, true]) {
						for (const content of ['normal', 'varied']) {
							await page.locator(`[data-view="${view}"]`).click();
							await page.locator('#role').selectOption(role);
							await page.locator('#english').setChecked(english);
							await page.locator('#content').selectOption(content);
							await geometry(page, {
								width,
								view,
								role,
								english,
								content,
								large: false,
							});
						}
					}
				}
			}
			await page.locator('[data-view="list"]').click();
			await page.locator('#role').selectOption('manager');
			await page.locator('#english').check();
			await page.locator('#large-text').check();
			await geometry(page, { width, view: 'list', role: 'manager', large: true });
			await page.screenshot({
				path: fileURLToPath(
					new URL(`./screenshots/gift-focused-large-${width}.png`, import.meta.url),
				),
				fullPage: true,
			});
			await page.locator('#large-text').uncheck();
			await page.locator('#english').uncheck();
			await page.locator('#role').selectOption('mixed');
			await page.locator('#content').selectOption('normal');
			await page.locator('#fail').check();
			await page.locator('[data-gift-card="reserve"] [data-action="reserve"]').click();
			await page.waitForFunction(() =>
				document.querySelector('#announcement').textContent.includes('nezdařila'),
			);
			assert.equal(
				await page.locator('[data-gift-card="reserve"] [data-action="reserve"]').count(),
				1,
			);
			await page.locator('[data-gift-card="reserve"] [data-action="reserve"]').click();
			await page.locator('[data-gift-card="reserve"] [data-action="cancel"]').waitFor();
			await page.locator('[data-gift-card="cancel"] [data-action="cancel"]').click();
			await page.locator('[data-gift-card="cancel"] [data-action="reserve"]').waitFor();
			await page.locator('[data-gift-card="received"] [data-action="receive"]').click();
			await page.locator('[data-gift-card="received"] [data-action="undo"]').waitFor();
			await page.locator('#archived').check();
			assert.equal(
				await page
					.locator('[data-action="reserve"],[data-action="receive"],[data-action="undo"]')
					.count(),
				0,
			);
			assert.equal(await page.locator('[data-action="cancel"]').count(), 1);
			await page.locator('#archived').uncheck();
			await page.locator('[data-gift-card="reserve"] .detail-link').click();
			assert.ok(await page.locator('#gift-dialog').isVisible());
			assert.ok((await page.locator('#dialog-title').textContent()).length > 20);
			await page.keyboard.press('Escape');
			await page.locator('[data-view="reorder"]').click();
			const first = await page.locator('[data-grip]').first().getAttribute('data-grip');
			await page.locator('[data-grip]').first().focus();
			await page.keyboard.press('ArrowDown');
			assert.notEqual(
				await page.locator('[data-grip]').first().getAttribute('data-grip'),
				first,
			);
			assert.equal(
				await page
					.locator('[data-grip]')
					.last()
					.evaluate((x) => x === document.activeElement),
				true,
			);
			for (const content of ['empty', 'loading']) {
				await page.locator('#content').selectOption(content);
				assert.ok(await page.locator(content === 'empty' ? '.empty' : '.skeleton').count());
			}
			assert.deepEqual(browserErrors, []);
			results.push({ width, passed: true });
		} catch (error) {
			results.push({ width, passed: false, error: error.message });
		} finally {
			await page.close();
		}
	}
} finally {
	await browser.close();
}
await writeFile(
	new URL('./focused-gift-results.json', import.meta.url),
	JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) {
	process.exitCode = 1;
}
