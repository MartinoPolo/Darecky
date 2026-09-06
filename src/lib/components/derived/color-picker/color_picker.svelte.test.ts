import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import ColorPicker from './ColorPicker.svelte';

const label = 'Sport color';

function nativeFallback(): HTMLInputElement {
	return document.querySelector<HTMLInputElement>('input[type="color"]')!;
}

describe('ColorPicker', () => {
	it('renders only a styled rounded-square trigger while closed', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const trigger = screen.getByRole('button', { name: label });

		await expect.element(trigger).toBeVisible();
		expect(trigger.element().className).toContain('rounded-btn');
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(3, 105, 161)');
		expect(nativeFallback().className).toContain('sr-only');
		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
	});

	it('opens from the keyboard and Escape closes and restores trigger focus', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const trigger = screen.getByRole('button', { name: label });
		trigger.element().focus();

		await userEvent.keyboard('{Enter}');
		await expect.element(page.getByRole('dialog', { name: label })).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
		expect(document.activeElement).toBe(trigger.element());
	});

	it('can be reached with Tab and opened with Space', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const trigger = screen.getByRole('button', { name: label });

		await userEvent.tab();
		expect(document.activeElement).toBe(trigger.element());
		await userEvent.keyboard(' ');
		await expect.element(page.getByRole('dialog', { name: label })).toBeVisible();
	});

	it('does not open while disabled', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label, disabled: true });
		const trigger = screen.getByRole('button', { name: label });

		await expect.element(trigger).toBeDisabled();
		await trigger.click({ force: true });
		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
	});

	it('stages presets locally and commits once only after Save', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#000000', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: label });
		const group = dialog.getByRole('group', { name: m.color_picker_presets() });
		const swatches = Array.from(group.element().querySelectorAll('button'));
		const black = group.getByRole('button', { name: '#000000' });
		const white = group.getByRole('button', { name: '#FFFFFF' });
		const save = dialog.getByRole('button', { name: m.save() });

		expect(swatches).toHaveLength(20);
		expect(swatches.every((swatch) => swatch.tabIndex === 0 && !swatch.disabled)).toBe(true);
		await expect.element(black).toHaveAttribute('aria-pressed', 'true');
		await expect.element(save).toBeDisabled();

		white.element().focus();
		expect(document.activeElement).toBe(white.element());
		await white.click();
		await expect.element(white).toHaveAttribute('aria-pressed', 'true');
		await expect.element(black).toHaveAttribute('aria-pressed', 'false');
		await expect.element(save).toBeEnabled();
		expect(onValueChange).not.toHaveBeenCalled();
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(0, 0, 0)');

		await save.click();
		expect(onValueChange).toHaveBeenCalledOnce();
		expect(onValueChange).toHaveBeenCalledWith('#FFFFFF');
		await expect.element(dialog).not.toBeInTheDocument();
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(255, 255, 255)');
		expect(document.activeElement).toBe(trigger.element());
	});

	it('treats restoring the opening color with different casing as unchanged', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#aabbcc', label, onValueChange });
		await screen.getByRole('button', { name: label }).click();
		const dialog = page.getByRole('dialog', { name: label });
		const hex = dialog.getByRole('textbox', { name: m.color_picker_hex_label() });
		const save = dialog.getByRole('button', { name: m.save() });

		await hex.fill('#FFFFFF');
		await expect.element(save).toBeEnabled();
		await hex.fill('#AABBCC');
		await expect.element(save).toBeDisabled();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('closes without changing value when disabled while open', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		await trigger.click();
		await expect.element(page.getByRole('dialog', { name: label })).toBeVisible();

		await screen.rerender({ value: '#0369A1', label, disabled: true, onValueChange });

		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
		await expect.element(trigger).toBeDisabled();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('shows localized validation and only enables Save for a valid changed hex draft', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: label });
		const hex = dialog.getByRole('textbox', { name: m.color_picker_hex_label() });
		const save = dialog.getByRole('button', { name: m.save() });

		await hex.fill('#12');
		await expect.element(hex).toHaveAttribute('aria-invalid', 'true');
		await expect.element(dialog.getByText(m.color_picker_hex_invalid())).toBeVisible();
		await expect.element(save).toBeDisabled();
		expect(onValueChange).not.toHaveBeenCalled();
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(3, 105, 161)');

		await hex.fill('#AABBCC');
		await expect.element(hex).not.toHaveAttribute('aria-invalid', 'true');
		await expect.element(save).toBeEnabled();
		await save.click();
		expect(onValueChange).toHaveBeenCalledOnce();
		expect(onValueChange).toHaveBeenCalledWith('#AABBCC');
	});

	it.each(['Cancel', 'Escape', 'outside dismissal'])(
		'discards the draft on %s',
		async (dismissal) => {
			const onValueChange = vi.fn();
			const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
			const trigger = screen.getByRole('button', { name: label });
			await trigger.click();
			const dialog = page.getByRole('dialog', { name: label });
			await dialog.getByRole('button', { name: '#B91C1C' }).click();

			if (dismissal === 'Cancel') {
				await dialog.getByRole('button', { name: m.cancel() }).click();
			} else if (dismissal === 'Escape') {
				await userEvent.keyboard('{Escape}');
			} else {
				await userEvent.click(document.body);
			}

			await expect.element(dialog).not.toBeInTheDocument();
			expect(onValueChange).not.toHaveBeenCalled();
			expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(3, 105, 161)');
			expect(document.activeElement).toBe(trigger.element());

			await trigger.click();
			await expect
				.element(page.getByRole('textbox', { name: m.color_picker_hex_label() }))
				.toHaveValue('#0369A1');
		},
	);

	it('opens the native fallback from the visible translated action', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const fallbackClick = vi.spyOn(nativeFallback(), 'click');
		await screen.getByRole('button', { name: label }).click();
		const dialog = page.getByRole('dialog', { name: label });

		await dialog.getByRole('button', { name: m.color_picker_native_action() }).click();

		expect(fallbackClick).toHaveBeenCalledOnce();
	});

	it('stages native input while open and ignores stale events while closed or disabled', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		const fallback = nativeFallback();

		fallback.value = '#7c3aed';
		fallback.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onValueChange).not.toHaveBeenCalled();

		await trigger.click();
		fallback.value = '#7c3aed';
		fallback.dispatchEvent(new Event('input', { bubbles: true }));
		const dialog = page.getByRole('dialog', { name: label });
		await expect
			.element(dialog.getByRole('textbox', { name: m.color_picker_hex_label() }))
			.toHaveValue('#7c3aed');
		expect(onValueChange).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: m.save() }).click();
		expect(onValueChange).toHaveBeenCalledOnce();
		expect(onValueChange).toHaveBeenCalledWith('#7c3aed');

		await trigger.click();
		await screen.rerender({ value: '#7c3aed', label, disabled: true, onValueChange });
		fallback.value = '#ffffff';
		fallback.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onValueChange).toHaveBeenCalledOnce();
	});
});
