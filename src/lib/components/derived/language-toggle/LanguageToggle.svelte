<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { ChoiceRow } from '$lib/components/derived/choice-row/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeCurrentHref } from '$lib/i18n/locale.js';
	import { updatePreferredLocale } from '$lib/modules/settings/settings.remote.js';
	import { getLocaleForUrl, locales, setLocale, type Locale } from '$lib/paraglide/runtime.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import LanguageFlag from './LanguageFlag.svelte';

	interface LanguageToggleProps {
		/** `icon` = popover trigger in headers; `inline` = label + grid for drawers/settings. */
		variant?: 'icon' | 'inline';
	}

	let { variant = 'icon' }: LanguageToggleProps = $props();

	const LOCALE_META: Record<Locale, { label: () => string }> = {
		cs: { label: m.settings_language_cs },
		en: { label: m.settings_language_en },
	};

	/** Short codes for the compact header trigger (flags appear only in the dropdown items). */
	const LOCALE_CODES: Record<Locale, string> = {
		cs: 'CZ',
		en: 'EN',
	};

	const LOCALE_SORT_ORDER: Record<Locale, number> = {
		cs: 0,
		en: 1,
	};

	const availableLocales = [...locales].sort(
		(a, b) => LOCALE_SORT_ORDER[a] - LOCALE_SORT_ORDER[b],
	);
	const currentLocale = $derived(getLocaleForUrl(page.url.href));
	const currentLanguage = $derived(LOCALE_META[currentLocale]);
	const currentLabel = $derived(currentLanguage.label());
	const ariaLabel = $derived(`${m.settings_language_label()}: ${currentLabel}`);
	const isLoggedIn = $derived(page.data.user != null);

	let isOpen = $state(false);
	let isSwitchingLocale = $state(false);

	async function handleLocaleChange(newLocale: Locale) {
		isOpen = false;
		if (newLocale === currentLocale || isSwitchingLocale) {
			return;
		}

		const nextHref = localizeCurrentHref(page.url, newLocale);

		isSwitchingLocale = true;
		setLocale(newLocale, { reload: false });

		try {
			if (isLoggedIn) {
				await updatePreferredLocale({ preferredLocale: newLocale });
			}
			await goto(nextHref, { noScroll: true });
		} catch {
			window.location.href = nextHref;
		} finally {
			isSwitchingLocale = false;
		}
	}
</script>

{#snippet localeGrid()}
	<div class="grid gap-1">
		{#each availableLocales as locale (locale)}
			{@const language = LOCALE_META[locale]}
			<ChoiceRow
				selected={locale === currentLocale}
				disabled={isSwitchingLocale}
				onSelect={() => handleLocaleChange(locale)}
			>
				{#snippet leading()}<LanguageFlag {locale} />{/snippet}
				{language.label()}
			</ChoiceRow>
		{/each}
	</div>
{/snippet}

{#if variant === 'inline'}
	<div role="group" aria-label={m.settings_language_label()} class="flex flex-col gap-1.5">
		<span class="text-(length:--text-sm) font-semibold text-muted-foreground"
			>{m.settings_language_label()}</span
		>
		{@render localeGrid()}
	</div>
{:else}
	<Popover.Root bind:open={isOpen}>
		<SimpleTooltip text={m.language_toggle_tooltip()} side="bottom" disabled={isOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						intent="outline"
						size="icon"
						class=""
						surfaceClass="text-(length:--text-base)"
						aria-label={ariaLabel}
					>
						{LOCALE_CODES[currentLocale]}
					</Button>
				{/snippet}
			</Popover.Trigger>
		</SimpleTooltip>
		<Popover.Content
			align="end"
			class="w-44 min-w-0 p-2.5"
			aria-label={m.settings_language_label()}
		>
			<Popover.Label>{m.settings_language_label()}</Popover.Label>
			{@render localeGrid()}
		</Popover.Content>
	</Popover.Root>
{/if}
