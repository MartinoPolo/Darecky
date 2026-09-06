import { cleanup, render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import { REVERT_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import { WISHLIST_ROLES, type Wishlist } from '$lib/modules/wishlists/types.js';
import { GIFT_CATEGORY_PRESETS } from '$lib/modules/gift-categories/types.js';
import { createDefaultWishlistSlots } from '$lib/modules/images/index.js';

const remoteMocks = vi.hoisted(() => ({
	refreshGiftCategorySettings: vi.fn().mockResolvedValue(undefined),
	saveGiftCategorySettingsCommand: vi.fn(),
	saveWishlistSettings: vi.fn(),
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/wishlists/wishlist_settings.remote.js', () => ({
	saveWishlistSettings: remoteMocks.saveWishlistSettings,
}));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({ current: [] })),
	getGiftCategorySettingsRows: vi.fn(() => ({
		current: [],
		refresh: remoteMocks.refreshGiftCategorySettings,
	})),
}));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	saveGiftCategorySettingsCommand: remoteMocks.saveGiftCategorySettingsCommand,
}));

import WishlistSettingsModal from './WishlistSettingsModal.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const wishlist: Wishlist = {
	id: 'wishlist-settings-test',
	shortId: 'settings1',
	recipientUserId: 'recipient-1',
	recipientName: null,
	title: 'Test wishlist',
	description: null,
	eventDate: null,
	status: 'draft',
	theme: 'default',
	customThemeColor: null,
	palette: 'sky',
	imageKey: null,
	imageSlots: null,
	recipientIsModerator: false,
	sharedAt: null,
	eventDateEditedAt: null,
	archivedAt: null,
	deletedAt: null,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function renderSettings(overrides: Partial<ComponentProps<typeof WishlistSettingsModal>> = {}) {
	return render(WishlistSettingsModal, {
		open: true,
		activeTab: 'details',
		wishlist,
		canManage: true,
		role: WISHLIST_ROLES.recipient,
		revertCapability: REVERT_CAPABILITY.hidden,
		recipientDisplayName: 'Test Recipient',
		themeEmoji: '🎁',
		onsaved: async () => {},
		onimport: () => {},
		onexport: () => {},
		...overrides,
	});
}

