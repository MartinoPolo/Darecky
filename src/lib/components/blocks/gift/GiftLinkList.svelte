<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { normalizeGiftUrl, extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';
	import { giftLinkListVariants, type GiftLinkListDisplay } from './gift_link_list_variants.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';

	interface GiftLinkListProps {
		links: GiftLink[];
		maxVisible?: number;
		/** `chip` (default): compact card/list tag pill. `row`: full-width ≥44px
		 *  touch target with a leading domain pill + trailing title (issue #165). */
		display?: GiftLinkListDisplay;
	}

	let { links, maxVisible = 3, display = 'chip' }: GiftLinkListProps = $props();

	const visibleLinks = $derived(links.slice(0, maxVisible));
	const overflowCount = $derived(links.length - maxVisible);
	const styles = $derived(giftLinkListVariants({ display }));
</script>

{#if links.length === 0}
	<span class="text-xs text-muted-foreground italic">{m.gift_link_none()}</span>
{:else}
	<!-- Link tag chips (`anime-sky-final.html` .tag-link): ink pills tinted on hover.
	     `row` display (issue #165, gift detail modal): a full-width touch target with
	     the domain pill leading and the link's title trailing. -->
	<div class={styles.root()}>
		{#each visibleLinks as link, index (index)}
			{@const safeUrl = normalizeGiftUrl(link.url)}
			{@const domain = extractGiftUrlDomain(link.url)}
			<SimpleTooltip text={link.url} side="top">
				{#snippet asChild(triggerProps)}
					<a
						{...triggerProps}
						href={safeUrl ?? '#'}
						target="_blank"
						rel="external noopener noreferrer"
						class={styles.link()}
						onclick={(e: MouseEvent) => e.stopPropagation()}
					>
						<ElevationSurface class={styles.surface()}>
							{#if display === 'row'}
								<span class={styles.domain()}>
									<ExternalLinkIcon class={styles.icon()} />
									{domain ?? link.url}
								</span>
								<span class={styles.title()}>{link.label ?? link.url}</span>
							{:else}
								<ExternalLinkIcon class={styles.icon()} />
								<span class={styles.chipLabel()}
									>{link.label ?? domain ?? link.url}</span
								>
							{/if}
						</ElevationSurface>
					</a>
				{/snippet}
			</SimpleTooltip>
		{/each}
		{#if overflowCount > 0}
			<span class={styles.overflow()}>{m.gift_link_overflow({ count: overflowCount })}</span>
		{/if}
	</div>
{/if}
