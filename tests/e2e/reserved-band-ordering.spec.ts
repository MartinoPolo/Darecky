import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	openDesktopDisplaySubmenu,
} from './fixtures/wishlist-helpers.js';

/**
 * Role-aware reserved-gift ordering + priority grouping (issue #224).
 *
 * The visitor/gifter view splits gifts into bands: the viewer's own reservations pin to the top
 * under „Vaše rezervace", available gifts follow, and foreign fully-reserved gifts sink to the
 * bottom. The recipient (owner) sees no reservation data, so no bands appear. The priority-grouping
 * toggle only exists once the list has a prioritized gift.
 *
 * Ordering is asserted in LIST view (single column) so a card's vertical position is a faithful
 * proxy for its render order — the card grid is multi-column, where same-row cards share a `y`.
 * The band header copy is matched locale-robustly (SSR base locale can flip; see
 * visitor-no-reserver-names.spec.ts).
 */

const OWN_BAND_HEADER = /Vaše rezervace|Your reservations/;
const OTHER_BAND_HEADER = /Ostatní dárky|Other gifts/;

async function switchToListView(page: Page): Promise<void> {
	const listViewRadio = page.getByRole('radio', { name: /Seznam|List/ });
	await listViewRadio.click();
	await expect(listViewRadio).toBeChecked();
	await expect(
		page.locator('[data-wishlist-gift-collection][data-view-mode=list]'),
	).toBeVisible();
}

/**
 * Reserve one gift by name via its row's reserve button + the confirm dialog, then wait for the
 * reserver's own „Zrušit rezervaci" control to confirm the reservation registered before returning.
 */
async function reserveGiftByName(page: Page, name: string): Promise<void> {
	const item = page.locator('[data-gift-item]', { hasText: name });
	await item.getByTestId('reserve-button').first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: /Rezervovat|Reserve/ }).click();
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await expect(
		item.getByRole('button', { name: /Zrušit rezervaci|Cancel reservation/ }),
	).toBeVisible({ timeout: 10_000 });
}

/** Vertical position of a gift's row heading — a valid order proxy in single-column list view. */
async function giftTop(page: Page, name: string): Promise<number> {
	const box = await page.getByRole('heading', { name, level: 3 }).first().boundingBox();
	if (box === null) {
		throw new Error(`Gift "${name}" not found on page`);
	}
	return box.y;
}

