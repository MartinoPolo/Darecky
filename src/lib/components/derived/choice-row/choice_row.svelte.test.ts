import '../../../../app.css';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import ChoiceRowTestHarness from './ChoiceRowTestHarness.svelte';

describe('ChoiceRow', () => {
	it('keeps a compact label on one line and grows when the label wraps', async () => {
		const screen = render(ChoiceRowTestHarness, {
			selected: true,
			onSelect: vi.fn(),
			label: 'Selected choice',
			width: '176px',
			withLeading: true,
		});
		const button = screen.getByRole('button', { name: 'Selected choice' });
		await expect.element(button).toBeVisible();
		const compactRect = button.element().getBoundingClientRect();
		expect(compactRect.width).toBeCloseTo(176, 0);
		expect(compactRect.height).toBeLessThan(40);
		await expect.element(screen.getByTestId('leading')).toBeVisible();

		await screen.rerender({
			selected: false,
			onSelect: vi.fn(),
			label: 'A compact choice with a long wrapping label',
			width: '144px',
			withLeading: true,
		});
		const wrapped = screen.getByRole('button', {
			name: 'A compact choice with a long wrapping label',
		});
		const wrappedRect = wrapped.element().getBoundingClientRect();
		expect(wrappedRect.width).toBeCloseTo(144, 0);
		expect(wrappedRect.height).toBeGreaterThan(compactRect.height);
	});

	it('keeps the focused element mounted through selection and reselection', async () => {
		const onSelect = vi.fn();
		const screen = render(ChoiceRowTestHarness, {
			selected: false,
			onSelect,
			label: 'Available option',
		});
		const button = screen.getByRole('button', { name: 'Available option' });
		const originalElement = button.element();

		originalElement.focus();
		await button.click();
		expect(button.element()).toBe(originalElement);
		expect(document.activeElement).toBe(originalElement);
		expect(onSelect).toHaveBeenCalledOnce();

		await screen.rerender({ selected: true, onSelect, label: 'Available option' });
		expect(button.element()).toBe(originalElement);
		expect(document.activeElement).toBe(originalElement);
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');

		await button.click();
		expect(button.element()).toBe(originalElement);
		expect(document.activeElement).toBe(originalElement);
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it('derives pressed state exclusively from the selected prop', async () => {
		const onSelect = vi.fn();
		const screen = render(ChoiceRowTestHarness, {
			selected: false,
			onSelect,
			label: 'Controlled option',
		});
		const button = screen.getByRole('button', { name: 'Controlled option' });

		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveAttribute('data-state', 'off');
		await button.click();
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveAttribute('data-state', 'off');

		await screen.rerender({ selected: true, onSelect, label: 'Controlled option' });
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect.element(button).toHaveAttribute('data-state', 'on');
	});

	it('selects an available choice with the keyboard', async () => {
		const onSelect = vi.fn();
		const screen = render(ChoiceRowTestHarness, {
			selected: false,
			onSelect,
			label: 'Available option',
		});
		const button = screen.getByRole('button', { name: 'Available option' });

		button.element().focus();
		await userEvent.keyboard(' ');
		expect(onSelect).toHaveBeenCalledOnce();
	});

	it('is inert to pointer and keyboard activation while disabled', async () => {
		const onSelect = vi.fn();
		const screen = render(ChoiceRowTestHarness, {
			selected: false,
			disabled: true,
			onSelect,
			label: 'Busy option',
		});

		const button = screen.getByRole('button', { name: 'Busy option' });
		await expect.element(button).toBeDisabled();
		const disabledButton = button.element();
		expect(disabledButton).toBeInstanceOf(HTMLButtonElement);
		(disabledButton as HTMLButtonElement).click();
		(disabledButton as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter} ');
		expect(onSelect).not.toHaveBeenCalled();
	});
});
