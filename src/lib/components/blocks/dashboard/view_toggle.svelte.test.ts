import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import ViewToggle from './ViewToggle.svelte';
import ViewToggleTestHarness from './ViewToggleTestHarness.svelte';

describe('ViewToggle toggle selection (fixes: re-click deselects both items)', () => {
	it('updates the parent-owned bound mode', async () => {
		const screen = await render(ViewToggleTestHarness);

		await screen.getByRole('radio', { name: m.dashboard_view_list() }).click();

		await expect.element(screen.getByTestId('parent-view-mode')).toHaveTextContent('list');
		await screen.unmount();
	});

	it('switches mode when clicking the inactive item', async () => {
		const screen = await render(ViewToggle, { value: 'grid' });

		await screen.getByRole('radio', { name: m.dashboard_view_list() }).click();

		await expect
			.element(screen.getByRole('radio', { name: m.dashboard_view_list() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('radio', { name: m.dashboard_view_grid() }))
			.toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('keeps the active item checked when re-clicking it', async () => {
		const screen = await render(ViewToggle, { value: 'grid' });

		const activeItem = screen.getByRole('radio', { name: m.dashboard_view_grid() });
		await activeItem.click();

		await expect.element(activeItem).toHaveAttribute('data-state', 'on');
		await expect.element(activeItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('always has exactly one checked item after re-clicking the active item', async () => {
		const screen = await render(ViewToggle, { value: 'list' });

		await screen.getByRole('radio', { name: m.dashboard_view_list() }).click();

		const gridItem = screen.getByRole('radio', { name: m.dashboard_view_grid() });
		const listItem = screen.getByRole('radio', { name: m.dashboard_view_list() });
		await expect.element(gridItem).toHaveAttribute('aria-checked', 'false');
		await expect.element(listItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});
});
