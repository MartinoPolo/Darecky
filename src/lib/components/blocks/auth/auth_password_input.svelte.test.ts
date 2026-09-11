import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import AuthPasswordInput from './AuthPasswordInput.svelte';

describe('AuthPasswordInput reveal control', () => {
	it('is keyboard-focusable and toggles the input type, label, and pressed state', async () => {
		const screen = await render(AuthPasswordInput, { fieldId: 'password', value: 'secret' });
		const input = document.querySelector('#password') as HTMLInputElement;
		const reveal = screen.getByRole('button', { name: m.show_password() });

		expect(reveal.element().tabIndex).toBe(0);
		await expect.element(reveal).toHaveAttribute('aria-pressed', 'false');
		await reveal.click();
		expect(input.type).toBe('text');
		await expect
			.element(screen.getByRole('button', { name: m.hide_password() }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('does not toggle while disabled and preserves field error wiring and binding', async () => {
		const onblur = vi.fn();
		const screen = await render(AuthPasswordInput, {
			fieldId: 'password',
			value: 'secret',
			disabled: true,
			hasError: true,
			errorDescribedById: 'password-error',
			onblur,
		});
		const input = document.querySelector('#password') as HTMLInputElement;
		const reveal = screen.getByRole('button', { name: m.show_password() });

		await expect.element(reveal).toBeDisabled();
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		await expect.element(input).toHaveAttribute('aria-describedby', 'password-error');
		const revealButton = reveal.element();
		expect(revealButton).toBeInstanceOf(HTMLButtonElement);
		(revealButton as HTMLButtonElement).click();
		expect(input.type).toBe('password');
		expect(input.value).toBe('secret');
	});
});
