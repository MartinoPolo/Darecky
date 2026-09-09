<script lang="ts">
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftBulkAction,
		PendingGiftBulkActionDescriptor,
	} from '$lib/modules/gifts/gift_bulk_update.js';

	interface Choice {
		id: string;
		label: string;
	}
	interface Props {
		selectedCount: number;
		hiddenCount: number;
		visibleState: 'none' | 'some' | 'all';
		pending?: PendingGiftBulkActionDescriptor | null;
		priorityReady?: boolean;
		categoryReady?: boolean;
		priorityLevels: Choice[];
		categories: Choice[];
		commonPriorityId: string | null | undefined;
		commonCategoryId: string | null | undefined;
		commonImageFit?: 'fill' | 'fit' | undefined;
		commonImageBackground: string | null | undefined;
		commonReceived?: boolean | undefined;
		onselectvisible: (checked: boolean) => void;
		onpriority: (id: string | null) => void;
		oncategory: (id: string | null) => void;
		onaction: (action: GiftBulkAction) => void;
		oncopy?: (returnToActions?: () => void) => void;
		ondone: () => void;
	}
	let {
		selectedCount,
		hiddenCount,
		visibleState,
		pending = null,
		priorityReady = false,
		categoryReady = false,
		priorityLevels,
		categories,
		commonPriorityId,
		commonCategoryId,
		commonImageFit = undefined,
		commonImageBackground,
		commonReceived = undefined,
		onselectvisible,
		onpriority,
		oncategory,
		onaction,
		oncopy = () => undefined,
		ondone,
	}: Props = $props();
	const disabled = $derived(pending !== null || selectedCount === 0);
	const pendingLabel = $derived(
		pending === null ? '' : m.gift_bulk_pending({ count: pending.count }),
	);
	const prioritySummary = $derived(
		commonPriorityId === undefined
			? m.gift_selection_mixed()
			: commonPriorityId === null
				? m.gift_priority_none()
				: (priorityLevels.find((x) => x.id === commonPriorityId)?.label ??
					m.gift_priority_none()),
	);
	const categorySummary = $derived(
		commonCategoryId === undefined
			? m.gift_selection_mixed()
			: commonCategoryId === null
				? m.gift_category_uncategorized()
				: (categories.find((x) => x.id === commonCategoryId)?.label ??
					m.gift_category_uncategorized()),
	);
	const imageFitSummary = $derived(
		commonImageFit === undefined
			? m.gift_selection_mixed()
			: commonImageFit === 'fill'
				? m.image_fit_fill()
				: m.image_fit_fit(),
	);
	const backgroundSummary = $derived(
		commonImageBackground === undefined
			? m.gift_selection_mixed()
			: commonImageBackground === null
				? m.image_background_transparent()
				: commonImageBackground === '#ffffff'
					? m.image_background_white()
					: commonImageBackground === '#000000'
						? m.image_background_black()
						: m.gift_selection_mixed(),
	);
	const receivedSummary = $derived(
		commonReceived === undefined
			? m.gift_selection_mixed()
			: commonReceived
				? m.gift_mark_received()
				: m.gift_mark_unreceived(),
	);
	function labelWithOptionalSummary(label: string, summary: string) {
		return `${label}: ${summary}`;
	}
	type MobileBulkAction =
		| 'priority'
		| 'category'
		| 'imageFit'
		| 'imageBackground'
		| 'copy'
		| 'received';

	const MIXED_RADIO_VALUE = '__mixed__';
	let mobileBulkSheetOpen = $state(false);
	let mobileBulkTrigger = $state<HTMLButtonElement | null>(null);
	let mobileBackButton = $state<HTMLButtonElement | null>(null);
	let mobileActiveAction = $state<Exclude<MobileBulkAction, 'copy'> | null>(null);
	let mobileInvokingAction = $state<MobileBulkAction | null>(null);
	type PendingFocusDestination =
		| { kind: 'radio'; target: HTMLInputElement }
		| { kind: 'action'; action: MobileBulkAction }
		| { kind: 'trigger'; target: HTMLButtonElement };

	let pendingFocusAction = $state<Exclude<MobileBulkAction, 'copy'> | null>(null);
	let pendingFocusDestination = $state<PendingFocusDestination | null>(null);
	let pendingFocusCycleObserved = $state(false);

	function clearPendingFocusTracking() {
		pendingFocusAction = null;
		pendingFocusDestination = null;
		pendingFocusCycleObserved = false;
	}

	$effect(() => {
		if (
			pendingFocusDestination !== null &&
			pendingFocusAction !== null &&
			pending?.action === pendingFocusAction
		) {
			pendingFocusCycleObserved = true;
		} else if (pending === null && pendingFocusCycleObserved) {
			const destination = pendingFocusDestination;
			clearPendingFocusTracking();
			requestAnimationFrame(() => {
				const target =
					destination?.kind === 'action'
						? document.querySelector<HTMLButtonElement>(
								`[data-mobile-bulk-action="${destination.action}"]`,
							)
						: destination?.target;
				if (
					target !== null &&
					target !== undefined &&
					target.isConnected &&
					!target.disabled
				) {
					target.focus({ preventScroll: true });
				}
			});
		}
	});

	function focusMobileAction(action: MobileBulkAction) {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				document
					.querySelector<HTMLButtonElement>(`[data-mobile-bulk-action="${action}"]`)
					?.focus({ preventScroll: true });
			});
		});
	}

	function handleMobileBulkSheetOpenChange(open: boolean) {
		mobileBulkSheetOpen = open;
		if (!open) {
			mobileActiveAction = null;
			if (pendingFocusCycleObserved && mobileBulkTrigger !== null) {
				pendingFocusDestination = { kind: 'trigger', target: mobileBulkTrigger };
			} else {
				clearPendingFocusTracking();
				requestAnimationFrame(() => {
					if (
						mobileBulkTrigger !== null &&
						mobileBulkTrigger.isConnected &&
						!mobileBulkTrigger.disabled
					) {
						mobileBulkTrigger.focus({ preventScroll: true });
					}
				});
			}
		}
	}

	function openMobileAction(action: Exclude<MobileBulkAction, 'copy'>) {
		mobileInvokingAction = action;
		mobileActiveAction = action;
		requestAnimationFrame(() => mobileBackButton?.focus({ preventScroll: true }));
	}

	function returnToMobileActions() {
		const action = mobileInvokingAction;
		mobileActiveAction = null;
		if (pendingFocusCycleObserved && action !== null) {
			pendingFocusDestination = { kind: 'action', action };
		} else {
			clearPendingFocusTracking();
			if (action !== null) {
				focusMobileAction(action);
			}
		}
	}

	function handleImageFit(fit: 'fill' | 'fit') {
		onaction({ action: 'imageFit', fit });
	}

	function handleImageBackground(background: '#ffffff' | '#000000' | null) {
		onaction({ action: 'imageBackground', background });
	}

	function handleReceived(received: boolean) {
		onaction({ action: 'received', received });
	}

	function handleBulkRadioChange(event: Event, onchange: () => void) {
		pendingFocusDestination = {
			kind: 'radio',
			target: event.currentTarget as HTMLInputElement,
		};
		pendingFocusAction = mobileActiveAction;
		pendingFocusCycleObserved = false;
		onchange();
	}

	function handleCopy() {
		if (mobileBulkSheetOpen) {
			mobileInvokingAction = 'copy';
			mobileBulkSheetOpen = false;
			requestAnimationFrame(() =>
				oncopy(() => {
					mobileBulkSheetOpen = true;
					focusMobileAction('copy');
				}),
			);
			return;
		}
		oncopy();
	}
