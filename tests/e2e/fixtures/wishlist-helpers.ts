import { expect, type Page } from '@playwright/test';

/**
 * Shared wishlist/gift interaction helpers for E2E specs.
 *
 * Selectors target the app's real Czech accessible names (with diacritics) – do not
 * strip diacritics: Playwright's accessible-name matching is diacritic-sensitive, so
 * `'Nazev'` does NOT match the rendered label `'Název'`.
 */

/**
 * Wait for any modal overlay to fully detach. The dialog content hides immediately on
 * close, but the separate overlay element animates out and keeps intercepting pointer
 * events until removed – so the next click can be swallowed unless we wait for it.
 */
export async function waitForDialogOverlayRemoval(page: Page): Promise<void> {
	await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0, { timeout: 5_000 });
}

/**
 * Create a wishlist from /my-lists via the modal and wait until its detail page loads.
 *
 * The create modal now leads with a „Pro mě" / „Pro někoho jiného" segmented control
 * (ToggleGroup) that defaults to „Pro mě" (self). This helper drives the default self
 * path — it never touches the toggle, so the recipient-name input stays hidden and the
 * created list is a for-me (linked-recipient) list. The „Název" textbox and „Vytvořit"
 * submit are addressed by role+name, which the toggle items cannot intercept.
 */
export async function createWishlistAndNavigate(page: Page, title: string): Promise<string> {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Vytvořit seznam' }).first().click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
	return new URL(page.url()).pathname;
}

/**
 * Create a for-someone-else wishlist (free-text recipient) via the modal and wait until
 * its detail page loads. Selects the „Pro někoho jiného" toggle, fills the revealed
 * „Jméno obdarovaného" input (id `#wishlist-recipient-name`), then title + submit.
 *
 * The creator becomes the first správce (moderator role) — so they see reservation state
 * and can reserve — while the free-text recipient is who the list is "for".
 */
export async function createWishlistForSomeoneAndNavigate(
	page: Page,
	{ title, recipientName }: { title: string; recipientName: string },
): Promise<string> {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Vytvořit seznam' }).first().click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });

	// Switch to the „Pro někoho jiného" branch; its label is a toggle inside the dialog.
	await dialog.getByText('Pro někoho jiného', { exact: true }).click();

	// The required recipient-name input appears (stable id survives locale changes).
	const recipientInput = dialog.locator('#wishlist-recipient-name');
	await expect(recipientInput).toBeVisible({ timeout: 5_000 });
	await recipientInput.fill(recipientName);

	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
	return new URL(page.url()).pathname;
}

interface GiftDraftOptions {
	description?: string;
	price?: string;
	primaryLink?: string;
}

/** Add a gift with the supplied details to the currently open wishlist detail page. */
export async function addGift(
	page: Page,
	name: string,
	{ description, price, primaryLink }: GiftDraftOptions = {},
): Promise<void> {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Název' }).fill(name);
	if (description !== undefined) {
		await dialog.locator('#gift-description').fill(description);
	}
	if (price !== undefined) {
		await dialog.locator('#gift-price').fill(price);
	}
	if (primaryLink !== undefined) {
		await dialog.getByRole('button', { name: 'Přidat odkaz' }).click();
		await dialog.getByTestId('gift-link-url').fill(primaryLink);
	}
	await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

	// Wait for the dialog to close so its lingering input value can't pollute later
	// name-based locators, then confirm the gift card (an <h3> heading) rendered.
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible({ timeout: 10_000 });
}

/** Run the share wizard to completion, making the wishlist active/shared. */
export async function shareWishlist(page: Page): Promise<void> {
	const mobile = (page.viewportSize()?.width ?? 1280) < 640;
	if (mobile) {
		await page.getByTestId('mobile-header-more-trigger').filter({ visible: true }).click();
		const sheet = page.getByRole('dialog', { name: 'Další akce' }).filter({ visible: true });
		await expect(sheet).toBeVisible({ timeout: 5_000 });
		await sheet.getByRole('button', { name: 'Sdílet', exact: true }).click();
	} else {
		await page.getByTestId('desktop-header-more-trigger').filter({ visible: true }).click();
		const menu = page.getByRole('menu', { name: 'Další akce' }).filter({ visible: true });
		await expect(menu).toBeVisible({ timeout: 5_000 });
		await menu.getByRole('menuitem', { name: 'Sdílet', exact: true }).click();
	}

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: 'Sdílet seznam' }).click();
	await expectShareMethodsStep(page);
	await dialog.getByRole('button', { name: 'Hotovo' }).click();
	await expect(dialog.getByText('Seznam byl sdílen!')).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: 'Hotovo' }).click();
	// Wait for the dialog (and its overlay) to fully close before returning, otherwise the
	// closing overlay can intercept clicks on header buttons in the following steps.
	await expect(dialog).not.toBeVisible({ timeout: 5_000 });
	await waitForDialogOverlayRemoval(page);
}

/**
 * Archive the currently open wishlist from its header action and confirm the in-app
 * dialog. Archiving asked through the browser's native `confirm()` until it moved to a
 * `Dialog.Root`, so the confirmation is now a real button inside the dialog rather than
 * a `page.on('dialog')` handler.
 */
export async function archiveWishlist(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /Archivovat seznam|Archive list/i })
		.first()
		.click();

	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText(/Archivovat tento seznam\?|Archive this list\?/)).toBeVisible({
		timeout: 5_000,
	});
	// The confirm action is named exactly „Archivovat" – anchored so it cannot match the
	// „Archivovat seznam" trigger behind the overlay.
	await dialog.getByRole('button', { name: /^(Archivovat|Archive)$/ }).click();

	// The dialog closes only once the archive command resolves, so its removal is the
	// signal that the wishlist really is archived.
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
}

/**
 * Open the správci-management panel from the currently open wishlist detail page.
 * The button (aria-label wishlist_moderators_label → „Správci" / „Managers") is
 * visible only to managers (linked recipient OR správce).
 */
export async function openModeratorPanel(page: Page) {
	await page
		.getByRole('button', { name: /Správci|Managers/ })
		.first()
		.click();
	const panel = page.getByRole('dialog');
	await expect(panel).toBeVisible({ timeout: 5_000 });
	return panel;
}

/** Open the správci panel and generate a moderator invite link, returning its full URL. */
export async function generateInviteLink(page: Page): Promise<string> {
	const panel = await openModeratorPanel(page);
	await panel.getByRole('button', { name: /Generovat pozvánku/ }).click();

	// Link element appears in the panel – grab the full URL shown
	const linkBox = panel.getByTestId('invite-link');
	await expect(linkBox).toBeVisible({ timeout: 5_000 });
	const inviteUrl = (await linkBox.textContent()) ?? '';
	return inviteUrl.trim();
}

/** Assert the share-methods step without invoking clipboard or external handlers. */
export async function expectShareMethodsStep(page: Page): Promise<void> {
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('button', { name: 'Kopírovat' })).toBeVisible({ timeout: 5_000 });

	const expectedMethodHrefs: ReadonlyArray<[label: string, href: RegExp]> = [
		['WhatsApp', /^https:\/\/wa\.me\/\?text=/],
		['Email', /^mailto:\?subject=/],
		['Messenger', /^https:\/\/www\.facebook\.com\/dialog\/send\?link=/],
		['Telegram', /^https:\/\/t\.me\/share\/url\?url=/],
		['SMS', /^sms:\?body=/],
	];

	for (const [label, href] of expectedMethodHrefs) {
		await expect(dialog.getByRole('link', { name: label })).toHaveAttribute('href', href);
	}
}
