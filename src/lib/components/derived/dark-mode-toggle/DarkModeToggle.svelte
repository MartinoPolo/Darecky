<script lang="ts">
	import { userPrefersMode, setMode } from 'mode-watcher';
	import { Button } from '$lib/components/base/button/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import SunIcon from '@lucide/svelte/icons/sun';

	interface DarkModeToggleProps {
		/** `icon` = bordered header button; `inline` = label + row for drawers/consolidated menus. */
		variant?: 'icon' | 'inline';
	}

	const MODES = ['light', 'dark', 'system'] as const;
	type Mode = (typeof MODES)[number];

	const MODE_LABELS: Record<Mode, () => string> = {
		light: m.mode_toggle_light,
		dark: m.mode_toggle_dark,
		system: m.mode_toggle_system,
	};

	// Tooltip names the action a click performs (cycle order: light → dark → system → light).
	const NEXT_MODE_LABELS: Record<Mode, () => string> = {
		light: m.mode_toggle_switch_to_dark,
		dark: m.mode_toggle_switch_to_system,
		system: m.mode_toggle_switch_to_light,
	};

	let { variant = 'icon' }: DarkModeToggleProps = $props();

	const currentMode = $derived((userPrefersMode.current as Mode) ?? 'system');
	const currentModeLabel = $derived(MODE_LABELS[currentMode]());
	const nextActionLabel = $derived(NEXT_MODE_LABELS[currentMode]());

	function cycleMode() {
		const current: Mode = userPrefersMode.current as Mode;
		const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
		setMode(next);
	}
</script>

{#snippet modeIcon()}
	{#if userPrefersMode.current === 'light'}
		<SunIcon data-icon />
	{:else if userPrefersMode.current === 'dark'}
		<MoonIcon data-icon />
	{:else}
		<MonitorIcon data-icon />
	{/if}
{/snippet}

{#if variant === 'inline'}
	<div role="group" aria-label={m.settings_dark_mode_label()} class="flex flex-col gap-1.5">
		<span class="text-(length:--text-sm) font-semibold text-muted-foreground"
			>{m.settings_dark_mode_label()}</span
		>
		<Button
			onclick={cycleMode}
			intent="outline"
			size="md"
			class="w-full"
			surfaceClass="justify-start"
			aria-label={currentModeLabel}
		>
			{@render modeIcon()}
			{currentModeLabel}
		</Button>
	</div>
{:else}
	<SimpleTooltip text={nextActionLabel} side="bottom">
		{#snippet asChild(triggerProps)}
			<Button
				{...triggerProps}
				onclick={cycleMode}
				intent="outline"
				size="icon"
				aria-label={currentModeLabel}
			>
				{@render modeIcon()}
			</Button>
		{/snippet}
	</SimpleTooltip>
{/if}
