import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
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
		const destinationTrigger = dialog.getByLabelText(m.gift_bulk_copy_destination());
		await expect.element(destinationTrigger).toHaveAttribute('id', 'bulk-copy-destination');
		await vi.waitFor(() => {
			expect(destinationTrigger.element().getBoundingClientRect().height).toBeCloseTo(38, 0);
		});
		const desktopTriggerWidth = destinationTrigger.element().getBoundingClientRect().width;
		const desktopConfirmWidth = dialog
			.getByRole('button', { name: m.gift_bulk_copy_confirm() })
			.element()
			.getBoundingClientRect().width;
		expect(desktopConfirmWidth).toBeLessThan(desktopTriggerWidth);
		await destinationTrigger.click();
		await screen.getByRole('option', { name: 'Narozeniny · Jana' }).click();
		expect(handlers.ondestinationchange).toHaveBeenCalledWith('destination');
		await screen.unmount();
	});

	it('supports keyboard selection and Escape without dismissing the parent dialog', async () => {
		await page.viewport(1280, 760);
		const handlers = props();
		const screen = await render(GiftBulkCopyDialog, handlers);
		const trigger = screen.getByTestId('bulk-copy-destination');
		await trigger.click();
		await userEvent.keyboard('{ArrowDown}{Enter}');
		expect(handlers.ondestinationchange).toHaveBeenCalledWith('destination');

		await trigger.click();
		await userEvent.keyboard('{Escape}');
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_bulk_copy_title() }))
			.toBeVisible();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
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
		const triggerRect = dialog
			.getByTestId('bulk-copy-destination')
			.element()
			.getBoundingClientRect();
		const backButton = dialog.getByRole('button', { name: m.gift_context_back() });
		const backRect = backButton.element().getBoundingClientRect();
		const confirmRect = dialog
			.getByRole('button', { name: m.gift_bulk_copy_confirm() })
			.element()
			.getBoundingClientRect();
		expect(backRect.width).toBeCloseTo(triggerRect.width, 1);
		expect(confirmRect.width).toBeCloseTo(triggerRect.width, 1);
		expect(backRect.left).toBeCloseTo(triggerRect.left, 1);
		expect(confirmRect.left).toBeCloseTo(triggerRect.left, 1);
		await backButton.click();
		expect(onback).toHaveBeenCalledOnce();
		await screen.unmount();
	});
});
