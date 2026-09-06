<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';
	import { OUTLINE_CONTROL_SURFACE_CLASSES } from '$lib/components/base/button/button_variants.js';
	import { cn, type WithoutChild } from '$lib/utils.js';

	type SelectState = 'default' | 'error';
	type SelectAppearance = 'default' | 'raised';

	let {
		ref = $bindable(null),
		class: className,
		surfaceClass,
		children,
		size = 'md',
		state = 'default' as SelectState,
		appearance = 'default' as SelectAppearance,
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: 'sm' | 'md' | 'lg';
		state?: SelectState;
		appearance?: SelectAppearance;
		surfaceClass?: string;
	} = $props();

	const selectValueClasses =
		'*:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:min-w-0';
	const iconClasses =
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
	const ownerBaseClasses = `group relative inline-flex w-fit min-w-0 max-w-full items-center justify-between gap-1.5 whitespace-nowrap rounded-btn select-none font-semibold cursor-pointer outline-none data-placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-3 aria-invalid:border-invalid-border aria-invalid:ring-invalid-ring aria-invalid:ring-3 disabled:cursor-not-allowed disabled:opacity-50`;
	const sizeClasses = {
		sm: 'h-(--size-control-sm) text-(length:--text-sm)',
		md: 'h-(--size-control-md) text-(length:--text-md)',
		lg: 'h-(--size-control-lg) text-(length:--text-base)',
	} as const;
	const flatOwnerClasses = `border-[2.5px] border-ink bg-card px-2.5 pr-2 transition-[color,box-shadow,border-color] ${selectValueClasses} ${iconClasses} data-[state=error]:border-status-danger data-[state=error]:shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-danger)_18%,transparent)]`;
	const raisedSurfaceBaseClasses = `elevation-surface flex size-full items-center justify-between gap-1.5 rounded-[inherit] border-[2.5px] border-ink bg-card px-2.5 pr-2 transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) ${selectValueClasses} ${iconClasses}`;
	const raisedSurfaceErrorClasses =
		'group-aria-invalid:border-status-danger group-aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-danger)_18%,transparent)] group-data-[state=error]:border-status-danger group-data-[state=error]:shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-danger)_18%,transparent)]';
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	data-state={state}
	aria-invalid={state === 'error' ? true : undefined}
	class={cn(
		ownerBaseClasses,
		sizeClasses[size],
		appearance === 'raised'
			? 'elevation-owner elevation-owner-raised elevation-owner-anchored p-0'
			: flatOwnerClasses,
		className,
	)}
	{...restProps}
>
	{#if appearance === 'raised'}
		<ElevationSurface
			class={cn(
				raisedSurfaceBaseClasses,
				OUTLINE_CONTROL_SURFACE_CLASSES,
				raisedSurfaceErrorClasses,
				surfaceClass,
			)}
		>
			{@render children?.()}
			<ChevronDownIcon class="text-muted-foreground" />
		</ElevationSurface>
	{:else}
		{@render children?.()}
		<ChevronDownIcon class="text-muted-foreground" />
	{/if}
</SelectPrimitive.Trigger>
