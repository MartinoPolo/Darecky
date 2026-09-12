// The dense-alignment suite below measures computed geometry (control heights,
// grid columns, label-row baselines), so the real compiled Tailwind utilities must
// be present — the bare `client` browser project doesn't load them otherwise
// (only `.storybook/preview.ts` imports app.css). Mirror that import here.
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';

// `GiftDetailForm` transitively imports `public_url.ts`, whose public env is normally
// seeded by SvelteKit's browser bootstrap. Vitest mounts into a bare document, so use
// the static root as the public image base; stored demo keys then load without calling
// the SvelteKit `/api/upload` endpoint.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

const { default: GiftDetailForm } = await import('./GiftDetailForm.svelte');

/** Minimal GiftForRecipient fixture (a GiftByRole member) for edit-mode rendering. */
function makeGift(overrides: Partial<GiftByRole> = {}): GiftByRole {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Herní konzole',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 100,
		priceMax: null,
		currency: 'CZK',
		imageUrl: '',
		imageKey: '',
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		...overrides,
	};
}

const baseProps = {
	mode: 'edit' as const,
	wishlistId: 'wishlist-1',
	priorityLevels: [],
	role: 'recipient' as const,
	postShareLocked: false,
	canDelete: false,
	isSubmitting: false,
	isDeleting: false,
};

const categoryOptions: ManagedGiftCategory[] = [
	{
		id: 'category-books',
		presetKey: null,
		customLabel: 'Books',
		color: '#2563EB',
		sortOrder: 0,
		usedCount: 1,
	},
];

describe('GiftDetailForm categories', () => {
	it('renders category selection in create mode and submits the chosen category', async () => {
		const oncreate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			categoryOptions,
			oncreate,
		});

		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('New book');
		await screen.getByRole('button', { name: m.gift_category_none() }).click();
		await screen.getByRole('option', { name: 'Books' }).click();
		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();

		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({ categoryId: 'category-books' }),
		);
	});

	it('updates category choices while the editor remains mounted', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			categoryOptions,
		});

		await screen.getByRole('button', { name: m.gift_category_none() }).click();
		await expect.element(screen.getByRole('option', { name: 'Books' })).toBeVisible();
		await userEvent.keyboard('{Escape}');

		await screen.rerender({
			categoryOptions: [
				{
					...categoryOptions[0]!,
					customLabel: 'Renamed books',
				},
			],
		});
		await screen.getByRole('button', { name: m.gift_category_none() }).click();
		await expect.element(screen.getByRole('option', { name: 'Renamed books' })).toBeVisible();
		expect(document.body.textContent).not.toContain('Books');
	});

	it('keeps a long category list scrollable and supports keyboard selection', async () => {
		const manyCategories: ManagedGiftCategory[] = Array.from({ length: 30 }, (_, index) => ({
			id: `category-${index + 1}`,
			presetKey: null,
			customLabel: `Category ${index + 1}`,
			color: '#2563EB',
			sortOrder: index,
			usedCount: 1,
		}));
		const screen = await render(GiftDetailForm, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			categoryOptions: manyCategories,
		});

		const overflowStyle = document.createElement('style');
		overflowStyle.textContent = '[data-select-viewport] { max-height: 120px !important; }';
		document.head.append(overflowStyle);
		const trigger = screen.getByRole('button', { name: m.gift_category_none() });
		trigger.element().scrollIntoView({ block: 'center' });
		await trigger.click();
		const viewport = document.querySelector<HTMLElement>('[data-select-viewport]')!;
		expect(screen.getByRole('option').all()).toHaveLength(31);
		await vi.waitFor(() => {
			expect(viewport.clientHeight).toBeGreaterThan(0);
			expect(Number.isFinite(viewport.clientHeight)).toBe(true);
			expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
		});
		viewport.scrollIntoView({ block: 'center' });
		const rect = viewport.getBoundingClientRect();
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);

		await userEvent.keyboard('{End}');
		const finalOption = screen.getByRole('option', { name: 'Category 30' }).element();
		await vi.waitFor(() => {
			expect(viewport.scrollTop).toBeGreaterThan(0);
			const viewportRect = viewport.getBoundingClientRect();
			const optionRect = finalOption.getBoundingClientRect();
			expect(optionRect.top).toBeGreaterThanOrEqual(viewportRect.top);
			expect(optionRect.bottom).toBeLessThanOrEqual(viewportRect.bottom + 1);
		});
		await userEvent.keyboard('{Enter}');
		await expect.element(screen.getByRole('button', { name: 'Category 30' })).toBeVisible();
		overflowStyle.remove();
	});

	it('preselects an edit gift category and submits null when it is cleared', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ categoryId: 'category-books' }),
			categoryOptions,
			onupdate,
		});

		await screen.getByRole('button', { name: 'Books' }).click();
		await screen.getByRole('option', { name: m.gift_category_none() }).click();
		await screen.getByRole('button', { name: m.save() }).first().click();

		expect(onupdate).toHaveBeenCalledWith(expect.objectContaining({ categoryId: null }));
	});

	it('renders a disabled empty state with settings guidance', async () => {
		const screen = await render(GiftDetailForm, { ...baseProps, gift: makeGift() });

		await expect
			.element(screen.getByRole('button', { name: m.gift_category_none_enabled() }))
			.toBeDisabled();
		await expect.element(screen.getByText(m.gift_category_none_enabled_help())).toBeVisible();
	});
});

