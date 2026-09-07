import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
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

function normalizeColor(value: string): string {
	const probe = document.createElement('div');
	probe.style.color = value;
	document.body.appendChild(probe);
	const normalized = getComputedStyle(probe).color;
	probe.remove();
	return normalized;
}

function settingsCard(label: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		`[data-testid="gift-category-settings-card"][data-category-label="${label}"]`,
	);
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
		expect(counts[0]!.className).toContain('text-right');
		expect(counts[0]!.parentElement?.querySelector('input')).not.toBeNull();
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

	it('shows each custom and preset card with its current accent color', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport', color: '#0369A1' }),
			category({
				id: 'preset-enabled',
				presetKey: preset.key,
				customLabel: null,
				color: '#16a34a',
				sortOrder: 1,
			}),
			category({
				id: 'preset-disabled',
				presetKey: GIFT_CATEGORY_PRESETS[1]!.key,
				customLabel: null,
				color: '#b91c1c',
				enabled: false,
				sortOrder: 2,
			}),
		];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await vi.waitFor(() => expect(settingsCard('Sport')).toBeTruthy());
		expect(getComputedStyle(settingsCard('Sport')!).borderLeftColor).toBe(
			normalizeColor('#0369A1'),
		);
		expect(getComputedStyle(settingsCard(preset.labels.cs)!).borderLeftColor).toBe(
			normalizeColor('#16a34a'),
		);
		expect(
			getComputedStyle(settingsCard(GIFT_CATEGORY_PRESETS[1]!.labels.cs)!).borderLeftColor,
		).toBe(normalizeColor(GIFT_CATEGORY_PRESETS[1]!.color));
	});

	it('uses the same color-picker trigger for custom and enabled preset rows only', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport', color: '#0369A1' }),
			category({
				id: 'preset-enabled',
				presetKey: preset.key,
				customLabel: null,
				color: preset.color,
				sortOrder: 1,
			}),
			category({
				id: 'preset-disabled',
				presetKey: GIFT_CATEGORY_PRESETS[1]!.key,
				customLabel: null,
				enabled: false,
				sortOrder: 2,
			}),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await expect.element(screen.getByRole('button', { name: 'Sport' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: preset.labels.cs })).toBeVisible();
		expect(
			screen.getByRole('button', { name: GIFT_CATEGORY_PRESETS[1]!.labels.cs }).elements(),
		).toHaveLength(0);
	});

	it('updates a custom picker accessible name as its category label is edited', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport' })];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await userEvent.fill(findInput('Sport')!, 'Pohyb');
		await expect.element(screen.getByRole('button', { name: 'Pohyb' })).toBeVisible();
	});

	it('disables every category color trigger while a save is pending', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport' }),
			category({ id: 'preset', presetKey: preset.key, customLabel: null, sortOrder: 1 }),
		];
		let finishSave!: () => void;
		remoteMocks.save.mockReturnValue(new Promise<void>((resolve) => (finishSave = resolve)));
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
		await expect.element(screen.getByRole('button', { name: 'Sport' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: preset.labels.cs })).toBeDisabled();
		finishSave();
	});

	it('opening a preset picker does not toggle its checkbox', async () => {
		remoteMocks.categories = [
			category({ presetKey: preset.key, customLabel: null, color: preset.color }),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const checkbox = screen.getByRole('checkbox', { name: preset.labels.cs });

		await screen.getByRole('button', { name: preset.labels.cs }).click();
		await expect.element(page.getByRole('dialog', { name: preset.labels.cs })).toBeVisible();
		await expect.element(checkbox).toBeChecked();
	});

	it('updates the custom card accent only after explicit picker acceptance', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport', color: '#0369A1' }),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: 'Sport' }).click();
		const dialog = page.getByRole('dialog', { name: 'Sport' });
		await dialog.getByRole('textbox', { name: m.color_picker_hex_label() }).fill('#b91c1c');

		expect(getComputedStyle(settingsCard('Sport')!).borderLeftColor).toBe(
			normalizeColor('#0369A1'),
		);
		expect(remoteMocks.save).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() =>
			expect(getComputedStyle(settingsCard('Sport')!).borderLeftColor).toBe(
				normalizeColor('#b91c1c'),
			),
		);
	});

	it('accepts the preset card accent explicitly before the parent form persists it', async () => {
		remoteMocks.categories = [
			category({
				id: 'preset-enabled',
				presetKey: preset.key,
				customLabel: null,
				color: '#0369A1',
			}),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: preset.labels.cs }).click();
		const dialog = page.getByRole('dialog', { name: preset.labels.cs });
		await dialog.getByRole('textbox', { name: m.color_picker_hex_label() }).fill('#7c3aed');

		expect(getComputedStyle(settingsCard(preset.labels.cs)!).borderLeftColor).toBe(
			normalizeColor('#0369A1'),
		);
		expect(remoteMocks.save).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() =>
			expect(getComputedStyle(settingsCard(preset.labels.cs)!).borderLeftColor).toBe(
				normalizeColor('#7c3aed'),
			),
		);
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [],
				presetKeys: [preset.key],
				presetColors: [{ key: preset.key, color: '#7c3aed' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('re-enables a disabled preset with its stored color and saves that color', async () => {
		remoteMocks.categories = [
			category({
				id: 'preset-disabled',
				presetKey: preset.key,
				customLabel: null,
				color: '#b91c1c',
				enabled: false,
			}),
		];
		remoteMocks.save.mockResolvedValue(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		const checkbox = screen.getByRole('checkbox', { name: preset.labels.cs });
		const trigger = screen.getByRole('button', { name: preset.labels.cs });
		await expect.element(checkbox).not.toBeChecked();
		expect(trigger.elements()).toHaveLength(0);

		await checkbox.click();
		await expect.element(trigger).toBeVisible();
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe(normalizeColor('#b91c1c'));
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [],
				presetKeys: [preset.key],
				presetColors: [{ key: preset.key, color: '#b91c1c' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('persists a disabled preset recolor only after explicit picker acceptance', async () => {
		remoteMocks.categories = [
			category({
				id: 'preset-disabled',
				presetKey: preset.key,
				customLabel: null,
				color: '#b91c1c',
				enabled: false,
			}),
		];
		remoteMocks.save.mockResolvedValue(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('checkbox', { name: preset.labels.cs }).click();
		await screen.getByRole('button', { name: preset.labels.cs }).click();
		const dialog = page.getByRole('dialog', { name: preset.labels.cs });
		await dialog.getByRole('textbox', { name: m.color_picker_hex_label() }).fill('#2563eb');
		expect(getComputedStyle(settingsCard(preset.labels.cs)!).borderLeftColor).toBe(
			normalizeColor('#b91c1c'),
		);
		expect(remoteMocks.save).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: m.save() }).click();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [],
				presetKeys: [preset.key],
				presetColors: [{ key: preset.key, color: '#2563eb' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('advances the new custom draft color past disabled historical custom rows', async () => {
		remoteMocks.categories = [
			category({ id: 'custom-active', customLabel: 'Sport', color: '#0369A1' }),
			category({
				id: 'custom-disabled',
				customLabel: 'Historie',
				color: '#047857',
				enabled: false,
				sortOrder: 1,
			}),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const input = screen.getByPlaceholder(m.gift_category_custom_placeholder());
		await input.fill('Knihy');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();

		const trigger = screen.getByRole('button', { name: 'Knihy' });
		await expect.element(trigger).toBeVisible();
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe(normalizeColor('#a21caf'));
	});

	it('does not reuse a custom draft color after deleting an earlier unsaved draft', async () => {
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const input = screen.getByPlaceholder(m.gift_category_custom_placeholder());
		const createButton = screen.getByRole('button', { name: m.gift_category_create() });

		await input.fill('První');
		await createButton.click();
		await input.fill('Druhá');
		await createButton.click();
		await vi.waitFor(() => expect(settingsCard('První')).toBeTruthy());

		const firstDraftCard = settingsCard('První')!;
		await userEvent.click(
			firstDraftCard.querySelector<HTMLButtonElement>(`button[aria-label="${m.delete()}"]`)!,
		);
		await vi.waitFor(() => expect(settingsCard('První')).toBeNull());

		await input.fill('Třetí');
		await createButton.click();
		const secondTrigger = screen.getByRole('button', { name: 'Druhá' });
		const thirdTrigger = screen.getByRole('button', { name: 'Třetí' });
		await expect.element(thirdTrigger).toBeVisible();

		await expect.element(secondTrigger).toBeVisible();
		expect(getComputedStyle(secondTrigger.element()).backgroundColor).toBe(
			normalizeColor('#047857'),
		);
		expect(getComputedStyle(thirdTrigger.element()).backgroundColor).toBe(
			normalizeColor('#a21caf'),
		);
	});

	it('lets managers explicitly accept draft color before sending every active category color', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport', color: '#0369A1' }),
			category({
				id: 'preset',
				presetKey: preset.key,
				customLabel: null,
				color: preset.color,
				sortOrder: 1,
			}),
		];
		remoteMocks.save.mockResolvedValue(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: 'Sport' }).click();
		const dialog = page.getByRole('dialog', { name: 'Sport' });
		await dialog.getByRole('textbox', { name: m.color_picker_hex_label() }).fill('#b91c1c');
		expect(getComputedStyle(settingsCard('Sport')!).borderLeftColor).toBe(
			normalizeColor('#0369A1'),
		);
		expect(remoteMocks.save).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: m.save() }).click();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [{ id: 'custom', label: 'Sport', color: '#b91c1c' }],
				presetKeys: [preset.key],
				presetColors: [{ key: preset.key, color: preset.color }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('creates from the focused input on Enter without submitting the settings form', async () => {
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const input = screen.getByPlaceholder(m.gift_category_custom_placeholder());
		await input.fill('Knihy');
		await input.click();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(findInput('Knihy')).toBeDefined());
		expect(remoteMocks.save).not.toHaveBeenCalled();
	});
});
