<script lang="ts">
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import DepthStyleSwitcher from '$lib/components/derived/depth-style-switcher/DepthStyleSwitcher.svelte';
	import { Separator } from '$lib/components/base/separator/index.js';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LogoMark from './LogoMark.svelte';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { NavLink } from './navbar_types.js';
	import { isNavActive } from './navbar_utils.js';

	interface MobileNavProps {
		navLinks: readonly NavLink[];
		oncreate?: () => void;
	}

	let { navLinks, oncreate }: MobileNavProps = $props();
	let open = $state(false);
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="outline"
				size="icon"
				aria-label={m.nav_open_menu()}
				class="md:hidden"
			>
				<MenuIcon data-icon />
			</Button>
		{/snippet}
	</Sheet.Trigger>
	<Sheet.Content side="left" class="w-72 overflow-y-auto p-0">
		<Sheet.Header class="border-b border-border px-5 py-4">
			<Sheet.Title>
				<LogoMark />
			</Sheet.Title>
			<Sheet.Description class="sr-only">{m.nav_menu_description()}</Sheet.Description>
		</Sheet.Header>

		<nav class="flex flex-col gap-1 p-3">
			<Button
				intent="primary"
				class="mb-2 w-full"
				surfaceClass="justify-center"
				onclick={() => {
					open = false;
					oncreate?.();
				}}
			>
				<PlusIcon data-icon="inline-start" />
				{m.nav_create()}
			</Button>

			{#each navLinks as link (link.href)}
				<Button
					intent={isNavActive(link.href) ? 'secondary' : 'ghost'}
					href={link.href}
					class="w-full"
					surfaceClass={cn(
						'justify-start',
						isNavActive(link.href) && 'font-semibold text-primary',
					)}
					onclick={() => (open = false)}
				>
					{link.label}
				</Button>
			{/each}
		</nav>

		<!-- ≤768px control consolidation: palette / language / dark mode live here
		     instead of the topbar (DECISIONS.md, mobile control consolidation). -->
		<div class="flex flex-col gap-3 border-t border-border p-4">
			<span
				class="text-(length:--text-xs) font-bold uppercase tracking-wider text-muted-foreground"
			>
				{m.settings_appearance_title()}
			</span>
			<PaletteSwitcher variant="inline" />
			<Separator />
			<DepthStyleSwitcher />
			<Separator />
			<LanguageToggle variant="inline" />
			<DarkModeToggle variant="inline" />
		</div>
	</Sheet.Content>
</Sheet.Root>
