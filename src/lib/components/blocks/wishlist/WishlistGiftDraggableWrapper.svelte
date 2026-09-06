<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import * as m from '$lib/paraglide/messages.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import { createGiftLongPressRecognizer } from '$lib/modules/gifts/gift_long_press.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';

	interface WishlistGiftDraggableWrapperProps {
		index: number;
		totalCount: number;
		giftId: string;
		reorderEnabled: boolean;
		draggedGiftId: string | null;
		dragOverGiftId: string | null;
		dragOverStyle: 'ring' | 'bg';
		giftName: string;
		primaryLink: string | null;
		class?: string;
		children: Snippet;
		onopendetail: () => void;
		onreorderpointerdown: (event: PointerEvent, index: number) => void;
		onreordermove: (index: number, direction: -1 | 1) => void;
		selectionMode?: boolean;
		selectionLayout?: 'overlay' | 'list';
		selected?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		oncontextmenu?: (event: MouseEvent) => boolean;
		onlongpress?: () => boolean | void;
	}

	let {
		index,
		totalCount,
		giftId,
		reorderEnabled,
		draggedGiftId,
		dragOverGiftId,
		dragOverStyle,
		giftName,
		primaryLink,
		class: className = undefined,
		children,
		onopendetail,
		onreorderpointerdown,
		onreordermove,
		selectionMode = false,
		selectionLayout = 'overlay',
		selected = false,
		onselectiontoggle,
		oncontextmenu,
		onlongpress,
	}: WishlistGiftDraggableWrapperProps = $props();

	let longPressPending = $state(false);
	let suppressNextClickAfterLongPress = $state(false);
	const longPress = createGiftLongPressRecognizer(
		() => {
			suppressNextClickAfterLongPress = onlongpress?.() === true;
		},
		(pending) => {
			longPressPending = pending;
		},
	);
	const isDragged = $derived(draggedGiftId === giftId);
	const isDragOver = $derived(dragOverGiftId === giftId);
	const safePrimaryLink = $derived(normalizeGiftUrl(primaryLink));

	$effect(() => () => longPress.cancel());

	function eventStartedInsideInteractiveElement(event: Event): boolean {
		const target = event.target;
		const currentTarget = event.currentTarget;

		if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
			return false;
		}

		const interactiveElement = target.closest(
			'a, button, input, textarea, select, [data-prevent-gift-card-open]',
		);

		return interactiveElement !== null && interactiveElement !== currentTarget;
	}

	function suppressSelectionContext(event: Event) {
		event.preventDefault();
		event.stopPropagation();
	}

	function handleClick(event: MouseEvent) {
		if (suppressNextClickAfterLongPress) {
			suppressNextClickAfterLongPress = false;
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (selectionMode) {
			suppressSelectionContext(event);
			onselectiontoggle?.(giftId);
			return;
		}
		if (reorderEnabled) {
			suppressSelectionContext(event);
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		onopendetail();
	}

	function handleContextMenu(event: MouseEvent) {
		if (selectionMode || reorderEnabled) {
			suppressSelectionContext(event);
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			event.stopPropagation();
			return;
		}
		if (!(oncontextmenu?.(event) ?? false)) {
			event.preventDefault();
		}
	}

	function handlePointerDown(event: PointerEvent) {
		suppressNextClickAfterLongPress = false;
		if (selectionMode) {
			suppressSelectionContext(event);
			return;
		}
		if (event.pointerType === 'mouse') {
			return;
		}
		event.stopPropagation();
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		longPress.start(event.clientX, event.clientY);
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse') {
			longPress.move(event.clientX, event.clientY);
		}
	}

	function handleAuxclick(event: MouseEvent) {
		if (
			event.button !== 1 ||
			safePrimaryLink === null ||
			selectionMode ||
			reorderEnabled ||
			eventStartedInsideInteractiveElement(event)
		) {
			return;
		}

		event.preventDefault();
		window.open(safePrimaryLink, '_blank', 'noopener,noreferrer');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (
			(selectionMode || reorderEnabled) &&
			(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
		) {
			suppressSelectionContext(event);
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		if (reorderEnabled) {
			return;
		}
		if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
			event.preventDefault();
			const element = event.currentTarget as HTMLElement;
			const rect = element.getBoundingClientRect();
			element.dispatchEvent(
				new MouseEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					clientX: rect.left + rect.width / 2,
					clientY: rect.top + rect.height / 2,
				}),
			);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (selectionMode) {
				onselectiontoggle?.(giftId);
			} else {
				onopendetail();
			}
		}
	}

	function handleGripKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault();
			onreordermove(index, -1);
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault();
			onreordermove(index, 1);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	data-gift-item
	data-gift-id={giftId}
	data-long-press-pending={longPressPending || undefined}
	class={cn(
		selectionMode
			? 'relative h-full cursor-default rounded-panel transition-opacity focus-visible:outline-none'
			: 'group/gift-card relative h-full cursor-pointer rounded-panel transition-opacity focus-visible:outline-none',
		className,
		isDragged && 'invisible',
		isDragOver && dragOverStyle === 'ring' && 'ring-2 ring-inset ring-primary',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
		selectionLayout === 'list' && '[--gift-list-corner-left:5.25rem]',
		selectionMode &&
			selectionLayout === 'list' &&
			'sm:grid sm:grid-cols-[1.75rem_minmax(0,1fr)] sm:gap-2',
		selected &&
			'sm:rounded-xl sm:bg-[var(--selection-tint)] sm:outline-[3px] sm:outline-[var(--selection-ring)] sm:[&>div]:bg-transparent',
		longPressPending && 'ring-2 ring-inset ring-primary/35',
	)}
	role={selectionMode ? 'checkbox' : reorderEnabled ? undefined : 'button'}
	tabindex={reorderEnabled ? undefined : 0}
	aria-label={selectionMode
		? m.gift_selection_item_aria({ name: giftName })
		: reorderEnabled
			? undefined
			: m.gift_open_detail_aria({ name: giftName })}
	aria-checked={selectionMode ? selected : undefined}
	aria-selected={selectionMode ? selected : undefined}
	onclick={handleClick}
	onauxclick={handleAuxclick}
	oncontextmenu={handleContextMenu}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={() => longPress.end()}
	onpointercancel={() => longPress.cancel()}
	onkeydown={handleKeydown}