describe('GiftDetailForm actions (issue #255)', () => {
	it.each([WISHLIST_ROLES.recipient, WISHLIST_ROLES.moderator])(
		'does not render the received toggle in the editor for %s',
		async (role) => {
			await render(GiftDetailForm, { ...baseProps, role, gift: makeGift() });

			expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
		},
	);
});

describe('GiftDetailForm stored images', () => {
	it('previews the stored key while preserving the raw retailer URL on submit', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({
				imageUrl: 'https://shop.example/original.jpg',
				imageKey: 'demo/v1/backpack.jpg',
			}),
			onupdate,
		});

		const mainPreview = document.querySelector('[data-testid="crop-stage"] img');
		const uploadPreview = document.querySelector('img[data-testid="image-upload-preview"]');
		expect(mainPreview?.getAttribute('src')).toBe('/demo/v1/backpack.jpg');
		expect(uploadPreview?.getAttribute('src')).toBe('/demo/v1/backpack.jpg');

		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({
				imageUrl: 'https://shop.example/original.jpg',
				imageKey: 'demo/v1/backpack.jpg',
			}),
		);
	});
});

describe('GiftDetailForm image backgrounds (issue #252)', () => {
	const imageUrl =
		'data:image/svg+xml,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>');

	function imageMeta(bgColor: string | null): ImageMetadata {
		return {
			fitMode: IMAGE_FIT_MODES.containPadded,
			cropRect: null,
			focal: { x: 50, y: 50 },
			zoom: 1,
			bgColor,
		};
	}

	it('selects Transparent for null, previews the default pattern, and submits null untouched', async () => {
		const onupdate = vi.fn();
		const root = document.documentElement;
		const previousValue = root.style.getPropertyValue('--secondary');
		const previousPriority = root.style.getPropertyPriority('--secondary');
		root.style.setProperty('--secondary', 'rgb(12, 34, 56)');

		try {
			const screen = await render(GiftDetailForm, {
				...baseProps,
				gift: makeGift({ imageUrl, imageMeta: imageMeta(null) }),
				onupdate,
			});

			await expect
				.element(screen.getByRole('group', { name: m.image_background_label() }))
				.toBeVisible();
			await expect
				.element(screen.getByRole('radio', { name: m.image_background_transparent() }))
				.toHaveAttribute('aria-checked', 'true');
			expect(
				screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
			).toBeTruthy();
			await vi.waitFor(() => {
				const fill = screen.container.querySelector<HTMLElement>(
					'[data-testid="crop-stage"] > [style*="background:"]',
				);
				expect(fill).not.toBeNull();
				expect(getComputedStyle(fill!).backgroundColor).toBe('rgb(12, 34, 56)');
			});

			await screen.getByRole('button', { name: m.save() }).click();
			expect(onupdate).toHaveBeenCalledWith(
				expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: null }) }),
			);
		} finally {
			if (previousValue) {
				root.style.setProperty('--secondary', previousValue, previousPriority);
			} else {
				root.style.removeProperty('--secondary');
			}
		}
	});

	it('normalizes legacy transparent metadata to the selected default and null on save', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta('transparent') }),
			onupdate,
		});

		await expect
			.element(screen.getByRole('radio', { name: m.image_background_transparent() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(
			screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
		).toBeTruthy();
		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: null }) }),
		);
	});

	it('clicking Transparent replaces an explicit fill with canonical null', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta('#000000') }),
			onupdate,
		});

		await screen.getByRole('radio', { name: m.image_background_transparent() }).click();
		await expect
			.element(screen.getByRole('radio', { name: m.image_background_transparent() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(
			screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
		).toBeTruthy();
		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: null }) }),
		);
	});

	it.each([
		[m.image_background_white(), '#ffffff', 'rgb(255, 255, 255)'],
		[m.image_background_black(), '#000000', 'rgb(0, 0, 0)'],
	])('submits %s as the exact persisted value', async (label, value, expectedBackground) => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta(null) }),
			onupdate,
		});

		await screen.getByRole('radio', { name: label }).click();
		await vi.waitFor(() => {
			const fill = screen.container.querySelector<HTMLElement>(
				'[data-testid="crop-stage"] > [style*="background:"]',
			);
			expect(fill).not.toBeNull();
			expect(getComputedStyle(fill!).backgroundColor).toBe(expectedBackground);
		});
		expect(
			screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
		).toBeNull();
		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: value }) }),
		);
	});

	it('highlights the persisted explicit choice when editing a gift', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta('#000000') }),
		});

		await expect
			.element(screen.getByRole('radio', { name: m.image_background_black() }))
			.toHaveAttribute('aria-checked', 'true');
	});
});
