import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const exported = JSON.parse(
	await readFile(new URL('./export-location.json', import.meta.url), 'utf8'),
);
const index = pathToFileURL(exported.index);
const browser = await chromium.launch();
const results = [];
try {
	for (const relative of [
		'./index.html',
		'../settings-control-review/refined.html',
		'../wishlist-command-review/refined.html',
		'../gift-geometry-review/variants/variant-a.html',
		'../gift-geometry-review/variants/variant-b.html',
		'../gift-geometry-review/variants/variant-c.html',
		'../gift-geometry-review/refined.html',
	]) {
		const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('requestfailed', (request) => errors.push(request.url()));
		await page.goto(new URL(relative, index).href);
		await page.evaluate(() => document.fonts.ready);
		assert.deepEqual(errors, [], relative);
		assert.equal(
			await page.evaluate(
				() =>
					[...document.images].filter((image) => !image.complete || !image.naturalWidth)
						.length,
			),
			0,
			relative,
		);
		if (relative === './index.html') {
			const links = await page
				.locator('a')
				.evaluateAll((elements) =>
					elements
						.map((element) => element.href)
						.filter((url) => url.startsWith('file:')),
				);
			for (const link of links) {
				await access(new URL(link));
			}
		}
		results.push({ page: relative, passed: true });
		await page.close();
	}
} finally {
	await browser.close();
}
await writeFile(
	new URL('./export-results.json', import.meta.url),
	JSON.stringify(results, null, 2) + '\n',
);
await writeFile(
	path.join(exported.destination, 'open-issue-review', 'export-results.json'),
	JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results, null, 2));
