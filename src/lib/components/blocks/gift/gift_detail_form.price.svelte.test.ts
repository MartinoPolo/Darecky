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
import { IMAGE_FIT_MODES } from '$lib/modules/images/index.js';

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

describe('GiftDetailForm price-range UI (issue #171)', () => {
	it('applies reversible second-highest-order stepping to ArrowUp and ArrowDown', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 99.99 }),
		});
		const priceInput = screen.getByRole('spinbutton', { name: m.gift_price_label() });

		await priceInput.click();
		await userEvent.keyboard('{ArrowUp}');
		await expect.element(priceInput).toHaveValue(100.99);

		await priceInput.fill('100.08');
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(priceInput).toHaveValue(99.08);
	});

	it('adjusts both range bounds independently from each bound pre-key value', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 9.99, priceMax: 100.08 }),
		});
		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });

		await minInput.click();
		await userEvent.keyboard('{ArrowUp}');
		await expect.element(minInput).toHaveValue(10.99);
		await expect.element(maxInput).toHaveValue(100.08);

		await maxInput.click();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(minInput).toHaveValue(10.99);
		await expect.element(maxInput).toHaveValue(99.08);
	});

	it('uses magnitude stepping for focused single-price wheel and cancels page scrolling', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 99.99 }),
		});
		const priceInput = screen.getByRole('spinbutton', { name: m.gift_price_label() });
		const unfocusedWheel = new WheelEvent('wheel', { deltaY: -1, cancelable: true });

		priceInput.element().dispatchEvent(unfocusedWheel);
		expect(unfocusedWheel.defaultPrevented).toBe(false);
		await expect.element(priceInput).toHaveValue(99.99);

		priceInput.element().focus();
		const focusedWheel = new WheelEvent('wheel', { deltaY: -1, cancelable: true });
		priceInput.element().dispatchEvent(focusedWheel);
		expect(focusedWheel.defaultPrevented).toBe(true);
		await expect.element(priceInput).toHaveValue(100.99);
	});

	it('uses the same focused wheel handling independently for both range bounds', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 9.99, priceMax: 100.08 }),
		});
		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });

		minInput.element().focus();
		const minWheel = new WheelEvent('wheel', { deltaY: -1, cancelable: true });
		minInput.element().dispatchEvent(minWheel);
		expect(minWheel.defaultPrevented).toBe(true);
		await expect.element(minInput).toHaveValue(10.99);
		await expect.element(maxInput).toHaveValue(100.08);

		maxInput.element().focus();
		const maxWheel = new WheelEvent('wheel', { deltaY: 1, cancelable: true });
		maxInput.element().dispatchEvent(maxWheel);
		expect(maxWheel.defaultPrevented).toBe(true);
		await expect.element(minInput).toHaveValue(10.99);
		await expect.element(maxInput).toHaveValue(99.08);
	});

	it('reopens and submits a decimal single price (issue #250 REQ-1, REQ-4)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 19.5, priceMax: null, currency: 'EUR' }),
			onupdate,
		});

		const priceInput = document.querySelector('#gift-price');
		expect(priceInput).toHaveAttribute('step', '0.01');
		expect(priceInput).toHaveValue(19.5);

		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ price: 19.5, priceMax: null, currency: 'EUR' }),
		);
	});

	it('saves a manually entered off-grid decimal price unchanged', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: null }),
			onupdate,
		});

		await screen.getByRole('spinbutton', { name: m.gift_price_label() }).fill('100.08');
		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledWith(expect.objectContaining({ price: 100.08 }));
	});

	it('reopens and submits decimal range bounds (issue #250 REQ-1, REQ-4)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 19.5, priceMax: 29.95, currency: 'EUR' }),
			onupdate,
		});

		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });
		await expect.element(minInput).toHaveAttribute('step', '0.01');
		await expect.element(maxInput).toHaveAttribute('step', '0.01');
		await expect.element(minInput).toHaveValue(19.5);
		await expect.element(maxInput).toHaveValue(29.95);

		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ price: 19.5, priceMax: 29.95, currency: 'EUR' }),
		);
	});

	it('defaults to single-price mode when the gift has no priceMax (REQ-1)', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: null }),
		});

		await expect
			.element(screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }))
			.not.toBeChecked();
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() }))
			.not.toBeInTheDocument();
	});

	it('opens in range mode when the gift already has a priceMax (REQ-1)', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: 200 }),
		});

		await expect
			.element(screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }))
			.toBeChecked();
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() }))
			.toHaveValue(100);
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() }))
			.toHaveValue(200);
	});

	it('shows the cross-field validation error and a11y wiring when max < min (REQ-2)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 200, priceMax: 100 }),
			onupdate,
		});

		await screen.getByRole('button', { name: m.save() }).click();

		const errorText = screen.getByText(m.gift_price_range_invalid());
		await expect.element(errorText).toBeVisible();

		// Assert the input-to-error association contract, not the hardcoded id string.
		const errorId = errorText.element().id;
		expect(errorId).not.toBe('');

		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });
		await expect.element(minInput).toHaveAttribute('aria-invalid', 'true');
		await expect.element(minInput).toHaveAttribute('aria-describedby', errorId);
		await expect.element(maxInput).toHaveAttribute('aria-invalid', 'true');
		await expect.element(maxInput).toHaveAttribute('aria-describedby', errorId);

		expect(onupdate).not.toHaveBeenCalled();
	});

	it('requires both bounds before submitting a range (REQ-2)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: null }),
			onupdate,
		});

		// Turn range mode on without filling the newly-revealed max bound.
		await screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }).click();
		await screen.getByRole('button', { name: m.save() }).click();

		await expect.element(screen.getByText(m.gift_price_range_required())).toBeVisible();
		expect(onupdate).not.toHaveBeenCalled();
	});

	it('submits a valid range with no aria-invalid wiring (REQ-2)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: 200 }),
			onupdate,
		});

		await screen.getByRole('button', { name: m.save() }).click();

		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });
		await expect.element(minInput).not.toHaveAttribute('aria-invalid');
		await expect.element(maxInput).not.toHaveAttribute('aria-invalid');

		expect(onupdate).toHaveBeenCalledTimes(1);
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'gift-1', price: 100, priceMax: 200 }),
		);
	});

	it('toggling range mode off clears priceMax and submits a single price (REQ-3)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: 200 }),
			onupdate,
		});

		await screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }).click();
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() }))
			.not.toBeInTheDocument();

		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledTimes(1);
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'gift-1', price: 100, priceMax: null }),
		);
	});
});

