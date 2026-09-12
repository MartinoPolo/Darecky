import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	gift,
	createActionFixture,
	openSelectionFromContext,
	selectionCount,
	openMobileGiftActions,
	beginTouchLongPress,
	expectBodyPointerEventsRestored,
} from './wishlist-gift-actions.helpers.js';

test('mobile More uses a Sheet in card and list views and returns focus on Escape', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-more'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	for (const view of ['card', 'list'] as const) {
		if (view === 'list') {
			await page.evaluate(() => {
				window.localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify('list'));
			});
			await page.reload();
			await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
		}
		const more = gift(page, 'Kolo pro výlety').getByTestId('gift-more-actions');
		await expect(more).toHaveAttribute('aria-haspopup', 'dialog');
		await more.click();
		await expect(more).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('dialog', { name: 'Kolo pro výlety' })).toBeVisible();
		await expect(page.getByRole('menu')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(more).toHaveAttribute('aria-expanded', 'false');
		await expect(more).toBeFocused();
		await expectBodyPointerEventsRestored(page);
	}
	await page.context().close();
});

test('selection survives responsive reflow while normal controls remain replaced', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-selection-persistence'),
	);
	await createActionFixture(page);
	const toolbar = await openSelectionFromContext(page, 'Stan pro dva');
	await gift(page, 'Kolo pro výlety').click();
	await selectionCount(toolbar, 2);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('radio', { name: /Seznam/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Seskupení:/ })).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	await selectionCount(toolbar, 2);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await expect(
		toolbar.getByRole('checkbox', { name: 'Vybrat všechny viditelné dárky' }),
	).toBeChecked();
	await page.context().close();
});

test('mobile toolbar starts an empty selection from deterministic SSR markup', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-toolbar-selection'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const serverResponse = await page.context().request.get(page.url());
	expect(serverResponse.ok()).toBe(true);
	const serverRenderedHtml = await serverResponse.text();
	const serverRenderedSwitcherCount = await page.evaluate((html) => {
		const document = new DOMParser().parseFromString(html, 'text/html');
		return document.querySelectorAll('[data-testid="gift-view-switcher"]').length;
	}, serverRenderedHtml);
	expect(serverRenderedSwitcherCount).toBe(1);

	await page.getByTestId('mobile-more-trigger').click();
	await page
		.getByRole('dialog', { name: m.wishlist_more_actions() })
		.getByRole('button', { name: m.gift_selection_toolbar(), exact: true })
		.click();
	const toolbar = page.getByRole('region', {
		name: m.gift_selection_toolbar(),
		exact: true,
	});
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 0);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'false');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'false');
	await expect(page.getByTestId('gift-view-switcher')).toHaveCount(0);
	await page.context().close();
});

test('mobile long press opens Sheet drill-in and selection toolbar Actions row', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-actions-mobile');
	const authenticated = await registerAndGetPage(browser, request, baseURL!, user);
	await authenticated.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(authenticated);

	const target = gift(authenticated, 'Kolo pro výlety');
	await openMobileGiftActions(authenticated, target, 'Kolo pro výlety');
	await authenticated.getByRole('button', { name: 'Priorita' }).click();
	await expect(authenticated.getByRole('button', { name: 'Zpět' })).toBeVisible();
	await authenticated.getByRole('button', { name: 'Zpět' }).click();
	await authenticated.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = authenticated.getByRole('region', { name: 'Nástroje výběru' });
	const actions = toolbar.getByRole('button', { name: /Akce/ });
	await expect(actions).toBeVisible();
	await expect(toolbar.getByRole('button', { name: m.cancel() })).toBeVisible();

	await actions.click();
	const bulkSheet = authenticated.getByRole('dialog', {
		name: m.gift_selection_actions(),
	});
	await expect(bulkSheet).toBeVisible();
	await authenticated.keyboard.press('Escape');
	await expect(bulkSheet).toBeHidden();
	await selectionCount(toolbar, 1);
	await expect(target).toHaveAttribute('aria-selected', 'true');

	await authenticated.keyboard.press('Escape');
	await expect(toolbar).toBeHidden();
	await authenticated.context().close();
});

test('mobile movement beyond the tolerance cancels a pending long press', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-movement-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const point = await beginTouchLongPress(target);
	await expect(target).toHaveAttribute('data-long-press-pending', 'true');
	await target.dispatchEvent('pointermove', {
		pointerType: 'touch',
		clientX: point.x + 9,
		clientY: point.y,
	});
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile scroll cancels a pending long press', async ({ browser, request, baseURL }) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-scroll-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	await beginTouchLongPress(target);
	await expect(target).toHaveAttribute('data-long-press-pending', 'true');
	await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile long press beginning on a card control does not open the actions Sheet', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-control-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const receivedControl = target.getByTestId('gift-received-toggle');
	await expect(receivedControl).toBeVisible();
	await beginTouchLongPress(receivedControl);
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});