</script>

{#snippet priorityItems()}{#if commonPriorityId === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonPriorityId === undefined ? MIXED_RADIO_VALUE : (commonPriorityId ?? '')}
		onValueChange={(id) => onpriority(id === '' ? null : id)}
		><DropdownMenu.RadioItem value="">{m.gift_priority_none()}</DropdownMenu.RadioItem
		>{#each priorityLevels as choice (choice.id)}<DropdownMenu.RadioItem value={choice.id}
				>{choice.label}</DropdownMenu.RadioItem
			>{/each}</DropdownMenu.RadioGroup
	>{/snippet}
{#snippet categoryItems()}{#if commonCategoryId === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonCategoryId === undefined ? MIXED_RADIO_VALUE : (commonCategoryId ?? '')}
		onValueChange={(id) => oncategory(id === '' ? null : id)}
		><DropdownMenu.RadioItem value="">{m.gift_category_uncategorized()}</DropdownMenu.RadioItem
		>{#each categories as choice (choice.id)}<DropdownMenu.RadioItem value={choice.id}
				>{choice.label}</DropdownMenu.RadioItem
			>{/each}</DropdownMenu.RadioGroup
	>{/snippet}
{#snippet imageFitItems()}{#if commonImageFit === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonImageFit ?? MIXED_RADIO_VALUE}
		onValueChange={(fit) => {
			if (fit === 'fill' || fit === 'fit') handleImageFit(fit);
		}}
		><DropdownMenu.RadioItem data-testid="selection-image-fit-fill" value="fill"
			>{m.image_fit_fill()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem data-testid="selection-image-fit-fit" value="fit"
			>{m.image_fit_fit()}</DropdownMenu.RadioItem
		></DropdownMenu.RadioGroup
	>{/snippet}
{#snippet imageBackgroundItems()}{#if commonImageBackground === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonImageBackground === undefined
			? MIXED_RADIO_VALUE
			: (commonImageBackground ?? 'transparent')}
		onValueChange={(background) =>
			handleImageBackground(
				background === '#ffffff' || background === '#000000' ? background : null,
			)}
		><DropdownMenu.RadioItem data-testid="selection-image-background-white" value="#ffffff"
			>{m.image_background_white()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem data-testid="selection-image-background-black" value="#000000"
			>{m.image_background_black()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem
			data-testid="selection-image-background-transparent"
			value="transparent">{m.image_background_transparent()}</DropdownMenu.RadioItem
		></DropdownMenu.RadioGroup
	>{/snippet}
{#snippet receivedItems()}{#if commonReceived === undefined}<DropdownMenu.Label
			>{m.gift_selection_mixed()}</DropdownMenu.Label
		>{/if}<DropdownMenu.RadioGroup
		value={commonReceived === undefined ? MIXED_RADIO_VALUE : String(commonReceived)}
		onValueChange={(received) => {
			if (received === 'true' || received === 'false') handleReceived(received === 'true');
		}}
		><DropdownMenu.RadioItem data-testid="selection-received-true" value="true"
			>{m.gift_mark_received()}</DropdownMenu.RadioItem
		><DropdownMenu.RadioItem data-testid="selection-received-false" value="false"
			>{m.gift_mark_unreceived()}</DropdownMenu.RadioItem
		></DropdownMenu.RadioGroup
	>{/snippet}

{#snippet bulkRadioChoice(
	name: string,
	value: string,
	label: string,
	checked: boolean,
	optionDisabled: boolean,
	onchange: () => void,
)}
	<label class="bulk-sheet-choice" class:bulk-sheet-choice-disabled={optionDisabled}>
		<input
			type="radio"
			{name}
			{value}
			{checked}
			disabled={optionDisabled}
			onchange={(event) => handleBulkRadioChange(event, onchange)}
		/>
		<span>{label}</span>
	</label>
{/snippet}

{#snippet mobileActionRow(
	action: MobileBulkAction,
	label: string,
	summary: string,
	actionDisabled: boolean,
)}
	<button
		type="button"
		class="bulk-sheet-action"
		data-mobile-bulk-action={action}
		disabled={actionDisabled}
		onclick={() => (action === 'copy' ? handleCopy() : openMobileAction(action))}
	>
		<span class="bulk-sheet-action-text">
			<strong>{label}</strong>
			<span>{summary}</span>
		</span>
		<ChevronRightIcon aria-hidden="true" />
	</button>
{/snippet}

{#snippet mobileNestedOptions()}
	<div class="bulk-sheet-nested">
		<div class="bulk-sheet-nested-nav">
			<Button
				bind:ref={mobileBackButton}
				intent="ghost"
				size="md"
				onclick={returnToMobileActions}
			>
				<ArrowLeftIcon data-icon="inline-start" />{m.gift_context_back()}
			</Button>
			<strong>
				{mobileActiveAction === 'priority'
					? m.gift_priority_label()
					: mobileActiveAction === 'category'
						? m.gift_context_category()
						: mobileActiveAction === 'imageFit'
							? m.image_fit_label()
							: mobileActiveAction === 'imageBackground'
								? m.image_background_label()
								: m.gift_selection_received_state()}
			</strong>
		</div>
		<div class="bulk-sheet-options" data-testid="selection-bulk-sheet-options">
			{#if mobileActiveAction === 'priority'}
				<fieldset disabled={disabled || !priorityReady}>
					<legend class="sr-only">{m.gift_priority_label()}</legend>
					{#if commonPriorityId === undefined}<p class="bulk-sheet-mixed">
							{m.gift_selection_mixed()}
						</p>{/if}
					{@render bulkRadioChoice(
						'bulk-priority',
						'',
						m.gift_priority_none(),
						commonPriorityId === null,
						disabled || !priorityReady,
						() => onpriority(null),
					)}
					{#each priorityLevels as choice (choice.id)}
						{@render bulkRadioChoice(
							'bulk-priority',
							choice.id,
							choice.label,
							commonPriorityId === choice.id,
							disabled || !priorityReady,
							() => onpriority(choice.id),
						)}
					{/each}
				</fieldset>
			{:else if mobileActiveAction === 'category'}
				<fieldset disabled={disabled || !categoryReady}>
					<legend class="sr-only">{m.gift_context_category()}</legend>
					{#if commonCategoryId === undefined}<p class="bulk-sheet-mixed">
							{m.gift_selection_mixed()}
						</p>{/if}
					{@render bulkRadioChoice(
						'bulk-category',
						'',
						m.gift_category_uncategorized(),
						commonCategoryId === null,
						disabled || !categoryReady,
						() => oncategory(null),
					)}
					{#each categories as choice (choice.id)}
						{@render bulkRadioChoice(
							'bulk-category',
							choice.id,
							choice.label,
							commonCategoryId === choice.id,
							disabled || !categoryReady,
							() => oncategory(choice.id),
						)}
					{/each}
				</fieldset>
			{:else if mobileActiveAction === 'imageFit'}
				<fieldset {disabled}>
					<legend class="sr-only">{m.image_fit_label()}</legend>
					{#if commonImageFit === undefined}<p class="bulk-sheet-mixed">
							{m.gift_selection_mixed()}
						</p>{/if}
					{@render bulkRadioChoice(
						'bulk-image-fit',
						'fill',
						m.image_fit_fill(),
						commonImageFit === 'fill',
						disabled,
						() => handleImageFit('fill'),
					)}
					{@render bulkRadioChoice(
						'bulk-image-fit',
						'fit',
						m.image_fit_fit(),
						commonImageFit === 'fit',
						disabled,
						() => handleImageFit('fit'),
					)}
				</fieldset>
			{:else if mobileActiveAction === 'imageBackground'}
				<fieldset {disabled}>
					<legend class="sr-only">{m.image_background_label()}</legend>
					{#if commonImageBackground === undefined}<p class="bulk-sheet-mixed">
							{m.gift_selection_mixed()}
						</p>{/if}
					{@render bulkRadioChoice(
						'bulk-image-background',
						'#ffffff',
						m.image_background_white(),
						commonImageBackground === '#ffffff',
						disabled,
						() => handleImageBackground('#ffffff'),
					)}
					{@render bulkRadioChoice(
						'bulk-image-background',
						'#000000',
						m.image_background_black(),
						commonImageBackground === '#000000',
						disabled,
						() => handleImageBackground('#000000'),
					)}
					{@render bulkRadioChoice(
						'bulk-image-background',
						'transparent',
						m.image_background_transparent(),
						commonImageBackground === null,
						disabled,
						() => handleImageBackground(null),
					)}
				</fieldset>
			{:else if mobileActiveAction === 'received'}
				<fieldset {disabled}>
					<legend class="sr-only">{m.gift_selection_received_state()}</legend>
					{#if commonReceived === undefined}<p class="bulk-sheet-mixed">
							{m.gift_selection_mixed()}
						</p>{/if}
					{@render bulkRadioChoice(
						'bulk-received',
						'true',
						m.gift_mark_received(),
						commonReceived === true,
						disabled,
						() => handleReceived(true),
					)}
					{@render bulkRadioChoice(
						'bulk-received',
						'false',
						m.gift_mark_unreceived(),
						commonReceived === false,
						disabled,
						() => handleReceived(false),
					)}
				</fieldset>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet mobileBulkSheet()}
	<Sheet.Root open={mobileBulkSheetOpen} onOpenChange={handleMobileBulkSheetOpenChange}>
		<Sheet.Trigger>
			{#snippet child({ props })}
				<Button
					bind:ref={mobileBulkTrigger}
					{...props}
					intent="outline"
					size="md"
					{disabled}
				>
					{pending !== null ? pendingLabel : m.gift_selection_actions()}
				</Button>
			{/snippet}
		</Sheet.Trigger>
		{#if mobileBulkSheetOpen}
			<WishlistBottomSheet class="selection-bulk-sheet max-h-[calc(100dvh-0.25rem)]">
				<Sheet.Header
					class="bulk-sheet-header border-border flex min-h-12 flex-row items-center gap-2 border-b px-4 py-1 pr-14"
				>
					<Sheet.Title>{m.gift_selection_actions()}</Sheet.Title>
					<Sheet.Description>
						{pending !== null
							? pendingLabel
							: m.gift_selection_count({ count: selectedCount })}
					</Sheet.Description>
				</Sheet.Header>
				{#if mobileActiveAction === null}
					<div class="bulk-sheet-actions" data-testid="selection-bulk-sheet-actions">
						{@render mobileActionRow(
							'priority',
							m.gift_priority_label(),
							priorityReady ? prioritySummary : m.moderator_loading(),
							disabled || !priorityReady,
						)}
						{@render mobileActionRow(
							'category',
							m.gift_context_category(),
							categoryReady ? categorySummary : m.moderator_loading(),
							disabled || !categoryReady,
						)}
						{@render mobileActionRow(
							'imageFit',
							m.image_fit_label(),
							imageFitSummary,
							disabled,
						)}
						{@render mobileActionRow(
							'imageBackground',
							m.image_background_label(),
							backgroundSummary,
							disabled,
						)}
						{@render mobileActionRow('copy', m.gift_bulk_copy(), '', disabled)}
						{@render mobileActionRow(
							'received',
							m.gift_selection_received_state(),
							receivedSummary,
							disabled,
						)}
					</div>
				{:else}
					{@render mobileNestedOptions()}
				{/if}
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{/snippet}

{#snippet desktopActions(testId: string)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} intent="outline" size="md" {disabled} data-testid={testId}>
					<SlidersHorizontalIcon data-icon="inline-start" />{pending !== null
						? pendingLabel
						: m.gift_selection_actions()}<ChevronDownIcon data-icon="inline-end" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" aria-label={m.gift_selection_actions()}>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger disabled={!priorityReady}>
					{labelWithOptionalSummary(
						m.gift_priority_label(),
						priorityReady ? prioritySummary : m.moderator_loading(),
					)}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>{@render priorityItems()}</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger disabled={!categoryReady}>
					{labelWithOptionalSummary(
						m.gift_context_category(),
						categoryReady ? categorySummary : m.moderator_loading(),
					)}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>{@render categoryItems()}</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{labelWithOptionalSummary(m.image_fit_label(), imageFitSummary)}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>{@render imageFitItems()}</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{labelWithOptionalSummary(m.image_background_label(), backgroundSummary)}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>{@render imageBackgroundItems()}</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<CopyIcon data-icon="inline-start" />{m.gift_bulk_copy()}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onclick={handleCopy}
						>{m.gift_bulk_copy_choose()}</DropdownMenu.Item
					>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{labelWithOptionalSummary(m.gift_selection_received_state(), receivedSummary)}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>{@render receivedItems()}</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<div class="selection-toolbar" role="region" aria-label={m.gift_selection_toolbar()}>
	<div class="mobile-selection-row">
		<Checkbox
			checked={visibleState === 'all'}
			indeterminate={visibleState === 'some'}
			onCheckedChange={onselectvisible}
			aria-label={m.gift_selection_visible_all()}
		/>
		<strong class="mobile-selection-label">
			{m.gift_selection_mode_label()} · {m.gift_selection_count({ count: selectedCount })}
		</strong>
		<div class="mobile-selection-actions">
			{@render mobileBulkSheet()}
			<Button intent="primary" size="md" onclick={ondone}>{m.cancel()}</Button>
		</div>
	</div>
	<div class="selection-summary desktop-selection-summary">
		<Checkbox
			checked={visibleState === 'all'}
			indeterminate={visibleState === 'some'}
			onCheckedChange={onselectvisible}
			aria-label={m.gift_selection_visible_all()}
		/>
		<strong class="selection-count whitespace-nowrap text-sm"
			>{m.gift_selection_count({ count: selectedCount })}</strong
		>{#if hiddenCount > 0}<span
				class="hidden-selection-count inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-xs font-bold text-warning-foreground"
				><EyeOffIcon class="size-3.5" />{m.gift_selection_hidden_count({
					count: hiddenCount,
				})}</span
			>{/if}
	</div>
	<div class="wide-controls" data-testid="selection-wide-controls">
		{@render desktopActions('desktop-selection-actions-trigger')}
	</div>
	<div class="narrow-actions" data-testid="selection-narrow-actions">
		{@render desktopActions('narrow-selection-actions-trigger')}
	</div>
	<Button class="done" intent="primary" size="md" onclick={ondone}>
		{m.done()}
	</Button>
</div>

<style>
	.selection-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.selection-summary {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.75rem;
	}

	.mobile-selection-row {
		display: none;
	}

	.wide-controls {
		display: none;
		align-items: center;
		gap: 0.5rem;
	}

	.narrow-actions {
		grid-column: 1 / -1;
	}

	.narrow-actions :global(button) {
		width: 100%;
	}

	:global(.done) {
		grid-column: 2;
		grid-row: 1;
	}

	:global(.selection-bulk-sheet) {
		display: flex;
		flex-direction: column;
	}

	:global(.bulk-sheet-header) {
		flex: 0 0 auto;
	}

	:global(.bulk-sheet-header [data-slot='sheet-description']) {
		margin-left: auto;
		white-space: nowrap;
	}

	.bulk-sheet-actions {
		flex: 0 0 auto;
		overflow: hidden;
		padding: 0.25rem 0.5rem;
	}

	.bulk-sheet-action {
		display: flex;
		width: 100%;
		min-height: 40px;
		align-items: center;
		gap: 0.5rem;
		border-radius: var(--radius-btn);
		padding: 0.25rem 0.75rem;
		text-align: left;
	}

	.bulk-sheet-action:hover {
		background: var(--accent);
	}

	.bulk-sheet-action:disabled {
		opacity: 0.5;
	}

	.bulk-sheet-action-text {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: baseline;
		gap: 0.5rem;
	}

	.bulk-sheet-action-text strong,
	.bulk-sheet-action-text span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bulk-sheet-action-text span {
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}

	.bulk-sheet-action > :global(svg) {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
	}

	.bulk-sheet-nested {
		display: flex;
		min-height: 0;
		flex: 1 1 auto;
		flex-direction: column;
	}

	.bulk-sheet-nested-nav {
		display: flex;
		min-height: 44px;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border);
		padding: 0.125rem 0.5rem;
	}

	.bulk-sheet-options {
		min-height: 0;
		flex: 1 1 auto;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.25rem 0.5rem;
	}

	.bulk-sheet-options fieldset {
		min-width: 0;
		margin: 0;
		border: 0;
		padding: 0;
	}

	.bulk-sheet-mixed {
		margin: 0;
		padding: 0.25rem 0.75rem;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: 800;
	}

	.bulk-sheet-choice {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 0.75rem;
		border-radius: var(--radius-btn);
		padding: 0.375rem 0.75rem;
		font-weight: 650;
	}

	.bulk-sheet-choice:hover {
		background: var(--accent);
	}

	.bulk-sheet-choice input {
		width: 20px;
		height: 20px;
		accent-color: var(--primary);
	}

	.bulk-sheet-choice-disabled {
		opacity: 0.5;
	}

	@media (width <= 639px) {
		.selection-toolbar {
			display: block;
		}

		.desktop-selection-summary,
		.wide-controls,
		.narrow-actions,
		:global(.done) {
			display: none;
		}

		.mobile-selection-row,
		.mobile-selection-actions {
			display: flex;
			min-width: 0;
			align-items: center;
		}

		.mobile-selection-row {
			width: 100%;
			justify-content: space-between;
			gap: 4px;
		}

		.mobile-selection-label {
			min-width: 0;
			overflow: hidden;
			font-family: var(--font-heading);
			font-size: 0.75rem;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mobile-selection-actions {
			flex: 0 0 auto;
			gap: 4px;
		}

		.mobile-selection-row > :global([data-slot='checkbox']),
		.mobile-selection-actions :global(button) {
			min-width: 40px;
			min-height: 40px;
			padding-inline: 0.375rem;
		}
	}

	@container wishlist-toolbar (min-width: 56rem) {
		.selection-toolbar {
			display: flex;
			flex-wrap: nowrap;
		}

		.selection-summary {
			margin-right: auto;
		}

		.wide-controls {
			display: flex;
		}

		.narrow-actions {
			display: none;
		}

		:global(.done) {
			border-left: 1px solid var(--border);
			margin-left: 0.25rem;
		}
	}

	@container wishlist-toolbar (min-width: 40rem) and (max-width: 55.999rem) {
		.selection-toolbar {
			display: flex;
		}

		.selection-summary {
			margin-right: auto;
		}

		.narrow-actions {
			grid-column: auto;
		}

		.narrow-actions :global(button) {
			width: auto;
		}
	}
</style>
