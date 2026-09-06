<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils.js';
	import {
		toastVariants,
		toastIconColors,
		toastTitleColors,
		type ToastProps,
		type ToastTone,
	} from './toast_variants.js';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import InfoIcon from '@lucide/svelte/icons/info';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';

	/** Fallback icon per tone, rendered when no explicit `icon` snippet is passed. */
	const DEFAULT_TONE_ICONS = {
		info: InfoIcon,
		success: CircleCheckIcon,
		warning: TriangleAlertIcon,
		danger: CircleXIcon,
		loading: LoaderCircleIcon,
	} as const satisfies Record<ToastTone, Component<{ class?: string }>>;

	let {
		ref = $bindable<HTMLDivElement | null>(null),
		class: className,
		tone = 'info',
		title,
		body,
		icon,
		action,
		onDismiss,
		...restProps
	}: ToastProps = $props();

	const DefaultToneIcon = $derived(DEFAULT_TONE_ICONS[tone]);
</script>

<div
	bind:this={ref}
	data-slot="toast"
	data-tone={tone}
	role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
	aria-live={tone === 'danger' || tone === 'warning' ? 'assertive' : 'polite'}
	class={cn(toastVariants({ tone }), className)}
	{...restProps}
>
	<div class={cn('shrink-0', toastIconColors[tone])}>
		{#if icon}
			{@render icon()}
		{:else}
			<DefaultToneIcon class={cn('size-4', tone === 'loading' && 'animate-spin')} />
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		<div class={cn('text-[12.5px] font-semibold', toastTitleColors[tone])}>{title}</div>
		{#if body}
			<div class="mt-0.5 text-(length:--text-sm) text-muted-foreground">{body}</div>
		{/if}
	</div>

	{#if action}
		{@render action()}
	{/if}

	{#if onDismiss}
		<Button
			intent="ghost"
			size="icon-sm"
			class="size-6"
			surfaceClass="text-muted-foreground"
			onclick={onDismiss}
			aria-label="Dismiss"
		>
			<XIcon data-icon="inline-start" />
		</Button>
	{/if}
</div>
