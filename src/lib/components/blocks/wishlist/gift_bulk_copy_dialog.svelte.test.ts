import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GiftBulkCopyDialog from './GiftBulkCopyDialog.svelte';
import * as m from '$lib/paraglide/messages.js';

const destinations = [
	{
		id: 'destination',
		title: 'Narozeniny',
		status: 'active' as const,
		recipientDisplayName: 'Jana',
	},
];

function props() {
	return {
		open: true,
		destinations,
		selectedDestinationId: '',
		selectedCount: 2,
		onopenchange: vi.fn(),
		ondestinationchange: vi.fn(),
		onconfirm: vi.fn(),
	};
}

afterEach(async () => page.viewport(1280, 760));

describe('GiftBulkCopyDialog', () => {
	it('uses a desktop confirmation dialog and requires a destination', async () => {
		await page.viewport(1280, 760);
		const handlers = props();
		const screen = await render(GiftBulkCopyDialog, handlers);
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect.element(dialog).toBeVisible();
		await expect
			.element(dialog.getByRole('button', { name: m.gift_bulk_copy_confirm() }))
			.toBeDisabled();
		await dialog.getByLabelText(m.gift_bulk_copy_destination()).selectOptions('destination');
		expect(handlers.ondestinationchange).toHaveBeenCalledWith('destination');
		await screen.unmount();
	});

	it('restores confirm focus when a recoverable submission settles with the dialog open', async () => {
		await page.viewport(1280, 760);
		const handlers = { ...props(), selectedDestinationId: 'destination' };
		const screen = await render(GiftBulkCopyDialog, handlers);
		const confirm = screen
			.getByRole('button', { name: m.gift_bulk_copy_confirm() })
			.element() as HTMLButtonElement;
		confirm.focus();
		await screen.rerender({ ...handlers, submitting: true });
		expect(confirm).toBeDisabled();
		await screen.rerender({ ...handlers, submitting: false, open: true });
		await new Promise(requestAnimationFrame);
		expect(confirm).toHaveFocus();
		await screen.unmount();
	});

	it('reuses the bounded wishlist bottom sheet and exposes nested Back on narrow screens', async () => {
		await page.viewport(390, 760);
		const onback = vi.fn();
		const screen = await render(GiftBulkCopyDialog, {
			...props(),
			selectedDestinationId: 'destination',
			onback,
		});
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect.element(dialog).toBeVisible();
		const shell = dialog.element();
		const shellRect = shell.getBoundingClientRect();
		const shellStyle = getComputedStyle(shell);
		expect(shellStyle.bottom).toBe('0px');
		expect(parseFloat(shellStyle.maxHeight)).toBeCloseTo(window.innerHeight * 0.8, 1);
		expect(shellRect.left).toBeCloseTo(window.innerWidth - shellRect.right, 1);
		expect(shellRect.left).toBeGreaterThan(0);
		expect(shellStyle.borderLeftWidth).toBe(shellStyle.borderRightWidth);
		expect(shellStyle.borderLeftWidth).toBe(shellStyle.borderTopWidth);
		expect(shellStyle.borderTopLeftRadius).toBe(shellStyle.borderTopRightRadius);
		expect(parseFloat(shellStyle.borderTopLeftRadius)).toBeGreaterThan(0);
		const header = shell.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
		const headerStyle = getComputedStyle(header);
		expect(header.getBoundingClientRect().width).toBeCloseTo(
			shellRect.width -
				parseFloat(shellStyle.borderLeftWidth) -
				parseFloat(shellStyle.borderRightWidth),
			1,
		);
		expect(headerStyle.paddingLeft).toBe('16px');
		expect(headerStyle.paddingRight).toBe('56px');
		expect(headerStyle.paddingTop).toBe('12px');
		expect(headerStyle.paddingBottom).toBe('12px');
		expect(parseFloat(headerStyle.borderBottomWidth)).toBeCloseTo(1, 1);
		const body = header.nextElementSibling as HTMLElement;
		const bodyStyle = getComputedStyle(body);
		expect(bodyStyle.paddingLeft).toBe('8px');
		expect(bodyStyle.paddingRight).toBe('8px');
		expect(bodyStyle.paddingTop).toBe('8px');
		expect(bodyStyle.paddingBottom).toBe('8px');
		await dialog.getByRole('button', { name: m.gift_context_back() }).click();
		expect(onback).toHaveBeenCalledOnce();
		await screen.unmount();
	});
});
