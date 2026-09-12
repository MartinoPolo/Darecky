import { expect, type Locator, type Page } from '@playwright/test';

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

export async function openDialogFromTrigger(trigger: Locator, dialog: Locator): Promise<void> {
	await expect(async () => {
		if (!(await dialog.isVisible())) {
			await trigger.click();
		}
		await expect(dialog).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 20_000 });
}

export async function openCreateWishlistDialog(page: Page): Promise<Locator> {
	const createTrigger = page
		.getByRole('button', { name: /^(Vytvořit seznam|Vytvořit)$/ })
		.first();
	await expect(createTrigger).toBeVisible();
	await expect(createTrigger).toBeEnabled();

	const dialog = page.getByRole('dialog');
	await openDialogFromTrigger(createTrigger, dialog);
	return dialog;
}

/** Create a self-recipient wishlist; leaving the recipient toggle untouched selects „Pro mě". */
export async function createWishlistAndNavigate(page: Page, title: string): Promise<string> {
	await page.goto('/my-lists');
	const dialog = await openCreateWishlistDialog(page);
	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	const addGiftTrigger = page.getByRole('button', { name: /Přidat dárek|Add gift/ }).first();
	await expect(addGiftTrigger).toBeVisible();
	await expect(addGiftTrigger).toBeEnabled();
	return new URL(page.url()).pathname;
}

/** Create a free-text-recipient wishlist whose creator becomes its first správce. */
export async function createWishlistForSomeoneAndNavigate(
	page: Page,
	{ title, recipientName }: { title: string; recipientName: string },
): Promise<string> {
	await page.goto('/my-lists');
	const dialog = await openCreateWishlistDialog(page);
	await dialog.getByText('Pro někoho jiného', { exact: true }).click();

	// The stable id avoids coupling this revealed field to localized copy.
	const recipientInput = dialog.locator('#wishlist-recipient-name');
	await expect(recipientInput).toBeVisible({ timeout: 5_000 });
	await recipientInput.fill(recipientName);

	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	const addGiftTrigger = page.getByRole('button', { name: /Přidat dárek|Add gift/ }).first();
	await expect(addGiftTrigger).toBeVisible();
	await expect(addGiftTrigger).toBeEnabled();
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

async function clickWishlistHeaderAction(page: Page, accessibleName: RegExp): Promise<void> {
	const mobile = (page.viewportSize()?.width ?? 1280) < 640;
	if (mobile) {
		await page.getByTestId('mobile-header-more-trigger').filter({ visible: true }).click();
		const sheet = page
			.getByRole('dialog', { name: /^(Další akce|More actions)$/ })
			.filter({ visible: true });
		await expect(sheet).toBeVisible({ timeout: 5_000 });
		await sheet.getByRole('button', { name: accessibleName }).click();
	} else {
		await page.getByTestId('desktop-header-more-trigger').filter({ visible: true }).click();
		// The popup's accessible name is optional in the rendered dropdown primitive. Scope to
		// the actual visible layer rather than coupling header actions to that implementation detail.
		const menu = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
		await expect(menu).toBeVisible({ timeout: 5_000 });
		await menu.getByRole('menuitem', { name: accessibleName }).click();
	}
}

/** Open the share workflow from the responsive hero action surface. */
export async function openShareWishlistDialog(page: Page): Promise<Locator> {
	await clickWishlistHeaderAction(page, /^(Sdílet|Share)$/);
	const dialog = page.getByRole('dialog').filter({ visible: true });
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

/** Open a cascading desktop submenu from the consolidated Display command. */
export async function openDesktopDisplaySubmenu(
	page: Page,
	accessibleName: RegExp,
): Promise<Locator> {
	await page.getByTestId('desktop-display-trigger').filter({ visible: true }).click();
	const root = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	await expect(root).toBeVisible({ timeout: 5_000 });
	const subTrigger = root.getByRole('menuitem', { name: accessibleName });
	await expect(subTrigger).toBeVisible();
	await subTrigger.focus();
	await page.keyboard.press('ArrowRight');
	const submenu = page.locator('[data-slot="dropdown-menu-sub-content"]:visible').last();
	await expect(submenu).toBeVisible();
	return submenu;
}

/** Choose an action from the responsive wishlist toolbar More surface. */
export async function clickWishlistToolbarMoreAction(
	page: Page,
	accessibleName: RegExp,
): Promise<void> {
	const mobile = (page.viewportSize()?.width ?? 1280) < 640;
	if (mobile) {
		await page.getByTestId('mobile-more-trigger').filter({ visible: true }).click();
		const sheet = page.getByRole('dialog').filter({ visible: true });
		await expect(sheet).toBeVisible({ timeout: 5_000 });
		await sheet.getByRole('button', { name: accessibleName }).click();
	} else {
		await page.getByTestId('desktop-more-trigger').filter({ visible: true }).click();
		const menu = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
		await expect(menu).toBeVisible({ timeout: 5_000 });
		await menu.getByRole('menuitem', { name: accessibleName }).click();
	}
}

/** Enter manual gift-reordering mode through the toolbar More action. */
export async function startGiftReorder(page: Page): Promise<void> {
	await clickWishlistToolbarMoreAction(page, /^(Změnit pořadí|Change order)$/);
}

/** Run the share wizard to completion, making the wishlist active/shared. */
export async function shareWishlist(page: Page): Promise<void> {
	const dialog = await openShareWishlistDialog(page);
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
	await clickWishlistHeaderAction(page, /^(Archivovat|Archive)$/);

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
	await clickWishlistHeaderAction(page, /^(Správci|Managers)$/);
	const panel = page.getByRole('dialog').filter({ visible: true });
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
