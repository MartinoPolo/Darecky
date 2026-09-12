import { render } from 'vitest-browser-svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const { setModeMock } = vi.hoisted(() => ({ setModeMock: vi.fn() }));

// Isolates this suite from mode-watcher's real localStorage/matchMedia-backed
// reactivity (irrelevant to the toggle-selection fix under test) — mirrors the
// `$env/dynamic/public` stub in gift_detail_form.svelte.test.ts.
vi.mock('mode-watcher', () => ({
	userPrefersMode: { current: 'light' as const },
	setMode: setModeMock,
}));

const { default: SettingsAppearanceSection } = await import('./SettingsAppearanceSection.svelte');

describe('SettingsAppearanceSection theme toggle selection (fixes: re-click deselects both items)', () => {
	beforeEach(() => {
		setModeMock.mockClear();
	});

	it('switches mode and calls setMode exactly once when clicking an inactive item', async () => {
		const screen = await render(SettingsAppearanceSection, {});

		await screen.getByRole('radio', { name: m.settings_mode_dark() }).click();

		expect(setModeMock).toHaveBeenCalledTimes(1);
		expect(setModeMock).toHaveBeenCalledWith('dark');
		await screen.unmount();
	});

	it('keeps the active item checked and does not call setMode when re-clicking it', async () => {
		const screen = await render(SettingsAppearanceSection, {});

		const activeItem = screen.getByRole('radio', { name: m.settings_mode_light() });
		await activeItem.click();

		expect(setModeMock).not.toHaveBeenCalled();
		await expect.element(activeItem).toHaveAttribute('data-state', 'on');
		await expect.element(activeItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});
});
