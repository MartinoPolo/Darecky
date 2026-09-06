<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import DialogPortal from './dialog-portal.svelte';
	import DialogOverlay from './dialog-overlay.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import {
		overlayCloseButtonClass,
		overlayCloseButtonSurfaceClass,
	} from '$lib/components/base/dialog/dialog_close_button.js';
	import * as m from '$lib/paraglide/messages.js';
	import { dialogContentVariants, type DialogContentSize } from './dialog_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		size,
		showCloseButton = true,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		size?: DialogContentSize;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<DialogOverlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(dialogContentVariants({ size }), className)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close data-slot="dialog-close">
				{#snippet child({ props })}
					<Button
						intent="ghost"
						size="icon-sm"
						class={overlayCloseButtonClass}
						surfaceClass={overlayCloseButtonSurfaceClass}
						{...props}
					>
						<XIcon data-icon="inline-start" />
						<span class="sr-only">{m.close()}</span>
					</Button>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
