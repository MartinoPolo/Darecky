import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import '../../../../app.css';
import * as m from '$lib/paraglide/messages.js';
import type { DepthStyle } from '$lib/theme/depth_styles.js';
import { PALETTES } from '$lib/theme/palettes.js';

const { persistDepthMock, persistPaletteMock, updatePreferredLocaleMock, setModeMock } = vi.hoisted(
	() => ({
		persistDepthMock: vi.fn(),
		persistPaletteMock: vi.fn(),
		updatePreferredLocaleMock: vi.fn(),
		setModeMock: vi.fn(),
	}),
);
vi.mock('$lib/modules/settings/settings.remote.js', () => ({
	setUserDepthStyle: persistDepthMock,
	setUserPalette: persistPaletteMock,
	updatePreferredLocale: updatePreferredLocaleMock,
}));
vi.mock('mode-watcher', () => ({
	userPrefersMode: { current: 'light' as const },
	setMode: setModeMock,
}));

const { default: DepthStyleSwitcher } = await import('./DepthStyleSwitcher.svelte');
const { default: PaletteSwitcher } =
	await import('$lib/components/derived/palette-switcher/PaletteSwitcher.svelte');
const { default: SettingsAppearanceSection } =
	await import('$lib/components/blocks/settings/SettingsAppearanceSection.svelte');
const { default: AppearanceMenu } =
	await import('$lib/components/derived/appearance-menu/AppearanceMenu.svelte');
const { default: MobileNav } = await import('$lib/components/blocks/navbar/MobileNav.svelte');