describe('GiftDetailForm legacy `auto` normalization (issue #183 EXTRA)', () => {
	// A wide/landscape data-URI source: its natural ratio (400/100 = 4) diverges
	// from the 4:3 gift window (÷ 4/3 = 3.0) well past `AUTO_CONTAIN_RATIO_THRESHOLD`
	// (2), so a real `auto` render would letterbox (Fit/contain) rather than
	// cover-crop – exercising `resolveAutoFit` against a real measured image
	// instead of asserting the pure function in isolation.
	const landscapeImageUrl =
		'data:image/svg+xml,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"/>');

	it('normalizes an untouched legacy auto row to the Fit toggle without dirtying the mode (REQ-8)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({
				imageUrl: landscapeImageUrl,
				imageMeta: {
					fitMode: IMAGE_FIT_MODES.auto,
					cropRect: null,
					focal: { x: 50, y: 50 },
					zoom: 1,
					bgColor: null,
				},
			}),
			onupdate,
		});

		// The toggle normalizes to Fit once the natural ratio is measured – purely
		// a presentation normalization (`presentedEditorMode`); the internal
		// `editorMode` stays at its `giftEditorModeFromMeta` default (`fill` for
		// any `auto` row) the whole time.
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_fit() }))
			.toHaveAttribute('aria-checked', 'true');

		// Saving untouched must still persist `auto` verbatim (REQ-8). If the
		// measurement had incorrectly dirtied the mode, `savedFitMode` would
		// instead derive from the internal `fill` editorMode and persist
		// `cover-crop` here.
		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledTimes(1);
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({
				imageMeta: expect.objectContaining({ fitMode: IMAGE_FIT_MODES.auto }),
			}),
		);
	});
});

