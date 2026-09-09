import '../../../../app.css';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import WishlistHeaderActions from './WishlistHeaderActions.svelte';
import * as m from '$lib/paraglide/messages.js';

const callbacks = {
	onshare: vi.fn(),
	onmoderators: vi.fn(),
	onsettings: vi.fn(),
	oneditimage: vi.fn(),
	oneditrecipient: vi.fn(),
	onarchive: vi.fn(),
};

describe('WishlistHeaderActions', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(async () => page.viewport(1280, 720));
	it('renders gear-only Settings beside More and removes Settings from the management sheet', async () => {
		const screen = await render(WishlistHeaderActions, {
			canManage: true,
			settingsAvailable: true,
			canShare: true,
			canEditImage: true,
			canEditRecipient: true,
			canArchive: true,
			...callbacks,
		});
		const settings = screen.getByRole('button', { name: m.wishlist_settings_title() });
		await expect.element(settings).toBeVisible();
		expect(settings.element()).toHaveTextContent('');
		await settings.click();
		expect(callbacks.onsettings).toHaveBeenCalledOnce();
		await (
			screen.container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement
		).click();
		const dialog = screen.getByRole('menu', { name: m.gift_more_actions() });
		for (const label of [
			m.wishlist_share_button(),
			m.wishlist_moderators_label(),
			m.wishlist_edit_image_label(),
			m.wishlist_edit_recipient_label(),
			m.wishlist_archive_button(),
		]) {
			await expect
				.element(dialog.getByRole('menuitem', { name: label, exact: true }))
				.toBeVisible();
		}
		await expect
			.element(
				dialog.getByRole('menuitem', { name: m.wishlist_settings_title(), exact: true }),
			)
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('opens capability-gated mobile management actions with a separate danger region', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistHeaderActions, {
			canManage: true,
			settingsAvailable: true,
			canShare: true,
			canEditImage: true,
			canEditRecipient: true,
			canArchive: true,
			...callbacks,
		});
		await screen.getByTestId('mobile-header-more-trigger').click();
		const sheet = screen.getByRole('dialog', { name: m.gift_more_actions() });
		await expect.element(sheet).toBeVisible();
		const descriptionId = sheet.element().getAttribute('aria-describedby');
		expect(descriptionId).toBeTruthy();
		const description = document.getElementById(descriptionId!);
		expect(description).toHaveTextContent(m.wishlist_more_actions_description());
		expect(description).not.toHaveTextContent(m.wishlist_settings_title());
		for (const label of [
			m.wishlist_share_button(),
			m.wishlist_moderators_label(),
			m.wishlist_edit_image_label(),
			m.wishlist_edit_recipient_label(),
			m.wishlist_archive_button(),
		]) {
			await expect
				.element(sheet.getByRole('button', { name: label, exact: true }))
				.toBeVisible();
		}
		await expect
			.element(sheet.getByRole('button', { name: m.wishlist_settings_title() }))
			.not.toBeInTheDocument();
		const danger = screen.getByTestId('wishlist-header-danger-actions').element();
		expect(parseFloat(getComputedStyle(danger).borderTopWidth)).toBeGreaterThan(0);
		expect(danger.querySelector('button')).toHaveTextContent(m.wishlist_archive_button());
		await sheet.getByRole('button', { name: m.wishlist_share_button() }).click();
		expect(callbacks.onshare).toHaveBeenCalledOnce();
		await expect.element(sheet).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('renders no management trigger or structural sheet trace for visitors', async () => {
		const screen = await render(WishlistHeaderActions, {
			canManage: false,
			settingsAvailable: false,
			canShare: false,
			canEditImage: false,
			canEditRecipient: false,
			canArchive: false,
			...callbacks,
		});
		await expect
			.element(screen.getByRole('button', { name: m.gift_more_actions() }))
			.not.toBeInTheDocument();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('shows only capability-gated hero Settings when management is unavailable', async () => {
		const screen = await render(WishlistHeaderActions, {
			canManage: false,
			settingsAvailable: true,
			canShare: false,
			canEditImage: false,
			canEditRecipient: false,
			canArchive: false,
			...callbacks,
		});
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_settings_title() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.gift_more_actions() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});
