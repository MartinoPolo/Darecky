import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WishlistSelectionToolbar from './WishlistSelectionToolbar.svelte';
import * as m from '$lib/paraglide/messages.js';

function createProps() {
	return {
		selectedCount: 2,
		hiddenCount: 1,
		visibleState: 'some' as const,
		priorityReady: true,
		categoryReady: true,
		priorityLevels: [{ id: 'high', label: 'Vysoká' }],
		categories: [{ id: 'sport', label: 'Sport' }],
		commonPriorityId: undefined,
		commonCategoryId: undefined,
		commonImageFit: undefined,
		commonImageBackground: undefined,
		commonReceived: undefined,
		onselectvisible: vi.fn(),
		onpriority: vi.fn(),
		oncategory: vi.fn(),
		onaction: vi.fn(),
		oncopy: vi.fn(),
		ondone: vi.fn(),
	};
}

describe('WishlistSelectionToolbar mobile bulk surface (#340)', () => {
	beforeEach(async () => page.viewport(390, 760));
	afterEach(async () => {
		document.body.style.minHeight = '';
		window.scrollTo(0, 0);
		await page.viewport(1280, 760);
	});

	it('places the sole global checkbox before the selection label without redundant text', async () => {
		for (const width of [320, 360, 390]) {
			await page.viewport(width, 760);
			const screen = await render(WishlistSelectionToolbar, createProps());
			const row = screen
				.getByRole('region', { name: m.gift_selection_toolbar() })
				.element()
				.querySelector('.mobile-selection-row') as HTMLElement;
			const checkbox = screen
				.getByRole('checkbox', { name: m.gift_selection_visible_all() })
				.element();
			const label = row.querySelector('.mobile-selection-label') as HTMLElement;
			expect(row.children[0]).toBe(checkbox);
			expect(row.children[1]).toBe(label);
			expect(label).toHaveTextContent(
				`${m.gift_selection_mode_label()} · ${m.gift_selection_count({ count: 2 })}`,
			);
			expect(row).not.toHaveTextContent(m.draft_grid_select_all());
			expect(row.querySelectorAll('[role="checkbox"]')).toHaveLength(1);
			for (const target of row.querySelectorAll<HTMLElement>(
				'button, [data-slot="checkbox"]',
			)) {
				expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
			}
			expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
			await screen.unmount();
		}
	});

	it('maps zero, partial, and all visible selections to unchecked, indeterminate, and checked', async () => {
		for (const [visibleState, ariaChecked] of [
			['none', 'false'],
			['some', 'mixed'],
			['all', 'true'],
		] as const) {
			const screen = await render(WishlistSelectionToolbar, {
				...createProps(),
				visibleState,
			});
			const checkbox = screen
				.getByRole('checkbox', { name: m.gift_selection_visible_all() })
				.element() as HTMLButtonElement;
			expect(checkbox).toHaveAttribute('aria-checked', ariaChecked);
			await screen.unmount();
		}
	});

	it('shows exactly six first-level actions without scrolling at 320px height', async () => {
		await page.viewport(320, 320);
		const screen = await render(WishlistSelectionToolbar, createProps());
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		const dialog = screen.getByRole('dialog', { name: m.gift_selection_actions() });
		await expect.element(dialog).toBeVisible();
		const style = getComputedStyle(dialog.element());
		expect(style.bottom).toBe('0px');
		expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderRightWidth)).toBeGreaterThan(0);
		const actions = screen.getByTestId('selection-bulk-sheet-actions').element();
		const rows = Array.from(
			actions.querySelectorAll<HTMLButtonElement>('[data-mobile-bulk-action]'),
		);
		expect(rows.map((row) => row.dataset.mobileBulkAction)).toEqual([
			'priority',
			'category',
			'imageFit',
			'imageBackground',
			'copy',
			'received',
		]);
		await expect
			.poll(() => Math.max(...rows.map((row) => row.getBoundingClientRect().bottom)))
			.toBeLessThanOrEqual(320);
		for (const row of rows) {
			expect(row.getBoundingClientRect().height).toBeCloseTo(40, 1);
		}
		expect(actions.scrollHeight).toBeLessThanOrEqual(actions.clientHeight);
		expect(getComputedStyle(actions).overflowY).not.toBe('auto');
		await screen.unmount();
	});

	it('drills into only one action, dispatches it, and restores row focus on Back', async () => {
		const props = {
			...createProps(),
			commonPriorityId: 'high',
			commonCategoryId: 'sport',
			commonImageFit: 'fit' as const,
			commonImageBackground: '#000000',
			commonReceived: true,
		};
		const screen = await render(WishlistSelectionToolbar, props);
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		const actions = screen.getByTestId('selection-bulk-sheet-actions');

		for (const [action, option, assertion] of [
			[
				'priority',
				m.gift_priority_none(),
				() => expect(props.onpriority).toHaveBeenCalledWith(null),
			],
			[
				'category',
				m.gift_category_uncategorized(),
				() => expect(props.oncategory).toHaveBeenCalledWith(null),
			],
			[
				'imageFit',
				m.image_fit_fill(),
				() =>
					expect(props.onaction).toHaveBeenCalledWith({
						action: 'imageFit',
						fit: 'fill',
					}),
			],
			[
				'imageBackground',
				m.image_background_transparent(),
				() =>
					expect(props.onaction).toHaveBeenCalledWith({
						action: 'imageBackground',
						background: null,
					}),
			],
			[
				'received',
				m.gift_mark_unreceived(),
				() =>
					expect(props.onaction).toHaveBeenCalledWith({
						action: 'received',
						received: false,
					}),
			],
		] as const) {
			const invokingRow = actions
				.element()
				.querySelector<HTMLButtonElement>(`[data-mobile-bulk-action="${action}"]`)!;
			await invokingRow.click();
			await expect
				.element(screen.getByRole('button', { name: m.gift_context_back() }))
				.toHaveFocus();
			expect(screen.getByTestId('selection-bulk-sheet-actions').query()).toBeNull();
			await screen.getByRole('radio', { name: option }).click();
			assertion();
			await screen.getByRole('button', { name: m.gift_context_back() }).click();
			await new Promise(requestAnimationFrame);
			await new Promise(requestAnimationFrame);
			expect(document.activeElement).toHaveAttribute('data-mobile-bulk-action', action);
		}

		const copyRow = actions
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="copy"]')!;
		await copyRow.click();
		await new Promise(requestAnimationFrame);
		expect(props.oncopy).toHaveBeenCalledOnce();
		const returnToActions = props.oncopy.mock.calls[0]?.[0] as () => void;
		returnToActions();
		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);
		expect(document.activeElement).toHaveAttribute('data-mobile-bulk-action', 'copy');
		await screen.unmount();
	});

	it('preserves loading, disabled, zero-selection, and pending behavior', async () => {
		const loading = await render(WishlistSelectionToolbar, {
			...createProps(),
			priorityReady: false,
			categoryReady: false,
		});
		await loading.getByRole('button', { name: m.gift_selection_actions() }).click();
		const loadingDialog = loading.getByRole('dialog', { name: m.gift_selection_actions() });
		expect(loadingDialog.element()).toHaveTextContent(m.moderator_loading());
		await expect
			.element(
				loadingDialog.getByRole('button', { name: new RegExp(m.gift_priority_label()) }),
			)
			.toBeDisabled();
		await expect
			.element(
				loadingDialog.getByRole('button', { name: new RegExp(m.gift_context_category()) }),
			)
			.toBeDisabled();
		await userEvent.keyboard('{Escape}');
		await loading.unmount();

		const empty = await render(WishlistSelectionToolbar, {
			...createProps(),
			selectedCount: 0,
			hiddenCount: 0,
			visibleState: 'none' as const,
		});
		await expect
			.element(empty.getByRole('button', { name: m.gift_selection_actions() }))
			.toBeDisabled();
		await expect.element(empty.getByRole('button', { name: m.cancel() })).toBeEnabled();
		await empty.unmount();

		const pending = await render(WishlistSelectionToolbar, {
			...createProps(),
			pending: { action: 'received' as const, count: 2 },
		});
		await expect
			.element(pending.getByRole('button', { name: m.gift_bulk_pending({ count: 2 }) }))
			.toBeDisabled();
		await expect.element(pending.getByRole('button', { name: m.cancel() })).toBeEnabled();
		await pending.unmount();
	});

	it('shows mixed summaries and unselected nested radios for every value action', async () => {
		const screen = await render(WishlistSelectionToolbar, createProps());
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		const sheet = screen.getByRole('dialog', { name: m.gift_selection_actions() });

		for (const action of ['priority', 'category', 'imageFit', 'imageBackground', 'received']) {
			const row = sheet
				.element()
				.querySelector<HTMLButtonElement>(`[data-mobile-bulk-action="${action}"]`)!;
			expect(row).toHaveTextContent(m.gift_selection_mixed());
			await row.click();
			expect(screen.getByTestId('selection-bulk-sheet-options').element()).toHaveTextContent(
				m.gift_selection_mixed(),
			);
			for (const radio of sheet
				.element()
				.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
				expect(radio.checked).toBe(false);
			}
			await sheet.getByRole('button', { name: m.gift_context_back() }).click();
		}
		await screen.unmount();
	});

	it('restores focus to a nested radio after its matching pending cycle settles', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		await screen
			.getByTestId('selection-bulk-sheet-actions')
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="imageFit"]')!
			.click();
		const radio = screen
			.getByRole('radio', { name: m.image_fit_fit() })
			.element() as HTMLInputElement;
		await radio.click();
		await screen.rerender({
			...props,
			pending: { action: 'imageFit' as const, count: 2 },
		});
		expect(radio).toBeDisabled();
		await screen.rerender({ ...props, commonImageFit: 'fit' as const, pending: null });
		await new Promise(requestAnimationFrame);
		expect(radio).toHaveFocus();
		await screen.unmount();
	});

	it('settles focus to the invoking row after Back and the trigger after Sheet dismissal', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);
		const trigger = screen
			.getByRole('button', { name: m.gift_selection_actions() })
			.element() as HTMLButtonElement;
		await trigger.click();
		await screen
			.getByTestId('selection-bulk-sheet-actions')
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="imageFit"]')!
			.click();
		await screen.getByRole('radio', { name: m.image_fit_fit() }).click();
		await screen.rerender({
			...props,
			pending: { action: 'imageFit' as const, count: 2 },
		});
		await new Promise(requestAnimationFrame);
		await screen.getByRole('button', { name: m.gift_context_back() }).click();
		const imageFitRow = screen
			.getByTestId('selection-bulk-sheet-actions')
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="imageFit"]')!;
		expect(imageFitRow).toBeDisabled();
		await screen.rerender({ ...props, commonImageFit: 'fit' as const, pending: null });
		await new Promise(requestAnimationFrame);
		expect(imageFitRow).toHaveFocus();

		await screen
			.getByTestId('selection-bulk-sheet-actions')
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="imageBackground"]')!
			.click();
		await screen.getByRole('radio', { name: m.image_background_black() }).click();
		await screen.rerender({
			...props,
			commonImageFit: 'fit' as const,
			pending: { action: 'imageBackground' as const, count: 2 },
		});
		await new Promise(requestAnimationFrame);
		await userEvent.keyboard('{Escape}');
		expect(trigger).toBeDisabled();
		await screen.rerender({
			...props,
			commonImageFit: 'fit' as const,
			commonImageBackground: '#000000',
			pending: null,
		});
		await new Promise(requestAnimationFrame);
		expect(trigger).toHaveFocus();
		await screen.unmount();
	});

	it('bounds genuine option overflow while keeping Back reachable', async () => {
		await page.viewport(320, 320);
		const screen = await render(WishlistSelectionToolbar, {
			...createProps(),
			categories: Array.from({ length: 12 }, (_, index) => ({
				id: `category-${index}`,
				label: `Kategorie ${index}`,
			})),
		});
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		await screen
			.getByTestId('selection-bulk-sheet-actions')
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="category"]')!
			.click();
		const options = screen.getByTestId('selection-bulk-sheet-options').element();
		expect(options.scrollHeight).toBeGreaterThan(options.clientHeight);
		expect(getComputedStyle(options).overflowY).toBe('auto');
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_back() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('restores focus and page scroll on Escape and dispatches select-all plus Cancel', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);
		const trigger = screen
			.getByRole('button', { name: m.gift_selection_actions() })
			.element() as HTMLButtonElement;
		document.body.style.minHeight = '200vh';
		window.scrollTo(0, 17);
		await new Promise(requestAnimationFrame);
		const scrollBefore = window.scrollY;
		await screen.getByRole('checkbox', { name: m.gift_selection_visible_all() }).click();
		expect(props.onselectvisible).toHaveBeenCalled();
		await trigger.click();
		await userEvent.keyboard('{Escape}');
		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);
		expect(document.activeElement).toBe(trigger);
		expect(window.scrollY).toBe(scrollBefore);
		await screen.getByRole('button', { name: m.cancel() }).click();
		expect(props.ondone).toHaveBeenCalledOnce();
		await screen.unmount();
		document.body.style.minHeight = '';
		window.scrollTo(0, 0);
	});
});