describe('GiftDetailForm dense control alignment (issue #159)', () => {
	function expectAlignedControlPair(
		rowTestId: string,
		firstControlSelector: string,
		secondControlSelector: string,
	): void {
		const row = document.querySelector<HTMLElement>(`[data-testid="${rowTestId}"]`);
		expect(row).not.toBeNull();

		const fields = [...row!.children] as HTMLElement[];
		expect(fields.length).toBeGreaterThanOrEqual(2);
		const [firstFieldRect, secondFieldRect] = fields
			.slice(0, 2)
			.map((field) => field.getBoundingClientRect());
		expect(firstFieldRect.top).toBe(secondFieldRect.top);
		expect(firstFieldRect.left).not.toBe(secondFieldRect.left);
		expect(firstFieldRect.width).toBe(secondFieldRect.width);
		expect(firstFieldRect.left).toBeLessThan(secondFieldRect.left);
		expect(secondFieldRect.left - firstFieldRect.right).toBeGreaterThan(0);

		const firstControl = fields[0]!.querySelector<HTMLElement>(firstControlSelector);
		const secondControl = fields[1]!.querySelector<HTMLElement>(secondControlSelector);
		expect(firstControl).not.toBeNull();
		expect(secondControl).not.toBeNull();
		const firstControlRect = firstControl!.getBoundingClientRect();
		const secondControlRect = secondControl!.getBoundingClientRect();
		expect(firstControlRect.height).toBe(32);
		expect(secondControlRect.height).toBe(32);
		expect(firstControlRect.top).toBe(secondControlRect.top);
		expect(firstControlRect.bottom).toBe(secondControlRect.bottom);

		const labelRows = fields.map((field) =>
			field.querySelector<HTMLElement>('[data-slot="gift-form-label-row"]'),
		);
		expect(labelRows.every((labelRow) => labelRow !== null)).toBe(true);
		const [firstLabelRowRect, secondLabelRowRect] = labelRows.map((labelRow) =>
			labelRow!.getBoundingClientRect(),
		);
		expect(firstLabelRowRect.top).toBe(secondLabelRowRect.top);

		const [firstLabelRect, secondLabelRect] = labelRows.map((labelRow) =>
			labelRow!.querySelector('label')!.getBoundingClientRect(),
		);
		expect(firstLabelRect.top).toBe(secondLabelRect.top);
		expect(firstLabelRect.bottom).toBe(secondLabelRect.bottom);
	}

	it('aligns paired label rows and 32px controls for price, currency, quantity, and category', async () => {
		await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift(),
			priorityLevels: [
				{
					id: 'priority-medium',
					wishlistId: 'wishlist-1',
					sortOrder: 1,
					label: 'Stredni',
					createdAt: new Date('2026-01-01T00:00:00Z'),
				},
			],
		});

		expectAlignedControlPair(
			'gift-price-currency-row',
			'#gift-price',
			'[data-slot="select-trigger"]',
		);
		expectAlignedControlPair(
			'gift-quantity-priority-row',
			'#gift-quantity',
			'[data-slot="select-trigger"]',
		);
	});

	it('keeps quantity and the empty category control aligned when no priorities exist', async () => {
		await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift(),
		});

		expectAlignedControlPair(
			'gift-quantity-priority-row',
			'#gift-quantity',
			'[data-slot="select-trigger"]',
		);
	});
});
