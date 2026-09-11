import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { GIFT_VIEW_MODES } from '$lib/modules/gifts/types.js';
import GiftViewSwitcher from './GiftViewSwitcher.svelte';

function hasVisibleBoxShadow(element: Element): boolean {
	const boxShadow = getComputedStyle(element).boxShadow;
	if (boxShadow === 'none') {
		return false;
	}
	const alphas = Array.from(boxShadow.matchAll(/rgba\([^)]*, ([\d.]+)\)/g), (match) =>
		Number(match[1]),
	);
	return alphas.length === 0 || alphas.some((alpha) => alpha > 0);
}

describe('GiftViewSwitcher toggle selection (fixes: re-click deselects both items)', () => {
	it('switches mode and fires onchange exactly once when clicking the inactive item', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.card, onchange });

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

		expect(onchange).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('keeps the active item checked and does not fire onchange when re-clicking it', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.card, onchange });

		const activeItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		await activeItem.click();

		expect(onchange).not.toHaveBeenCalled();
		await expect.element(activeItem).toHaveAttribute('data-state', 'on');
		await expect.element(activeItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('always has exactly one checked item after re-clicking the active item', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.list, onchange });

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

		const cardItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const listItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);
		await expect.element(cardItem).toHaveAttribute('aria-checked', 'false');
		await expect.element(listItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('projects legacy compact mode to exactly one checked card radio', async () => {
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.compact,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element();

		expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
		await expect
			.element(screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`))
			.toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('leaves legacy compact mode when the projected card radio is clicked', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.compact,
			onchange,
		});

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`).click();

		expect(onchange).toHaveBeenCalledExactlyOnceWith(GIFT_VIEW_MODES.card);
		await screen.unmount();
	});

	it('moves focus and requests the next selection with arrow navigation', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
		});
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		(card.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		await expect.element(list).toHaveFocus();
		expect(onchange).toHaveBeenCalledOnce();
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('does not mutate disabled controls and retains their labels and state', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
			disabled: true,
		});
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		await expect.element(card).toHaveAccessibleName('Karta');
		await expect.element(list).toHaveAccessibleName('Seznam');
		await expect.element(card).toBeDisabled();
		await expect.element(list).toBeDisabled();
		await list.click({ force: true });
		expect(onchange).not.toHaveBeenCalled();
		await expect.element(card).toHaveAttribute('aria-checked', 'true');
		await expect.element(list).toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('keeps the visible tray flush with the selected 40px mobile and 32px desktop control', async () => {
		await page.viewport(390, 720);
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
		const card = screen
			.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)
			.element() as HTMLElement;

		for (const [viewportWidth, expectedSize] of [
			[390, 40],
			[800, 32],
		] as const) {
			await page.viewport(viewportWidth, 720);
			const trayBounds = group.getBoundingClientRect();
			const selectedBounds = card.getBoundingClientRect();

			expect(selectedBounds.width).toBe(expectedSize);
			expect(selectedBounds.height).toBe(expectedSize);
			expect(trayBounds.top).toBeCloseTo(selectedBounds.top, 1);
			expect(trayBounds.bottom).toBeCloseTo(selectedBounds.bottom, 1);
			// A shadow paints beyond the tray's border box, recreating the taller accent halo
			// even when getBoundingClientRect reports the same height as the selected item.
			expect(hasVisibleBoxShadow(group)).toBe(false);
		}
		await screen.unmount();
	});

	it('uses an accent tray with no strong perimeter and only a selected ink boundary', async () => {
		const rootStyle = document.documentElement.style;
		const properties = ['--accent', '--card', '--ink'] as const;
		const previousProperties = properties.map((property) => ({
			property,
			value: rootStyle.getPropertyValue(property),
			priority: rootStyle.getPropertyPriority(property),
		}));
		rootStyle.setProperty('--accent', 'rgb(11, 22, 33)');
		rootStyle.setProperty('--card', 'rgb(44, 55, 66)');
		rootStyle.setProperty('--ink', 'rgb(77, 88, 99)');

		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange: vi.fn(),
		});

		try {
			const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
			const card = screen
				.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)
				.element() as HTMLElement;
			const list = screen
				.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`)
				.element() as HTMLElement;
			const groupStyle = getComputedStyle(group);
			const cardStyle = getComputedStyle(card);
			const listStyle = getComputedStyle(list);

			expect(groupStyle.backgroundColor).toBe('rgb(11, 22, 33)');
			expect(parseFloat(groupStyle.borderWidth)).toBe(0);
			expect(parseFloat(groupStyle.borderRadius)).toBeLessThanOrEqual(8);
			expect(groupStyle.boxShadow).not.toContain('rgb(77, 88, 99)');
			expect(groupStyle.boxShadow).not.toContain('inset');
			expect(parseFloat(groupStyle.paddingLeft)).toBe(0);
			expect(groupStyle.paddingLeft).toBe(groupStyle.paddingRight);
			expect(groupStyle.paddingTop).toBe(groupStyle.paddingBottom);
			expect(cardStyle.backgroundColor).toBe('rgb(44, 55, 66)');
			expect(listStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(cardStyle.boxShadow).toBe(listStyle.boxShadow);
			expect(parseFloat(cardStyle.borderWidth)).toBe(0);
			expect(parseFloat(listStyle.borderWidth)).toBe(0);
			const selectedSurface = card.querySelector('.elevation-surface') as HTMLElement;
			const selectedSurfaceStyle = getComputedStyle(selectedSurface);
			expect(parseFloat(selectedSurfaceStyle.borderWidth)).toBe(0);
			expect(selectedSurfaceStyle.outlineStyle).toBe('none');
			expect(selectedSurfaceStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(cardStyle.outlineStyle).toBe('solid');
			expect(listStyle.outlineStyle).not.toBe('solid');
			expect(card.querySelector('svg')!.getBoundingClientRect().y).toBeCloseTo(
				list.querySelector('svg')!.getBoundingClientRect().y,
				1,
			);

			await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

			expect(getComputedStyle(card).backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(getComputedStyle(list).backgroundColor).toBe('rgb(44, 55, 66)');
			expect(getComputedStyle(card).boxShadow).toBe(getComputedStyle(list).boxShadow);
		} finally {
			await screen.unmount();
			for (const { property, value, priority } of previousProperties) {
				rootStyle.setProperty(property, value, priority);
			}
		}
	});

	it('keeps the visible focus outline outside the shared tray boundary', async () => {
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
		const card = screen
			.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)
			.element() as HTMLElement;

		await userEvent.tab();
		await expect.element(screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)).toHaveFocus();
		expect(card.matches(':focus-visible')).toBe(true);
		expect(getComputedStyle(group).overflow).toBe('visible');
		expect(getComputedStyle(card).outlineStyle).toBe('solid');
		expect(parseFloat(getComputedStyle(card).outlineWidth)).toBeGreaterThan(0);
		expect(parseFloat(getComputedStyle(card).outlineOffset)).toBeGreaterThan(0);
		await screen.unmount();
	});
});
