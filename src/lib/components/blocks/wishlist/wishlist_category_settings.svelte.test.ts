import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_CATEGORY_PRESETS } from '$lib/modules/gift-categories/types.js';
import type { ManagedGiftCategorySettingsRow } from '$lib/modules/gift-categories/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

const remoteMocks = vi.hoisted(() => ({
	categories: [] as ManagedGiftCategorySettingsRow[],
	refresh: vi.fn(),
	save: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategorySettingsRows: vi.fn(() => ({
		get current() {
			return remoteMocks.categories;
		},
		refresh: remoteMocks.refresh,
	})),
}));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	saveGiftCategorySettingsCommand: remoteMocks.save,
}));

const { default: WishlistCategorySettings } = await import('./WishlistCategorySettings.svelte');
const preset = GIFT_CATEGORY_PRESETS[0]!;

function findInput(value: string): HTMLInputElement | undefined {
	return [...document.querySelectorAll<HTMLInputElement>('input')].find(
		(input) => input.value === value,
	);
}

function category(
	overrides: Partial<ManagedGiftCategorySettingsRow>,
): ManagedGiftCategorySettingsRow {
	return {
		id: 'category-1',
		presetKey: null,
		customLabel: 'Sport',
		color: '#0369A1',
		sortOrder: 0,
		usedCount: 0,
		enabled: true,
		...overrides,
	};
}

beforeEach(() => {
	remoteMocks.refresh.mockReset();
	remoteMocks.refresh.mockResolvedValue(undefined);
	remoteMocks.save.mockReset();
	remoteMocks.categories = [];
});

describe('WishlistCategorySettings', () => {
	it('refreshes stale usage before enabling removal and uses the fresh count', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		let finishRefresh!: () => void;
		remoteMocks.refresh.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishRefresh = () => {
						remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 1 })];
						resolve();
					};
				}),
		);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const removeButton = screen.getByRole('button', { name: m.delete() });

		await expect.element(removeButton).toBeDisabled();
		finishRefresh();
		await expect.element(removeButton).toBeEnabled();
		await removeButton.click();

		await expect.element(page.getByRole('dialog')).toBeVisible();
		expect(page.getByRole('dialog').element().textContent).toContain('1');
	});

	it('keeps category controls disabled after a refresh failure and retries safely', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		remoteMocks.refresh
			.mockRejectedValueOnce(new Error('refresh failed'))
			.mockResolvedValueOnce(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await expect.element(page.getByRole('alert')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: m.delete() })).toBeDisabled();
		await page.getByRole('button', { name: m.import_wizard_retry() }).click();

		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledTimes(2));
		await expect.element(screen.getByRole('button', { name: m.delete() })).toBeEnabled();
		expect(page.getByRole('alert').elements()).toHaveLength(0);
	});

	it('shows a right-aligned compact usage count, including zero, beside every active category', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport', usedCount: 0 }),
			category({
				id: 'preset',
				presetKey: preset.key,
				customLabel: null,
				sortOrder: 1,
				usedCount: 3,
			}),
		];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		const counts = document.querySelectorAll('[data-testid="gift-category-used-count"]');
		expect(counts).toHaveLength(2);
		expect(counts[0]!.textContent).toContain('0');
		expect(counts[1]!.textContent).toContain('3');
		expect(counts[0]!.getBoundingClientRect().right).toBeGreaterThan(
			counts[0]!.parentElement!.querySelector('input')!.getBoundingClientRect().right,
		);
		expect(counts[1]!.parentElement?.textContent).toContain(preset.labels.cs);
	});

	it('removes a persisted zero-use custom category without confirmation', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		remoteMocks.save.mockResolvedValue(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: m.delete() }).click();

		await vi.waitFor(() => expect(findInput('Sport')).toBeUndefined());
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [],
				presetKeys: [],
				presetColors: [],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('disables a persisted zero-use preset without confirmation', async () => {
		remoteMocks.categories = [
			category({ presetKey: preset.key, customLabel: null, usedCount: 0 }),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const checkbox = screen.getByRole('checkbox', { name: preset.labels.cs });

		await checkbox.click();

		await expect.element(checkbox).not.toBeChecked();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it('keeps the used persisted preset checkbox mounted and restores its focus after cancel and accept', async () => {
		remoteMocks.categories = [
			category({ presetKey: preset.key, customLabel: null, usedCount: 2 }),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const checkbox = screen.getByRole('checkbox', { name: preset.labels.cs });
		const checkboxElement = checkbox.element();

		await checkbox.click();
		await page.getByRole('dialog').getByRole('button', { name: m.cancel() }).click();
		await expect.element(checkbox).toBeChecked();
		await vi.waitFor(() => expect(document.activeElement).toBe(checkboxElement));
		expect(checkbox.element()).toBe(checkboxElement);

		await checkbox.click();
		await page.getByTestId('gift-category-remove-confirm').click();
		await expect.element(checkbox).not.toBeChecked();
		await vi.waitFor(() => expect(document.activeElement).toBe(checkboxElement));
		expect(checkbox.element()).toBe(checkboxElement);
		expect(remoteMocks.save).not.toHaveBeenCalled();
	});

	it('sends only confirmed persisted removals and clears them after a successful save', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 2 })];
		remoteMocks.save.mockResolvedValue(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: m.delete() }).click();
		await page.getByTestId('gift-category-remove-confirm').click();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [],
				presetKeys: [],
				presetColors: [],
				confirmedRemovalCategoryIds: ['category-1'],
			}),
		);

		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
		await vi.waitFor(() => expect(remoteMocks.save).toHaveBeenCalledTimes(2));
		expect(remoteMocks.save.mock.calls[1]?.[0]).toMatchObject({
			confirmedRemovalCategoryIds: [],
		});
	});

	it('refreshes and requires fresh confirmation after a concurrent category conflict', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 1 })];
		remoteMocks.save.mockRejectedValue(
			new Error(SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH),
		);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledOnce());
		remoteMocks.refresh.mockClear();

		await screen.getByRole('button', { name: m.delete() }).click();
		await page.getByTestId('gift-category-remove-confirm').click();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(findInput('Sport')).toBeDefined());
		remoteMocks.save.mockResolvedValue(undefined);
		await screen.getByRole('button', { name: m.delete() }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
	});
});
