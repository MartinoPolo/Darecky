<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { cn } from '$lib/utils.js';
	import {
		wishlistBadgeVariants,
		type WishlistBadgePresentation,
		type WishlistBadgeStatus,
	} from './wishlist_badge_variants.js';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		presentation?: WishlistBadgePresentation;
		status?: WishlistBadgeStatus;
		icon?: Snippet;
		children: Snippet;
	}

	let {
		presentation = 'card-metadata',
		status = 'none',
		icon,
		children,
		class: className,
		...restProps
	}: Props = $props();
</script>

<Badge
	tone="neutral"
	badgeStyle="outlined"
	size="default"
	{icon}
	class={cn(wishlistBadgeVariants({ presentation, status }), className)}
	{...restProps}
>
	{@render children()}
</Badge>
