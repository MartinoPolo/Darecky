import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WishlistSelectionToolbar from './WishlistSelectionToolbar.svelte';
import * as m from '$lib/paraglide/messages.js';

function createProps() {
	return {
		selectedCount: 2,
		hiddenCount: 1,
		visibleState: 'some' as const,
		priorityReady: true,
		categoryReady: true,
		priorityLevels: [{ id: 'high', label: 'Vysok�' }],
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
		expect(summary).toHaveTextContent(m.gift_selection_count({ count: 2 }));
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
