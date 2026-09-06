import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const results = [];
for (const variant of ['a', 'b']) {
	const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
	await page.goto(
		new URL(`../gift-geometry-review/variants/variant-${variant}.html`, import.meta.url).href,
	);
	await page.locator('[data-control="role"] [data-value="manager"]').click();
	await page.locator('[data-control="locale"] [data-value="en"]').click();
	await page.addStyleTag({
		content:
			'.gift-title{font-size:34px!important}.action{font-size:24px!important;line-height:1.3!important}.quantity,.links,.description,.meta{font-size:24px!important}',
	});
	const geometry = await page.evaluate(() => ({
		overflow: document.documentElement.scrollWidth > innerWidth + 1,
		cards: document.querySelectorAll('article.gift').length,
		clippedButtons: [...document.querySelectorAll('article.gift .actions > button')]
			.filter((button) => button.scrollWidth > button.clientWidth + 1)
			.map((button) => button.textContent.trim()),
		mismatchedRows: [...document.querySelectorAll('article.gift .actions')].filter((row) => {
			const heights = [...row.querySelectorAll('button')].map(
				(button) => button.getBoundingClientRect().height,
			);
			return heights.length > 1 && Math.max(...heights) - Math.min(...heights) > 1;
		}).length,
	}));
	results.push({ variant, ...geometry });
	await page.close();
}
await browser.close();
await writeFile(
	new URL('./text-stress-results.json', import.meta.url),
	`${JSON.stringify(results, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
if (
	results.some(
		(result) =>
			result.overflow ||
			!result.cards ||
			result.clippedButtons.length ||
			result.mismatchedRows,
	)
) {
	process.exitCode = 1;
}