test.describe('Reserved-band ordering (issue #224)', () => {
	test('gifter sees the own-reservation band first and foreign reserved gifts sunk last', async ({
		browser,
		request,
		baseURL,
	}) => {
		// Owner (recipient) creates + shares a list with three gifts.
		const owner = createTestUser('band-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Band Ordering List');
		await addGift(ownerPage, 'Alpha Gift');
		await addGift(ownerPage, 'Bravo Gift');
		await addGift(ownerPage, 'Charlie Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		// A foreign gifter fully reserves Alpha (quantity 1 → fully reserved).
		const foreigner = createTestUser('band-foreigner');
		const foreignerPage = await registerAndGetPage(browser, request, baseURL!, foreigner);
		await foreignerPage.goto(wishlistPath);
		await expect(
			foreignerPage.getByRole('heading', { name: 'Alpha Gift', level: 3 }),
		).toBeVisible();
		await reserveGiftByName(foreignerPage, 'Alpha Gift');
		await foreignerPage.context().close();

		// The gifter under test reserves Bravo — their own reservation.
		const gifter = createTestUser('band-gifter');
		const gifterPage = await registerAndGetPage(browser, request, baseURL!, gifter);
		await gifterPage.goto(wishlistPath);
		await expect(
			gifterPage.getByRole('heading', { name: 'Bravo Gift', level: 3 }),
		).toBeVisible();
		await reserveGiftByName(gifterPage, 'Bravo Gift');

		// Reload for a deterministic, server-derived reservation state: `myReservationId` (which the
		// own-reservation band keys off) is persisted in the DB, whereas the post-reserve
		// single-flight refresh of the client-only gifts query is a race we don't need to test here.
		await gifterPage.reload();
		await expect(
			gifterPage.getByRole('heading', { name: 'Bravo Gift', level: 3 }),
		).toBeVisible();
		await switchToListView(gifterPage);

		// Both band headers appear: „Vaše rezervace" first, then „Ostatní dárky" for the
		// available gifts that follow the own-reservation band (issue #224 follow-up).
		await expect(gifterPage.getByText(OWN_BAND_HEADER)).toBeVisible({ timeout: 10_000 });
		await expect(gifterPage.getByText(OTHER_BAND_HEADER)).toBeVisible({ timeout: 10_000 });
		const headerBox = await gifterPage.getByText(OWN_BAND_HEADER).first().boundingBox();
		const headerY = headerBox?.y ?? Infinity;
		const otherHeaderBox = await gifterPage.getByText(OTHER_BAND_HEADER).first().boundingBox();
		const otherHeaderY = otherHeaderBox?.y ?? Infinity;
		const bravoY = await giftTop(gifterPage, 'Bravo Gift');
		const charlieY = await giftTop(gifterPage, 'Charlie Gift');
		const alphaY = await giftTop(gifterPage, 'Alpha Gift');

		// Own reservation (Bravo) pinned right under the „Vaše rezervace" header; appears once.
		expect(headerY).toBeLessThan(bravoY);
		expect(bravoY).toBeLessThan(charlieY);
		await expect(gifterPage.getByRole('heading', { name: 'Bravo Gift', level: 3 })).toHaveCount(
			1,
		);
		// „Ostatní dárky" header sits below the own reservation and above the available Charlie.
		expect(otherHeaderY).toBeGreaterThan(bravoY);
		expect(otherHeaderY).toBeLessThan(charlieY);
		// Foreign fully-reserved Alpha sinks below the available Charlie.
		expect(alphaY).toBeGreaterThan(charlieY);

		await gifterPage.context().close();
	});

	test('recipient sees no band structure — owner order intact', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('recipient-band-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Recipient No Band List');
		await addGift(ownerPage, 'First Gift');
		await addGift(ownerPage, 'Second Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;

		// A gifter reserves the first gift.
		const gifter = createTestUser('recipient-band-gifter');
		const gifterPage = await registerAndGetPage(browser, request, baseURL!, gifter);
		await gifterPage.goto(wishlistPath);
		await expect(
			gifterPage.getByRole('heading', { name: 'First Gift', level: 3 }),
		).toBeVisible();
		await reserveGiftByName(gifterPage, 'First Gift');
		await gifterPage.context().close();

		// The owner (recipient) returns: no band header, no reservation-driven reordering.
		await ownerPage.goto(wishlistPath);
		await expect(
			ownerPage.getByRole('heading', { name: 'First Gift', level: 3 }),
		).toBeVisible();
		await switchToListView(ownerPage);
		await expect(ownerPage.getByText(OWN_BAND_HEADER)).toHaveCount(0);
		const firstY = await giftTop(ownerPage, 'First Gift');
		const secondY = await giftTop(ownerPage, 'Second Gift');
		// Owner order preserved — First still above Second despite its reservation.
		expect(firstY).toBeLessThan(secondY);

		await ownerPage.context().close();
	});

	test('a visitor with no reservation of their own sees neither band header', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('no-res-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'No Reservation Bands List');
		await addGift(ownerPage, 'Delta Gift');
		await addGift(ownerPage, 'Echo Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		// A fresh visitor who has reserved nothing: no own-reservation band, so no „Ostatní dárky"
		// header either — the list stays a single neutral headerless band.
		const visitor = createTestUser('no-res-visitor');
		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(wishlistPath);
		await expect(
			visitorPage.getByRole('heading', { name: 'Delta Gift', level: 3 }),
		).toBeVisible();
		await switchToListView(visitorPage);

		await expect(
			visitorPage.getByRole('heading', { name: 'Delta Gift', level: 3 }),
		).toBeVisible({
			timeout: 10_000,
		});
		await expect(visitorPage.getByText(OWN_BAND_HEADER)).toHaveCount(0);
		await expect(visitorPage.getByText(OTHER_BAND_HEADER)).toHaveCount(0);

		await visitorPage.context().close();
	});

	test('priority-grouping toggle is absent until the list has a prioritized gift', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('grouping-toggle-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Grouping Toggle List');
		await addGift(ownerPage, 'Unprioritized Gift');

		// Open Display → Filter — the grouping toggle must not be offered yet.
		const filterMenu = await openDesktopDisplaySubmenu(ownerPage, /Filtrovat|Filter/);
		await expect(
			filterMenu.getByRole('menuitemcheckbox', {
				name: /Seskupit podle priority|Group by priority/,
			}),
		).toHaveCount(0);
		await ownerPage.keyboard.press('Escape');

		await ownerPage.context().close();
	});
});
