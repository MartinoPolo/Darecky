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

	it('keeps all six first-level actions in the shared sheet with 48px touch rows', async () => {
		await page.viewport(320, 320);
		const screen = await render(WishlistSelectionToolbar, createProps());
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		const dialog = screen.getByRole('dialog', { name: m.gift_selection_actions() });
		await expect.element(dialog).toBeVisible();
		const shell = dialog.element();
		const shellRect = shell.getBoundingClientRect();
		const style = getComputedStyle(shell);
		expect(style.bottom).toBe('0px');
		expect(parseFloat(style.maxHeight)).toBeCloseTo(window.innerHeight * 0.8, 1);
		expect(shellRect.left).toBeCloseTo(window.innerWidth - shellRect.right, 1);
		expect(shellRect.left).toBeGreaterThan(0);
		expect(style.borderLeftWidth).toBe(style.borderRightWidth);
		expect(style.borderLeftWidth).toBe(style.borderTopWidth);
		expect(style.borderTopLeftRadius).toBe(style.borderTopRightRadius);
		expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
		const header = shell.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
		const headerStyle = getComputedStyle(header);
		expect(header.getBoundingClientRect().width).toBeCloseTo(
			shellRect.width -
				parseFloat(style.borderLeftWidth) -
				parseFloat(style.borderRightWidth),
			1,
		);
		expect(headerStyle.paddingLeft).toBe('16px');
		expect(headerStyle.paddingRight).toBe('56px');
		expect(headerStyle.paddingTop).toBe('12px');
		expect(headerStyle.paddingBottom).toBe('12px');
		expect(parseFloat(headerStyle.borderBottomWidth)).toBeCloseTo(1, 1);
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
		const bodyStyle = getComputedStyle(actions.parentElement!);
		expect(bodyStyle.paddingLeft).toBe('8px');
		expect(bodyStyle.paddingRight).toBe('8px');
		expect(bodyStyle.paddingTop).toBe('8px');
		expect(bodyStyle.paddingBottom).toBe('8px');
		for (const row of rows) {
			expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
			expect(row.textContent?.trim()).not.toBe('');
		}
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

		for (const [action, focusedOption, option, assertion] of [
			[
				'priority',
				'Vysoká',
				m.gift_priority_none(),
				() => expect(props.onpriority).toHaveBeenCalledWith(null),
			],
			[
				'category',
				'Sport',
				m.gift_category_uncategorized(),
				() => expect(props.oncategory).toHaveBeenCalledWith(null),
			],
			[
				'imageFit',
				m.image_fit_fit(),
				m.image_fit_fill(),
				() =>
					expect(props.onaction).toHaveBeenCalledWith({
						action: 'imageFit',
						fit: 'fill',
					}),
			],
			[
				'imageBackground',
				m.image_background_black(),
				m.image_background_transparent(),
				() =>
					expect(props.onaction).toHaveBeenCalledWith({
						action: 'imageBackground',
						background: null,
					}),
			],
			[
				'received',
				m.gift_mark_received(),
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
			await userEvent.keyboard('{Tab}');
			await expect.element(screen.getByRole('radio', { name: focusedOption })).toHaveFocus();
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

	it('uses named library radio groups with arrow-key selection', async () => {
		const props = { ...createProps(), commonPriorityId: 'high' };
		const screen = await render(WishlistSelectionToolbar, props);
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		await screen
			.getByTestId('selection-bulk-sheet-actions')
			.element()
			.querySelector<HTMLButtonElement>('[data-mobile-bulk-action="priority"]')!
			.click();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_back() }))
			.toHaveFocus();
		const group = screen.getByRole('radiogroup', { name: m.gift_priority_label() });
		const selected = group.getByRole('radio', { name: 'Vysoká' });
		await userEvent.keyboard('{Tab}');
		await expect.element(selected).toHaveFocus();
		await userEvent.keyboard('{ArrowUp}');
		expect(props.onpriority).toHaveBeenCalledWith(null);
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
			const radios = sheet.element().querySelectorAll<HTMLElement>('[role="radio"]');
			expect(radios.length).toBeGreaterThan(0);
			for (const radio of radios) {
				expect(radio).toHaveAttribute('aria-checked', 'false');
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
			.element() as HTMLButtonElement;
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
		const scrollBody = options.parentElement!;
		const firstRadio = options.querySelector<HTMLElement>('[role="radio"]')!;
		const firstChoice = firstRadio.closest('label');
		expect(firstChoice).not.toBeNull();
		expect(firstChoice).toHaveAttribute('for', firstRadio.id);
		expect(getComputedStyle(firstChoice!).minHeight).toBe('48px');
		expect(scrollBody.scrollHeight).toBeGreaterThan(scrollBody.clientHeight);
		expect(getComputedStyle(scrollBody).overflowY).toBe('auto');
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
