import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GiftContextActions from './GiftContextActions.svelte';
import GiftContextActionsTestHost from './GiftContextActionsTestHost.svelte';
import * as m from '$lib/paraglide/messages.js';

const managerProps = {
	open: true,
	mobile: true,
	name: 'Kolo',
	role: 'recipient' as const,
	primaryUrl: 'https://example.com/kolo',
	readOnly: false,
	received: false,
	priorityLevels: [{ id: 'high', label: 'Vysoká' }],
	categories: [{ id: 'sport', label: 'Sport' }],
	priorityReady: true,
	categoryReady: true,
	priorityLevelId: 'high',
	categoryId: null,
	onclose: vi.fn(),
	onedit: vi.fn(),
	onpriority: vi.fn(),
	oncategory: vi.fn(),
	onreceived: vi.fn(),
	onselect: vi.fn(),
};

describe('GiftContextActions desktop ContextMenu', () => {
	it('uses menu roles and nested submenus for configured manager choices', async () => {
		managerProps.onpriority.mockReset();
		managerProps.oncategory.mockReset();
		const screen = await render(GiftContextActionsTestHost, { ...managerProps, mobile: false });
		await expect.element(screen.getByRole('menu')).toBeInTheDocument();
		const priorityTrigger = screen.getByRole('menuitem', { name: m.gift_priority_label() });
		await expect.element(priorityTrigger).toBeInTheDocument();
		await expect
			.element(screen.getByRole('menuitem', { name: m.gift_context_category() }))
			.toBeInTheDocument();
		await priorityTrigger.click();
		const highPriorityOption = screen.getByRole('menuitemradio', { name: 'Vysoká' });
		await expect.element(highPriorityOption).toBeInTheDocument();
		await highPriorityOption.click();
		expect(managerProps.onpriority).toHaveBeenCalledWith('high');
		await screen.unmount();
	});
});

describe('GiftContextActions mobile Sheet', () => {
	afterEach(async () => page.viewport(1280, 720));

	it('uses the inset rounded action-sheet shell with shared header, body, rows, and icon column', async () => {
		await page.viewport(390, 720);
		const screen = await render(GiftContextActions, managerProps);
		const dialog = screen.getByRole('dialog', { name: 'Kolo' }).element() as HTMLElement;
		const dialogRect = dialog.getBoundingClientRect();
		const dialogStyle = getComputedStyle(dialog);

		expect(dialogRect.left).toBeCloseTo(window.innerWidth - dialogRect.right, 1);
		expect(dialogRect.left).toBeGreaterThan(0);
		expect(parseFloat(dialogStyle.borderLeftWidth)).toBeGreaterThan(0);
		expect(dialogStyle.borderLeftWidth).toBe(dialogStyle.borderRightWidth);
		expect(dialogStyle.borderLeftWidth).toBe(dialogStyle.borderTopWidth);
		expect(dialogStyle.borderTopLeftRadius).toBe(dialogStyle.borderTopRightRadius);
		expect(parseFloat(dialogStyle.borderTopLeftRadius)).toBeGreaterThan(0);

		const header = dialog.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
		const headerStyle = getComputedStyle(header);
		expect(header.getBoundingClientRect().width).toBeCloseTo(
			dialogRect.width -
				parseFloat(dialogStyle.borderLeftWidth) -
				parseFloat(dialogStyle.borderRightWidth),
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

		const iconRow = screen.getByRole('button', { name: m.gift_context_edit() }).element();
		const textOnlyRow = screen.getByRole('button', { name: m.gift_priority_label() }).element();
		for (const row of [iconRow, textOnlyRow]) {
			expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
			const surface = row.querySelector<HTMLElement>(':scope > .elevation-surface')!;
			expect(surface).toBeTruthy();
			expect(getComputedStyle(surface).justifyContent).toBe('flex-start');
		}
		const iconText = Array.from(
			iconRow.querySelector(':scope > .elevation-surface')!.childNodes,
		).find(
			(node) =>
				node.nodeType === Node.TEXT_NODE &&
				node.textContent !== null &&
				node.textContent.trim() !== '',
		) as Text;
		const textOnlyText = Array.from(
			textOnlyRow.querySelector(':scope > .elevation-surface')!.childNodes,
		).find(
			(node) =>
				node.nodeType === Node.TEXT_NODE &&
				node.textContent !== null &&
				node.textContent.trim() !== '',
		) as Text;
		const textLeft = (node: Text) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return range.getBoundingClientRect().left;
		};
		expect(textLeft(textOnlyText)).toBeCloseTo(textLeft(iconText), 1);
		await screen.unmount();
	});

	it('drills into configured priorities and provides Back without exposing like/reserve actions', async () => {
		const screen = await render(GiftContextActions, managerProps);
		await screen.getByRole('button', { name: m.gift_priority_label() }).click();
		await expect
			.element(screen.getByRole('heading', { name: m.gift_priority_label() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: new RegExp('Vysoká') }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_back() }))
			.toBeInTheDocument();
		await expect.element(screen.getByText(/rezerv/i)).not.toBeInTheDocument();
		await expect.element(screen.getByText(/líb/i)).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('shows loading-labeled manager controls as disabled until choices are ready', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			priorityReady: false,
			categoryReady: false,
		});
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_priority_label()}: ${m.moderator_loading()}`,
				}),
			)
			.toBeDisabled();
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_context_category()}: ${m.moderator_loading()}`,
				}),
			)
			.toBeDisabled();
		await screen.unmount();
	});

	it('limits visitors to link actions', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
		});
		await expect
			.element(screen.getByRole('link', { name: m.gift_context_open_link() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_copy_link() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_context_edit() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('renders derived reservation and Purchased actions and dispatches their callbacks', async () => {
		const oncancelreservation = vi.fn();
		const onpurchased = vi.fn();
		const screen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			oncancelreservation,
			onpurchased,
		});

		await screen.getByRole('button', { name: m.reserve_button_cancel() }).click();
		expect(oncancelreservation).toHaveBeenCalledOnce();
		await screen.unmount();

		const purchasedScreen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			oncancelreservation,
			onpurchased,
		});
		await purchasedScreen.getByRole('button', { name: m.gift_mark_bought() }).click();
		expect(onpurchased).toHaveBeenCalledOnce();
		await purchasedScreen.unmount();
	});

	it('keeps archived reservation context to own cancellation only', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			role: 'visitor' as const,
			readOnly: true,
			canReserve: true,
			ownsReservation: true,
			canTrackPurchased: true,
			oncancelreservation: vi.fn(),
			onpurchased: vi.fn(),
		});
		await expect
			.element(screen.getByRole('button', { name: m.reserve_button_cancel() }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_mark_bought() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('normalizes a scheme-less primary URL in the mobile external link', async () => {
		const screen = await render(GiftContextActions, {
			...managerProps,
			primaryUrl: 'alza.cz/product',
		});
		const link = screen.getByRole('link', { name: m.gift_context_open_link() });
		await expect.element(link).toHaveAttribute('href', 'https://alza.cz/product');
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', expect.stringContaining('external'));
		await expect.element(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
		await expect.element(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
		await screen.unmount();
	});
});
