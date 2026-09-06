<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import { MAX_GIFT_LINKS, type GiftLink } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import { DRAFT_DESTRUCTIVE_HOVER_CLASS } from './gift_draft_grid_variants.js';

	interface Props {
		/** The reactive row whose `links` array is edited in place (max {@link MAX_GIFT_LINKS}). */
		links: GiftLink[];
		/** Fired after any add / remove / edit so the host can re-emit drafts. */
		onchange?: () => void;
	}

	let { links = $bindable(), onchange }: Props = $props();

	const atLimit = $derived(links.length >= MAX_GIFT_LINKS);

	/** A safe href for the open-in-new-tab anchor, or null when the URL is not yet valid. */
	function hrefOf(url: string): string | null {
		const trimmed = url.trim();
		if (trimmed === '') {
			return null;
		}
		try {
			const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
			return parsed.href;
		} catch {
			return null;
		}
	}

	/** Human label for aria text – explicit label, else host, else a generic fallback. */
	function labelOf(link: GiftLink): string {
		if (link.label !== undefined && link.label.trim() !== '') {
			return link.label;
		}
		const href = hrefOf(link.url);
		if (href !== null) {
			return new URL(href).hostname.replace(/^www\./, '');
		}
		return link.url.trim() === '' ? m.draft_grid_col_links() : link.url;
	}

	function isInvalidUrl(url: string): boolean {
		return url.trim() !== '' && normalizeGiftUrl(url) === null;
	}

	/** Hide the noisy protocol prefix in the field so the meaningful part of the URL stays visible. */
	function displayUrl(url: string): string {
		return url.replace(/^https?:\/\//i, '');
	}

	function editLink(link: GiftLink, url: string) {
		link.url = url;
		onchange?.();
	}

	function addLink() {
		if (atLimit) {
			return;
		}
		links.push({ url: '' });
		onchange?.();
	}

	function removeLink(index: number) {
		links.splice(index, 1);
		onchange?.();
	}
</script>

<div class="flex flex-col gap-1.5">
	{#each links as link, index (link)}
		{@const href = hrefOf(link.url)}
		{@const invalid = isInvalidUrl(link.url)}
		<div class="flex flex-col gap-1">
			<div
				class={cn(
					'flex min-h-(--size-control-md) items-center gap-1 rounded-md border bg-surface py-1.5 pr-2 pl-2',
					invalid
						? 'border-status-danger shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-danger)_18%,transparent)]'
						: 'border-border-strong focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_18%,transparent)]',
				)}
			>
				{#if href !== null}
					<a
						{href}
						target="_blank"
						rel="external noopener noreferrer"
						class="flex size-6 flex-none place-items-center rounded-sm text-primary transition-colors hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring"
						aria-label={m.draft_grid_open_link({ label: labelOf(link) })}
					>
						<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
					</a>
				{:else}
					<span
						class={cn(
							'flex size-6 flex-none place-items-center',
							invalid ? 'text-status-danger' : 'text-muted-foreground',
						)}
					>
						<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
					</span>
				{/if}
				<Input
					type="url"
					inputmode="url"
					value={displayUrl(link.url)}
					oninput={(event) => editLink(link, event.currentTarget.value)}
					placeholder={m.draft_grid_link_url_placeholder()}
					aria-label={`${m.draft_grid_col_links()} ${index + 1}`}
					aria-invalid={invalid}
					class="h-auto min-h-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
				/>
				<Button
					intent="ghost"
					size="icon-sm"
					class="size-6 flex-none"
					surfaceClass={cn('text-muted-foreground', DRAFT_DESTRUCTIVE_HOVER_CLASS)}
					onclick={() => removeLink(index)}
					aria-label={m.draft_grid_remove_link({ label: labelOf(link) })}
				>
					<XIcon class="size-3.5" aria-hidden="true" />
				</Button>
			</div>
			{#if invalid}
				<HelpText state="error">
					<CircleAlertIcon class="size-3.5" aria-hidden="true" />
					{m.draft_grid_link_url_invalid()}
				</HelpText>
			{/if}
		</div>
	{/each}

	<SimpleTooltip text={m.draft_grid_link_limit()} side="top" disabled={!atLimit}>
		<Button
			intent="ghost"
			size="sm"
			class="self-start"
			surfaceClass="font-semibold text-muted-foreground"
			onclick={addLink}
			disabled={atLimit}
			aria-label={m.draft_grid_add_link_aria()}
		>
			<PlusIcon data-icon="inline-start" />
			{m.draft_grid_add_link()}
		</Button>
	</SimpleTooltip>
</div>
