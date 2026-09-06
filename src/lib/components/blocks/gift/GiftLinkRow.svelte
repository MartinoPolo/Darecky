<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import { extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';

	interface GiftLinkRowProps {
		link: GiftLink;
		isPrimary: boolean;
		isOnly: boolean;
		canMoveUp: boolean;
		canMoveDown: boolean;
		urlError?: string;
		disabled?: boolean;
		onurlchange: (url: string) => void;
		onlabelchange: (label: string) => void;
		onremove: () => void;
		onmoveup: () => void;
		onmovedown: () => void;
	}

	let {
		link,
		isPrimary,
		isOnly,
		canMoveUp,
		canMoveDown,
		urlError,
		disabled = false,
		onurlchange,
		onlabelchange,
		onremove,
		onmoveup,
		onmovedown,
	}: GiftLinkRowProps = $props();

	const hasUrlError = $derived(urlError != null && urlError !== '');
	// `link.id` is always populated by ensureGiftLinkIds in the editor; fall back to the URL
	// so the describedby target stays stable even for an id-less link.
	const urlErrorId = $derived(
		hasUrlError ? `gift-link-${link.id ?? link.url}-url-error` : undefined,
	);
	const labelInputId = $derived(`gift-link-${link.id ?? link.url}-label`);
	// The sr-only primacy hint (badge dropped, #189 refine) is wired to the URL input
	// so it is announced in focus mode too, not only when browsing the DOM.
	const primaryHintId = $derived(
		isPrimary ? `gift-link-${link.id ?? link.url}-primary` : undefined,
	);
	const urlDescribedBy = $derived(
		[primaryHintId, urlErrorId].filter((id) => id !== undefined).join(' ') || undefined,
	);
	// Live preview of the auto-derived label (the URL's domain) so the placeholder
	// always reflects what an empty label will actually render as.
	const labelPlaceholder = $derived(
		extractGiftUrlDomain(link.url) ?? m.gift_link_label_placeholder(),
	);
</script>

<div class="flex flex-col gap-1.5">
	<!-- URL row: bordered input + reorder + trash to the right (issue #189 REQ-7,
	     accepted mockup styling — dropped the heavy bordered-card wrapper). -->
	<div class="flex items-center gap-1.5">
		{#if isPrimary}
			<!-- First link is primary by order (issue #189 refine dropped the visible
			     „Hlavní" badge); an sr-only hint (wired to the input via
			     aria-describedby) keeps the primacy legible to AT. -->
			<span id={primaryHintId} class="sr-only">{m.gift_link_primary()}</span>
		{/if}

		<Input
			class="flex-1"
			value={link.url}
			placeholder="alza.cz/darek"
			type="text"
			data-testid="gift-link-url"
			{disabled}
			state={hasUrlError ? 'error' : 'default'}
			aria-invalid={hasUrlError ? true : undefined}
			aria-describedby={urlDescribedBy}
			oninput={(e: Event) => onurlchange((e.target as HTMLInputElement).value)}
		/>

		{#if !isOnly}
			<div class="flex shrink-0 items-center gap-0.5">
				<Button
					intent="ghost"
					size="icon-sm"
					onclick={onmoveup}
					aria-label={m.gift_link_move_up()}
					disabled={!canMoveUp || disabled}
				>
					<ArrowUpIcon />
				</Button>
				<Button
					intent="ghost"
					size="icon-sm"
					onclick={onmovedown}
					aria-label={m.gift_link_move_down()}
					disabled={!canMoveDown || disabled}
				>
					<ArrowDownIcon />
				</Button>
			</div>
		{/if}

		<Button
			intent="ghost"
			size="icon-sm"
			class="shrink-0"
			surfaceClass="text-muted-foreground group-hover:text-destructive"
			{disabled}
			onclick={onremove}
			aria-label={m.gift_link_remove()}
		>
			<TrashIcon />
		</Button>
	</div>

	<!-- Visible label (issue #189 REQ-7): the per-link label is the text gift cards
	     render (defaults to the URL's domain); a visible „Viditelný popisek" label
	     disambiguates it from the gift „Popis" (description) field above. The
	     placeholder previews the auto-derived domain for the row's current URL
	     (falling back to the generic hint when the URL is empty/invalid), and the
	     input is capped narrower than the URL field to nudge short labels. -->
	<div class="flex items-center gap-2 pl-0.5">
		<Label for={labelInputId} class="shrink-0 text-xs font-medium text-muted-foreground">
			{m.gift_link_visible_label()}
		</Label>
		<Input
			id={labelInputId}
			class="max-w-56 flex-1 text-sm"
			value={link.label ?? ''}
			placeholder={labelPlaceholder}
			type="text"
			{disabled}
			oninput={(e: Event) => onlabelchange((e.target as HTMLInputElement).value)}
		/>
	</div>

	{#if hasUrlError}
		<span id={urlErrorId} class="text-xs text-destructive">{urlError}</span>
	{/if}
</div>
