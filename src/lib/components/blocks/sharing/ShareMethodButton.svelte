<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { SharePlatformInfo } from '$lib/modules/sharing/types.js';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';

	interface ShareMethodButtonProps {
		platform: SharePlatformInfo;
		shareUrl: string;
		message: string;
		icon: Snippet;
	}

	let { platform, shareUrl, message, icon }: ShareMethodButtonProps = $props();

	const href = $derived(platform.buildUrl(shareUrl, message));

	function handleClick(event: MouseEvent) {
		event.preventDefault();
		window.open(href, '_blank', 'noopener,noreferrer');
	}
</script>

<!-- Sticker share row (issue #102 REQ-16): ink border, hard shadow lift on hover. -->
<Button
	intent="secondary"
	size="xl"
	class="w-full"
	surfaceClass="justify-start gap-3 no-underline"
	{href}
	rel="external noopener noreferrer"
	aria-label={platform.label}
	onclick={handleClick}
>
	<span
		class="{platform.colorClass} flex size-8 -rotate-3 items-center justify-center rounded-[9px] border-2 border-ink text-white"
	>
		{@render icon()}
	</span>
	<span class="flex-1 whitespace-nowrap text-left font-semibold text-foreground">
		{platform.label}
	</span>
	<ChevronRightIcon class="size-3.5 flex-shrink-0 text-muted-foreground" />
</Button>