>
	{#if selectionMode}
		<span
			class={cn(
				'pointer-events-none absolute right-1 top-1 z-50 grid size-10 place-items-center rounded-[calc(var(--radius-panel)-4px)] border-2 border-ink bg-card text-[var(--selection-on-ring)] shadow-sticker sm:right-auto sm:left-2.5 sm:top-2.5 sm:size-7 sm:rounded-md sm:border-0 sm:shadow-sm',
				selected && 'bg-[var(--selection-ring)]',
				selectionLayout === 'list' &&
					'left-[var(--gift-list-corner-left)] right-auto sm:static sm:left-auto sm:top-auto sm:self-start sm:translate-y-2',
			)}
			data-testid="gift-selection-control"
			aria-hidden="true"
		>
			{#if selected}<CheckIcon class="size-[19px] stroke-[3] sm:size-4" />{/if}
		</span>
		{#if selected}<span
				class="pointer-events-none absolute inset-0 z-30 rounded-panel bg-[var(--selection-image-tint)] ring-[3px] ring-inset ring-[var(--selection-ring)] sm:hidden"
				data-testid="gift-selection-surface"
				aria-hidden="true"
			></span>{/if}
	{/if}
	{#if reorderEnabled && !selectionMode}
		<button
			type="button"
			aria-label={m.gift_reorder_grip_label()}
			title={m.gift_reorder_keyboard_hint()}
			class={cn(
				'group/grip elevation-owner elevation-owner-raised absolute right-1 top-1 z-50 grid size-10 cursor-grab touch-none place-items-center rounded-[calc(var(--radius-panel)-4px)] p-0 focus-visible:opacity-100 active:cursor-grabbing sm:right-auto sm:left-2 sm:top-2 sm:z-10 sm:size-auto sm:rounded sm:opacity-60',
				selectionLayout === 'list' &&
					'left-[var(--gift-list-corner-left)] right-auto sm:left-2',
			)}
			data-prevent-gift-card-open
			onpointerdown={(event) => onreorderpointerdown(event, index)}
			onkeydown={handleGripKeydown}
		>
			<ElevationSurface
				class="grid size-full place-items-center rounded-[inherit] border-2 border-ink bg-card shadow-sticker transition-[translate,scale,box-shadow,background-color,opacity] duration-200 ease-spring group-hover/gift-card:-translate-y-0.5 group-focus-within/gift-card:-translate-y-0.5 group-hover/grip:bg-accent sm:border-0 sm:bg-card/80 sm:p-0.5 sm:shadow-none"
			>
				<GripVerticalIcon class="size-4 text-muted-foreground" />
			</ElevationSurface>
		</button>
	{/if}
	<div
		class="contents"
		inert={selectionMode || reorderEnabled || undefined}
		data-selection-inert={selectionMode || reorderEnabled || undefined}
	>
		{@render children()}
	</div>
	{#if reorderEnabled && !selectionMode}
		<div
			class={cn(
				'absolute bottom-1 right-1 z-50 items-center gap-1',
				selectionLayout === 'list' ? 'flex sm:hidden' : 'gift-card-directional-actions',
			)}
			data-testid="gift-reorder-directional-actions"
		>
			<span class="pointer-events-none px-1 text-sm font-medium" aria-hidden="true">
				{index + 1}/{totalCount}
			</span>
			<Button
				type="button"
				intent="secondary"
				size="icon"
				class="size-10"
				aria-label={m.gift_reorder_move_up({ name: giftName })}
				disabled={index === 0}
				data-prevent-gift-card-open
				onclick={(event) => {
					event.stopPropagation();
					onreordermove(index, -1);
				}}
			>
				<ArrowUpIcon />
			</Button>
			<Button
				type="button"
				intent="secondary"
				size="icon"
				class="size-10"
				aria-label={m.gift_reorder_move_down({ name: giftName })}
				disabled={index === totalCount - 1}
				data-prevent-gift-card-open
				onclick={(event) => {
					event.stopPropagation();
					onreordermove(index, 1);
				}}
			>
				<ArrowDownIcon />
			</Button>
		</div>
	{/if}
</div>

<style>
	[data-gift-item]:focus-visible::after {
		position: absolute;
		z-index: 40;
		inset: 0;
		border-radius: var(--radius-panel);
		box-shadow: inset 0 0 0 2px var(--ring);
		content: '';
		pointer-events: none;
	}

	.gift-card-directional-actions {
		display: none;
	}

	@media (width <= 320px) {
		.gift-card-directional-actions {
			display: flex;
		}
	}
</style>
