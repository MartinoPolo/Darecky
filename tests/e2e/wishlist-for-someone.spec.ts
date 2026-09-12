import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistForSomeoneAndNavigate,
	addGift,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';

/**
 * Create-for-someone flow (issue #99, recipient + správce role model).
 *
 * A user creates a list "for someone else" (free-text recipient). The creator becomes the
 * first správce (moderator role), NOT the recipient — so the header leads with „Pro {recipient}"
 * + a „Spravuje {creator}" meta line, and the creator (a správce) DOES see reservation controls
 * (unlike a recipient, whose surprise is protected).
 */
test.describe('Create a wishlist for someone else', () => {
	test('header shows „Pro {recipient}" + „Spravuje {creator}" and the creator can reserve', async ({
		browser,
		request,
		baseURL,
	}) => {
		const creator = createTestUser('for-someone-creator');
		const page = await registerAndGetPage(browser, request, baseURL!, creator);

		const recipientName = 'Rosie';
		await createWishlistForSomeoneAndNavigate(page, {
			title: 'Vánoce pro Rosie',
			recipientName,
		});

		// ── Header variant A: recipient-first name slot + managed-by meta line ──────────
		const banner = page.getByTestId('wishlist-banner');

		// The prominent name slot reads „Pro: Rosie" — colon form on all lists since the
		// 2026-07-14 header decision (prefix „Pro:" is „For:" in the en base locale).
		await expect(banner.getByText(/(Pro|For):\s+Rosie/)).toBeVisible({ timeout: 10_000 });

		// „Spravuje {creator}" / „Managed by {creator}" — the creator is the sole správce, and
		// their account name (createTestUser → „E2E for-someone-creator") appears in the meta row.
		await expect(
			banner.getByText(new RegExp(`(Spravuje|Managed by)\\s+${creator.name}`)),
		).toBeVisible({
			timeout: 10_000,
		});

		// ── Creator is a správce: reservation controls are visible + reservable ─────────
		// Add a gift and share so the reserve footer is meaningful, then assert the creator
		// sees the reserve control. Locale-agnostic: ReserveButton's label/aria-label are
		// i18n'd (issue #154), so select via the stable data-testid rather than the
		// (locale-dependent) accessible name. This also sidesteps the drag-to-reorder
		// wrapper (role="button") around each card, whose aggregated accessible name used
		// to require an exact-name match to disambiguate from the real reserve button.
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);

		const reserveButton = page.getByTestId('reserve-button');
		await expect(reserveButton).toBeVisible({ timeout: 10_000 });
		await reserveButton.click();
		const reserveDialog = page.getByRole('dialog');
		await expect(reserveDialog).toBeVisible();
		await reserveDialog.getByRole('button', { name: /Rezervovat|Reserve/ }).click();
		await expect(reserveDialog).toBeHidden();
		await expect(
			page.getByRole('button', {
				name: new RegExp(
					`Zrušit rezervaci ${TEST_GIFT.name}|Cancel reservation for ${TEST_GIFT.name}`,
				),
			}),
		).toBeVisible();

		await page.context().close();
	});
});