function deferredPromise() {
	let resolve!: () => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

const previewRecipes: Record<DepthStyle, { label: string; style: string }> = {
	soft: {
		label: m.depth_style_soft(),
		style: '--hard-shadow: var(--soft-shadow); --hard-shadow-strong: var(--soft-shadow-strong);',
	},
	ink: {
		label: m.depth_style_ink(),
		style: '--hard-shadow: var(--ink-shadow); --hard-shadow-strong: var(--ink-shadow-strong);',
	},
	black: {
		label: m.depth_style_black(),
		style: '--hard-shadow: var(--black-shadow); --hard-shadow-strong: var(--black-shadow-strong);',
	},
};

interface LinearSrgbColor {
	red: number;
	green: number;
	blue: number;
	alpha: number;
}

function parseAlpha(value: string | undefined): number {
	if (value === undefined) {
		return 1;
	}
	return value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
}

function srgbChannelToLinear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function parseComputedColor(color: string): LinearSrgbColor {
	const functionMatch = color.match(/^(rgba?|oklab)\((.*)\)$/i);
	if (!functionMatch) {
		throw new Error(`Unsupported computed color format: "${color}"`);
	}

	const [, format, contents] = functionMatch;
	const [channelsText, alphaText] = contents!.split('/').map((part) => part.trim());
	const channels = channelsText!.split(/[\s,]+/).filter(Boolean);
	const legacyAlpha = channels.length === 4 ? channels.pop() : undefined;
	const alpha = parseAlpha(alphaText ?? legacyAlpha);

	if (format!.toLowerCase() === 'rgb' || format!.toLowerCase() === 'rgba') {
		if (channels.length !== 3) {
			throw new Error(`Unsupported computed color format: "${color}"`);
		}
		const normalized = channels.map((channel) =>
			channel.endsWith('%')
				? Number.parseFloat(channel) / 100
				: Number.parseFloat(channel) / 255,
		);
		return {
			red: srgbChannelToLinear(normalized[0]!),
			green: srgbChannelToLinear(normalized[1]!),
			blue: srgbChannelToLinear(normalized[2]!),
			alpha,
		};
	}

	if (channels.length !== 3) {
		throw new Error(`Unsupported computed color format: "${color}"`);
	}
	const lightness = channels[0]!.endsWith('%')
		? Number.parseFloat(channels[0]!) / 100
		: Number.parseFloat(channels[0]!);
	const axis = (value: string) =>
		value.endsWith('%') ? (Number.parseFloat(value) / 100) * 0.4 : Number.parseFloat(value);
	const a = axis(channels[1]!);
	const b = axis(channels[2]!);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const clamp = (value: number) => Math.min(1, Math.max(0, value));
	return {
		red: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		green: clamp(-0.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		blue: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
		alpha,
	};
}

function compositeOver(foreground: LinearSrgbColor, background: LinearSrgbColor): LinearSrgbColor {
	if (background.alpha !== 1) {
		throw new Error(`Contrast background must be opaque, received alpha ${background.alpha}`);
	}
	return {
		red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
		green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
		blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
		alpha: 1,
	};
}

function relativeLuminance(color: LinearSrgbColor): number {
	return 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue;
}

function contrastRatio(foregroundColor: string, backgroundColor: string): number {
	const background = parseComputedColor(backgroundColor);
	const foreground = compositeOver(parseComputedColor(foregroundColor), background);
	const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
	const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
	return (lighter + 0.05) / (darker + 0.05);
}

function clearRootAppearanceState() {
	delete document.documentElement.dataset.depth;
	delete document.documentElement.dataset.palette;
	document.documentElement.classList.remove('dark');
}

describe('DepthStyleSwitcher', () => {
	beforeEach(() => {
		persistDepthMock.mockReset();
		persistDepthMock.mockResolvedValue(undefined);
		persistPaletteMock.mockReset();
		persistPaletteMock.mockResolvedValue(undefined);
		updatePreferredLocaleMock.mockReset();
		updatePreferredLocaleMock.mockResolvedValue(undefined);
		setModeMock.mockReset();
		document.documentElement.classList.remove('dark');
		document.documentElement.dataset.depth = 'soft';
		document.documentElement.dataset.palette = 'grape';
	});

	afterEach(() => {
		clearRootAppearanceState();
	});

	it('renders exactly three name-only minimum-48px controlled choices with exact independent previews', async () => {
		const screen = await render(DepthStyleSwitcher, {});
		const choices = screen.getByRole('radio').all();
		expect(choices).toHaveLength(3);

		for (const { label, style } of Object.values(previewRecipes)) {
			const choice = screen.getByRole('radio', { name: label });
			expect(
				choice.element().getBoundingClientRect().height,
				`${label} radio height`,
			).toBeGreaterThanOrEqual(48);
			await expect.element(choice).toHaveAttribute('style', style);
		}
		await screen.unmount();
	});

	it('keeps every option boundary and geometry stable while only the local shadow preview changes', async () => {
		const screen = await render(DepthStyleSwitcher, {});
		const choices = screen.getByRole('radio').all();
		const boundary = (element: Element) => {
			const style = getComputedStyle(element);
			return {
				borderColor: style.borderColor,
				borderWidth: style.borderWidth,
				borderRadius: style.borderRadius,
				width: (element as HTMLElement).offsetWidth,
				height: (element as HTMLElement).offsetHeight,
			};
		};
		const baseline = choices.map((choice) => boundary(choice.element()));
		for (const choice of choices) {
			const surface = choice.element().querySelector(':scope > .elevation-surface')!;
			await expect.element(choice).toHaveClass(/elevation-owner-raised/);
			expect(surface.className).toContain('group-data-[state=on]:border-border-strong');
			expect(surface.className).toContain('group-data-[state=on]:bg-[var(--selection-tint)]');
			expect(surface.className).toContain('rounded-btn');
			await expect.element(choice).not.toHaveClass(/data-\[state=on\]:shadow/);
		}

		for (const choice of choices) {
			await choice.click();
			expect(choices.map((option) => boundary(option.element()))).toEqual(baseline);
		}
		await screen.unmount();
	});

	it('renders contrast-safe selected text and indicators for every palette, mode, and depth', async () => {
		const screen = await render(DepthStyleSwitcher, {});
		const choiceElements = new Map(
			Object.values(previewRecipes).map(({ label }) => {
				const element = screen.getByRole('radio', { name: label }).element() as HTMLElement;
				element.style.transition = 'none';
				return [label, element] as const;
			}),
		);

		for (const palette of PALETTES) {
			document.documentElement.dataset.palette = palette;
			for (const dark of [false, true]) {
				document.documentElement.classList.toggle('dark', dark);
				for (const { label } of Object.values(previewRecipes)) {
					const choiceElement = choiceElements.get(label)!;
					choiceElement.click();
					await tick();

					const context = `${palette}/${dark ? 'dark' : 'light'}/${label}`;
					expect(
						choiceElement.getAttribute('aria-checked'),
						`${context} selected state`,
					).toBe('true');
					const visualSurface = choiceElement.querySelector<HTMLElement>(
						':scope > .elevation-surface',
					)!;
					const choiceStyle = getComputedStyle(visualSurface);
					const indicator =
						choiceElement.querySelector<HTMLElement>('[data-selected=true]');
					expect(indicator, `${context} selected indicator`).not.toBeNull();
					const indicatorColor = getComputedStyle(indicator!, '::after').backgroundColor;

					expect(
						choiceElement.getBoundingClientRect().height,
						`${context} selected radio height`,
					).toBeGreaterThanOrEqual(48);
					expect(
						contrastRatio(choiceStyle.color, choiceStyle.backgroundColor),
						`${context} selected text/background contrast`,
					).toBeGreaterThanOrEqual(4.5);
					expect(
						contrastRatio(indicatorColor, choiceStyle.backgroundColor),
						`${context} indicator/background contrast`,
					).toBeGreaterThanOrEqual(3);
				}
			}
		}

		await screen.unmount();
		clearRootAppearanceState();
	});

	it('shows the document depth selection after mounting without exposing the SSR default', async () => {
		document.documentElement.dataset.depth = 'black';

		const screen = await render(DepthStyleSwitcher, {});
		await expect
			.element(screen.getByRole('group', { name: m.depth_style_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('radio', { name: m.depth_style_black() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('radio', { name: m.depth_style_soft() }))
			.toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('optimistically persists selection and synchronizes mounted instances without changing palette', async () => {
		const first = await render(DepthStyleSwitcher, {});
		const second = await render(DepthStyleSwitcher, {});

		const inkChoices = first.getByRole('radio', { name: m.depth_style_ink() }).all();
		await inkChoices[0]!.click();

		expect(document.documentElement.dataset.depth).toBe('ink');
		expect(document.documentElement.dataset.palette).toBe('grape');
		expect(persistDepthMock).toHaveBeenCalledWith('ink');
		await expect.element(inkChoices[1]!).toHaveAttribute('aria-checked', 'true');
		await first.unmount();
		await second.unmount();
	});

	it('globally serializes rapid persistence from separate instances in interaction order', async () => {
		const inkPersistence = deferredPromise();
		const blackPersistence = deferredPromise();
		persistDepthMock
			.mockImplementationOnce(() => inkPersistence.promise)
			.mockImplementationOnce(() => blackPersistence.promise);
		const first = await render(DepthStyleSwitcher, {});
		const second = await render(DepthStyleSwitcher, {});
		const inkChoices = first.getByRole('radio', { name: m.depth_style_ink() }).all();
		const blackChoices = first.getByRole('radio', { name: m.depth_style_black() }).all();

		await inkChoices[0]!.click();
		await blackChoices[1]!.click();

		expect(document.documentElement.dataset.depth).toBe('black');
		await expect.element(blackChoices[0]!).toHaveAttribute('aria-checked', 'true');
		expect(persistDepthMock).toHaveBeenCalledTimes(1);
		expect(persistDepthMock).toHaveBeenNthCalledWith(1, 'ink');

		inkPersistence.resolve();
		await vi.waitFor(() => {
			expect(persistDepthMock).toHaveBeenCalledTimes(2);
		});
		expect(persistDepthMock).toHaveBeenNthCalledWith(2, 'black');
		blackPersistence.resolve();
		await first.unmount();
		await second.unmount();
	});

	it('continues globally queued persistence after an earlier save rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			persistDepthMock
				.mockRejectedValueOnce(new Error('save failed'))
				.mockResolvedValueOnce(undefined);
			const screen = await render(DepthStyleSwitcher, {});

			try {
				await screen.getByRole('radio', { name: m.depth_style_ink() }).click();
				await screen.getByRole('radio', { name: m.depth_style_black() }).click();

				await vi.waitFor(() => expect(persistDepthMock).toHaveBeenCalledTimes(2));
				expect(persistDepthMock).toHaveBeenNthCalledWith(2, 'black');
			} finally {
				await screen.unmount();
			}
		} finally {
			consoleError.mockRestore();
		}
	});

	it('cannot deselect the active choice', async () => {
		const screen = await render(DepthStyleSwitcher, {});
		const soft = screen.getByRole('radio', { name: m.depth_style_soft() });

		await soft.click();

		await expect.element(soft).toHaveAttribute('aria-checked', 'true');
		expect(persistDepthMock).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('exposes the named depth group in settings and palette changes preserve depth', async () => {
		const screen = await render(SettingsAppearanceSection, {});

		await expect.element(screen.getByRole('group', { name: 'Hloubka a stíny' })).toBeVisible();
		await screen.getByRole('button', { name: 'Máta' }).click();

		expect(document.documentElement.dataset.depth).toBe('soft');
		expect(persistPaletteMock).toHaveBeenCalledWith('mint');
		await screen.unmount();
	});

	it('adds depth choices to the standalone palette popover but not the inline variant', async () => {
		const popover = await render(PaletteSwitcher, {});
		await popover.getByRole('button', { name: m.palette_switcher_label() }).click();
		const popoverDepthGroup = popover.getByRole('group', { name: m.depth_style_label() });
		await expect.element(popoverDepthGroup).toBeVisible();
		expect(popoverDepthGroup.getByRole('radio').all()).toHaveLength(3);
		await popover.unmount();

		const inline = await render(PaletteSwitcher, { variant: 'inline' });
		expect(inline.getByRole('group', { name: m.depth_style_label() }).all()).toHaveLength(0);
		await inline.unmount();
	});

	it('shows the named depth group in the real appearance menu', async () => {
		const screen = await render(AppearanceMenu, {});

		await screen.getByRole('button', { name: m.settings_appearance_title() }).click();

		await expect.element(screen.getByRole('group', { name: 'Hloubka a stíny' })).toBeVisible();
		await screen.unmount();
	});

	it('shows the named depth group in the real mobile navigation drawer', async () => {
		await page.viewport(375, 667);
		const screen = await render(MobileNav, { navLinks: [] });

		await screen.getByRole('button', { name: m.nav_open_menu() }).click();

		await expect.element(screen.getByRole('group', { name: 'Hloubka a stíny' })).toBeVisible();
		await screen.unmount();
		await page.viewport(1280, 720);
	});
});
