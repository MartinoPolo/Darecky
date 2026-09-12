import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const { changePasswordMock } = vi.hoisted(() => ({ changePasswordMock: vi.fn() }));
vi.mock('$lib/auth_client.js', () => ({
	authClient: { changePassword: changePasswordMock },
}));

const { default: SettingsSecuritySection } = await import('./SettingsSecuritySection.svelte');

describe('SettingsSecuritySection password controls', () => {
	it('reveals the confirm password and associates mismatch feedback with that field', async () => {
		const screen = await render(SettingsSecuritySection);
		const current = screen.getByLabelText(m.settings_current_password());
		const next = screen.getByLabelText(m.settings_new_password());
		const confirm = screen.getByLabelText(m.settings_confirm_password());
		await current.fill('current-password');
		await next.fill('new-password');
		await confirm.fill('different-password');

		const confirmInput = confirm.element() as HTMLInputElement;
		const confirmField = confirmInput.closest('[data-slot="field"]')!;
		const reveal = confirmField.querySelector('button') as HTMLButtonElement;
		await reveal.click();
		await expect.element(confirm).toHaveAttribute('type', 'text');

		await screen.getByRole('button', { name: m.settings_change_password() }).click();
		const error = document.querySelector('#settings-confirm-password-error')!;
		expect(error).toHaveTextContent(m.settings_password_mismatch());
		expect(confirmInput.getAttribute('aria-describedby')).toBe(error.id);
		expect(changePasswordMock).not.toHaveBeenCalled();
	});

	it('keeps successful feedback as a polite live announcement', async () => {
		changePasswordMock.mockResolvedValueOnce({ error: null });
		const screen = await render(SettingsSecuritySection);
		await screen.getByLabelText(m.settings_current_password()).fill('current-password');
		await screen.getByLabelText(m.settings_new_password()).fill('new-password');
		await screen.getByLabelText(m.settings_confirm_password()).fill('new-password');
		await screen.getByRole('button', { name: m.settings_change_password() }).click();

		const feedback = screen.getByText(m.settings_password_changed());
		await expect.element(feedback).toHaveAttribute('data-state', 'success');
		await expect.element(feedback).toHaveAttribute('aria-live', 'polite');
	});
});