describe('WishlistSettingsModal import and export tab', () => {
	it('keeps spreadsheet actions out of Details and reveals them only on the dedicated tab', async () => {
		const screen = renderSettings();

		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.not.toBeInTheDocument();

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();

		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.toBeVisible();
	});

	it('keeps the existing import and export callbacks on the dedicated tab actions', async () => {
		const onimport = vi.fn();
		const onexport = vi.fn();
		const screen = renderSettings({ onimport, onexport });

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();
		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		await screen.getByRole('button', { name: m.export_toolbar_label() }).click();

		expect(onimport).toHaveBeenCalledOnce();
		expect(onexport).toHaveBeenCalledOnce();
	});

	it('guards Import with Save, Discard, and Continue editing choices', async () => {
		const onimport = vi.fn();
		const screen = renderSettings({ onimport, activeTab: 'categories' });
		await screen.getByPlaceholder(m.gift_category_custom_placeholder()).fill('Nová kategorie');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();
		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		expect(onimport).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: m.wishlist_settings_continue_editing() }).click();
		expect(onimport).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		await screen.getByRole('button', { name: m.wishlist_settings_discard() }).click();
		expect(onimport).toHaveBeenCalledOnce();
	});

	it('enables the Details Save only for a meaningful change', async () => {
		const screen = renderSettings();
		const save = screen.getByRole('button', { name: m.save() });
		const title = screen.getByLabelText(m.wishlist_name_label());

		await expect.element(save).toBeDisabled();
		await title.fill('Updated wishlist');
		await expect.element(save).toBeEnabled();
		await title.fill(wishlist.title);
		await expect.element(save).toBeDisabled();
	});

	it('enables the Image Save only after the image settings change', async () => {
		const screen = renderSettings({
			activeTab: 'image',
			wishlist: {
				...wishlist,
				imageKey: 'demo/v1/backpack.jpg',
				imageSlots: createDefaultWishlistSlots(),
			},
		});
		const save = screen.getByRole('button', { name: m.save() });

		await expect.element(save).toBeDisabled();
		await screen.getByRole('radio', { name: m.image_fit_fit() }).click();
		await expect.element(save).toBeEnabled();
		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		await expect.element(save).toBeDisabled();
		await screen.getByRole('button', { name: m.wishlist_image_remove() }).click();
		await expect.element(save).toBeEnabled();
	});

	it('commits staged category changes through the composite global Save', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({ activeTab: 'categories' });
		await screen.getByPlaceholder(m.gift_category_custom_placeholder()).fill('Nová kategorie');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		const preset = GIFT_CATEGORY_PRESETS[0]!;
		await screen.getByText(preset.labels.cs).click();
		expect(remoteMocks.saveWishlistSettings).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledWith({
			wishlistId: wishlist.id,
			categories: {
				customCategories: [{ id: null, label: 'Nová kategorie', color: '#0369A1' }],
				presetKeys: [preset.key],
				presetColors: [{ key: preset.key, color: preset.color }],
				confirmedRemovalCategoryIds: [],
			},
		});
	});

	it('closes only after the composite save succeeds', async () => {
		let resolveSave!: () => void;
		remoteMocks.saveWishlistSettings
			.mockReset()
			.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveSave = resolve)));
		const screen = renderSettings({ activeTab: 'categories' });
		await screen.getByPlaceholder(m.gift_category_custom_placeholder()).fill('Nová kategorie');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		await screen.getByRole('button', { name: m.save() }).click();
		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_title() }))
			.toBeVisible();
		resolveSave();
		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_title() }))
			.not.toBeInTheDocument();
	});

	it('keeps the modal and shared drafts intact when composite save fails', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockRejectedValueOnce(new Error('network'));
		const screen = renderSettings();
		const title = screen.getByLabelText(m.wishlist_name_label());
		await title.fill('Rozepsané změny');
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_title() }))
			.toBeVisible();
		await expect.element(title).toHaveValue('Rozepsané změny');
		await expect.element(screen.getByRole('button', { name: m.save() })).toBeEnabled();
	});

	it('stages palette preview until global Save', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValueOnce(undefined);
		const onpaletteselect = vi.fn();
		const screen = renderSettings({ activeTab: 'appearance', onpaletteselect });
		await screen.getByRole('button', { name: 'Oceán' }).click();
		expect(onpaletteselect).toHaveBeenCalledWith('ocean');
		expect(remoteMocks.saveWishlistSettings).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: m.save() }).click();
		expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledWith({
			wishlistId: wishlist.id,
			palette: 'ocean',
		});
	});

	it('keeps one global Save visible on Import and Danger tabs', async () => {
		const screen = renderSettings();
		const footer = screen.getByTestId('wishlist-settings-footer').element();
		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();
		expect(screen.getByTestId('wishlist-settings-footer').element()).toBe(footer);
		await expect.element(screen.getByRole('button', { name: m.save() })).toBeVisible();
		await screen.getByRole('tab', { name: m.wishlist_settings_danger_tab() }).click();
		await expect.element(screen.getByRole('button', { name: m.save() })).toBeVisible();
	});

	it('keeps the six tabs in one horizontally scrollable row', () => {
		const screen = renderSettings();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();
		expect(tablist.classList).toContain('flex-nowrap');
		expect(tablist.classList).toContain('overflow-x-auto');
		expect(tablist.classList).not.toContain('sm:flex-col');
		expect(
			[...tablist.querySelectorAll('[role=tab]')].map((tab) => tab.textContent?.trim()),
		).toEqual([
			m.wishlist_settings_details_section(),
			m.wishlist_settings_categories_tab(),
			m.wishlist_settings_appearance_tab(),
			m.wishlist_settings_image_section(),
			m.wishlist_settings_data_title(),
			m.wishlist_settings_danger_tab(),
		]);
	});

	it('always reports horizontal orientation to assistive technology', async () => {
		const screen = renderSettings();
		await expect
			.element(screen.getByRole('tablist', { name: m.wishlist_settings_title() }))
			.toHaveAttribute('aria-orientation', 'horizontal');
	});

	it('keeps a dirty draft visible after Escape and Continue editing', async () => {
		const screen = renderSettings();
		const title = screen.getByLabelText(m.wishlist_name_label());
		await title.fill('Rozepsané změny');

		await userEvent.keyboard('{Escape}');
		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_unsaved_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.wishlist_settings_continue_editing() }).click();

		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_title() }))
			.toBeVisible();
		await expect.element(title).toHaveValue('Rozepsané změny');
	});

	it('keeps keyboard-selected tabs visible in the mobile-width overflow', async () => {
		const screen = renderSettings();
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() }).element();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();
		dialog.style.cssText = 'height: 240px; overflow-y: auto; overflow-anchor: none';
		tablist.style.cssText = 'display: flex; overflow-x: auto; width: 220px';
		const details = screen.getByRole('tab', { name: m.wishlist_settings_details_section() });
		const danger = screen.getByRole('tab', { name: m.wishlist_settings_danger_tab() });
		details.element().focus();
		for (const tab of screen.getByRole('tab').all()) {
			tab.element().style.cssText = 'flex: none; width: 110px';
		}

		expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);
		dialog.scrollTop = 80;
		expect(dialog.scrollTop).toBeGreaterThan(0);
		const dialogScrollTop = dialog.scrollTop;
		const pageScrollY = window.scrollY;
		await userEvent.keyboard('{End}');

		await expect.element(danger).toHaveFocus();
		await expect.element(danger).toHaveAttribute('aria-selected', 'true');
		let tablistRect = tablist.getBoundingClientRect();
		const dangerRect = danger.element().getBoundingClientRect();
		expect(dangerRect.left).toBeGreaterThanOrEqual(tablistRect.left);
		expect(dangerRect.right).toBeLessThanOrEqual(tablistRect.right);
		expect(dialog.scrollTop).toBe(dialogScrollTop);
		expect(window.scrollY).toBe(pageScrollY);

		await userEvent.keyboard('{Home}');
		await expect.element(details).toHaveFocus();
		tablistRect = tablist.getBoundingClientRect();
		const detailsRect = details.element().getBoundingClientRect();
		expect(detailsRect.left).toBeGreaterThanOrEqual(tablistRect.left);
		expect(detailsRect.right).toBeLessThanOrEqual(tablistRect.right);
		expect(dialog.scrollTop).toBe(dialogScrollTop);
		expect(window.scrollY).toBe(pageScrollY);
	});
});
