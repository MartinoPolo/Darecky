import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const scenes = [
	['index', './index.html'],
	['gift-a', '../gift-geometry-review/variants/variant-a.html'],
	['gift-b', '../gift-geometry-review/variants/variant-b.html'],
	['commands', '../wishlist-command-review/variants/variant-a.html'],
	['settings', '../settings-control-review/variants/variant-a.html'],
];
const output = new URL('./screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
	for (const [name, relativePath] of scenes) {
		for (const width of [320, 390, 768, 1440]) {
			const page = await browser.newPage({ viewport: { width, height: 900 } });
			const errors = [];
			page.on('pageerror', (error) => errors.push(error.message));
			page.on('requestfailed', (request) =>
				errors.push(`${request.url()}: ${request.failure()?.errorText}`),
			);
			await page.goto(new URL(relativePath, import.meta.url).href);
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
			const geometry = await page.evaluate(() => ({
				documentWidth: document.documentElement.scrollWidth,
				viewportWidth: innerWidth,
				brokenImages: [...document.images]
					.filter((image) => !image.complete || image.naturalWidth === 0)
					.map((image) => image.src),
				bodyFont: getComputedStyle(document.body).fontFamily,
				headingFont: document.querySelector('h1')
					? getComputedStyle(document.querySelector('h1')).fontFamily
					: null,
				clippedButtons: [...document.querySelectorAll('button')]
					.filter(
						(button) =>
							button.getBoundingClientRect().width > 0 &&
							button.scrollWidth > button.clientWidth + 2,
					)
					.map((button) => button.textContent.trim()),
			}));
			if (width === 390 || width === 1440) {
				await page.screenshot({
					path: fileURLToPath(new URL(`${name}-${width}.png`, output)),
					fullPage: true,
				});
			}
			results.push({ name, width, errors, ...geometry });
			await page.close();
		}
	}
} finally {
	await browser.close();
}
await writeFile(
	new URL('./browser-results.json', import.meta.url),
	`${JSON.stringify(results, null, 2)}\n`,
);
const failures = results.filter(
	(result) =>
		result.errors.length ||
		result.brokenImages.length ||
		result.documentWidth > result.viewportWidth + 1 ||
		result.clippedButtons.length,
);
console.log(JSON.stringify({ scenes: results.length, failures }, null, 2));
if (failures.length) {
	process.exitCode = 1;
}