describe('WishlistSelectionToolbar consolidated desktop actions (#353)', () => {
	beforeEach(async () => page.viewport(1280, 760));

	it('disables the desktop Actions trigger for zero selection and pending work', async () => {
		const empty = await render(WishlistSelectionToolbar, {
			...createProps(),
			selectedCount: 0,
		});
		await expect.element(empty.getByTestId('desktop-selection-actions-trigger')).toBeDisabled();
		await empty.unmount();

		const pending = await render(WishlistSelectionToolbar, {
			...createProps(),
			pending: { action: 'received' as const, count: 2 },
		});
		await expect
			.element(pending.getByTestId('desktop-selection-actions-trigger'))
			.toBeDisabled();
		await pending.unmount();
	});

	it('closes an open desktop root when pending work starts', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);
		const trigger = screen.getByTestId('desktop-selection-actions-trigger');
		await trigger.click();
		const root = page.getByRole('menu', { name: m.gift_selection_actions() });
		await expect.element(root).toBeVisible();

		await screen.rerender({
			...props,
			pending: { action: 'received' as const, count: 2 },
		});

		await expect.element(root).not.toBeInTheDocument();
		await expect.element(trigger).toBeDisabled();
		await screen.unmount();
	});

	it('keeps the desktop root available while unready Priority and Category are disabled', async () => {
		const screen = await render(WishlistSelectionToolbar, {
			...createProps(),
			priorityReady: false,
			categoryReady: false,
		});
		const trigger = screen.getByTestId('desktop-selection-actions-trigger');
		await expect.element(trigger).toBeEnabled();
		await trigger.click();
		const root = page.getByRole('menu', { name: m.gift_selection_actions() });
		await expect.element(root).toBeVisible();
		await expect
			.element(root.getByRole('menuitem', { name: new RegExp(m.gift_priority_label()) }))
			.toBeDisabled();
		await expect
			.element(root.getByRole('menuitem', { name: new RegExp(m.gift_context_category()) }))
			.toBeDisabled();
		for (const label of [
			m.image_fit_label(),
			m.image_background_label(),
			m.gift_bulk_copy(),
			m.gift_selection_received_state(),
		]) {
			await expect
				.element(root.getByRole('menuitem', { name: new RegExp(label) }))
				.toBeEnabled();
		}
		await screen.unmount();
	});

	it('uses one Actions trigger with six persistent cascading categories and explicit copy choice', async () => {
		const props = {
			...createProps(),
			commonPriorityId: 'high',
			commonCategoryId: 'sport',
			commonImageFit: 'fit' as const,
			commonImageBackground: '#000000',
			commonReceived: true,
		};
		const screen = await render(WishlistSelectionToolbar, props);
		const summary = screen
			.getByRole('region', { name: m.gift_selection_toolbar() })
			.element()
			.querySelector('.desktop-selection-summary') as HTMLElement;
		expect(summary.children[0]).toHaveAttribute('role', 'checkbox');
		expect(summary.children[1]).toHaveClass('selection-count');
		expect(summary).not.toHaveTextContent(m.draft_grid_select_all());

		expect(
			screen
				.getByRole('region', { name: m.gift_selection_toolbar() })
				.element()
				.querySelectorAll('[data-testid="desktop-selection-actions-trigger"]'),
		).toHaveLength(1);
		const trigger = screen.getByTestId('desktop-selection-actions-trigger');
		await expect.element(trigger).toHaveTextContent(m.gift_selection_actions());
		await trigger.click();

		const root = page.getByRole('menu', { name: m.gift_selection_actions() });
		await expect.element(root).toBeVisible();
		for (const label of [
			m.gift_priority_label(),
			m.gift_context_category(),
			m.image_fit_label(),
			m.image_background_label(),
			m.gift_bulk_copy(),
			m.gift_selection_received_state(),
		]) {
			await expect
				.element(root.getByRole('menuitem', { name: new RegExp(label) }))
				.toBeVisible();
		}

		await root.getByRole('menuitem', { name: new RegExp(m.gift_priority_label()) }).click();
		await page.getByRole('menuitemradio', { name: m.gift_priority_none() }).click();
		expect(props.onpriority).toHaveBeenCalledExactlyOnceWith(null);
		await expect.element(root).toBeVisible();

		const priority = root.getByRole('menuitem', {
			name: new RegExp(m.gift_priority_label()),
		});
		priority.element().focus();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(root).toBeVisible();
		await expect
			.element(page.getByRole('menuitemradio', { name: m.gift_priority_none() }))
			.toBeVisible();
		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(priority).toHaveFocus();
		await userEvent.keyboard('{Escape}');
		await expect.element(trigger).toHaveFocus();
		await trigger.click();

		const copy = root.getByRole('menuitem', { name: new RegExp(m.gift_bulk_copy()) });
		await copy.click();
		await page.getByRole('menuitem', { name: m.gift_bulk_copy_choose() }).click();
		expect(props.oncopy).toHaveBeenCalledOnce();
		await expect.element(screen.getByRole('button', { name: m.done() })).toBeVisible();
		await screen.unmount();
	});
});
