<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import { cn } from '$lib/utils.js';
	import { ROW_STATUS, type RowStatus } from '$lib/modules/gifts/draft_grid.js';
	import { isValidDraftImageUrl, parseDraftQuantity } from '$lib/modules/gifts/gift_draft.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftLinksCell from './GiftDraftLinksCell.svelte';
	import GiftDraftPriceCell from './GiftDraftPriceCell.svelte';
	import GiftDraftPriorityCell from './GiftDraftPriorityCell.svelte';
	import {
		draftRowStatusVariants,
		DRAFT_GRID_COLUMNS,
		DRAFT_GRID_COLUMNS_NO_PRIORITY,
		DRAFT_COL_LABEL_CLASS,
		DRAFT_DESTRUCTIVE_HOVER_CLASS,
	} from './gift_draft_grid_variants.js';
	import type { DraftGridRow } from './gift_draft_grid_model.js';
	import type { DraftPriority } from '$lib/modules/gifts/types.js';
	import {
		labelForGiftCategory,
		normalizeGiftCategoryLabel,
		type ManagedGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	interface Props {
		row: DraftGridRow;
		/** Retain the layout slot while making an exiting row non-interactive. */
		exiting?: boolean;
		/** Whole-card status derived by the grid (error > duplicate > ready). */
		status: RowStatus;
		/** Show the priority (heart) cell. Hidden when the target lacks ≥2 levels. */
		showPriority: boolean;
		categoryOptions: ManagedGiftCategory[];
		resolvedImportedCategoryLabels?: ReadonlySet<string>;
		/** Re-emit drafts after any edit/selection change. */
		onchange?: () => void;
		/** Remove this row entirely. */
		ondelete: () => void;
		/** Clear the possible-duplicate flag for this row. */
		ondismissduplicate: () => void;
	}

	let {
		row = $bindable(),
		exiting = false,
		status,
		showPriority,
		categoryOptions,
		resolvedImportedCategoryLabels = new Set(),
		onchange,
		ondelete,
		ondismissduplicate,
	}: Props = $props();

	const gridColumns = $derived(
		showPriority ? DRAFT_GRID_COLUMNS : DRAFT_GRID_COLUMNS_NO_PRIORITY,
	);

	let editing = $state(false);

	const nameInvalid = $derived(row.name.trim() === '' && !row.pristine);
	const isDuplicate = $derived(status === ROW_STATUS.duplicate);
	const imageUrlValid = $derived(isValidDraftImageUrl(row.imageUrl));
	const quantityValid = $derived(parseDraftQuantity(row.quantity) !== null);
	const categoryValid = $derived(
		row.importedCategoryLabel.trim() === '' ||
			row.categoryId.trim() !== '' ||
			resolvedImportedCategoryLabels.has(
				normalizeGiftCategoryLabel(row.importedCategoryLabel),
			),
	);

	/** Any field edit marks the row touched (so a blank batch starter can turn red). */
	function markTouched() {
		row.pristine = false;
		onchange?.();
	}

	function toggleSelected(checked: boolean) {
		row.selected = checked;
		onchange?.();
	}

	function setPriority(next: DraftPriority) {
		row.priority = next;
		onchange?.();
	}

	function categoryLabel(category: ManagedGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}
</script>

<div
	data-gift-item
	data-gift-id={row.id}
	inert={exiting}
	aria-hidden={exiting}
	class={cn(
		'relative flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4 transition-[background,border-color,box-shadow] duration-(--duration-normal) hover:shadow-sm',
		gridColumns,
		draftRowStatusVariants({ status }),
		row.selected ? '' : 'opacity-50',
		editing && 'shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_16%,transparent)]',
	)}
	onfocusin={() => (editing = true)}
	onfocusout={() => (editing = false)}
>
	<!-- Mobile control bar: checkbox + tools (no header row exists on mobile) -->
	<div class="flex items-center gap-2 md:hidden">
		<Checkbox
			checked={row.selected}
			onCheckedChange={toggleSelected}
			aria-label={row.name.trim() === ''
				? m.draft_grid_select_row_unnamed()
				: m.draft_grid_select_row({ name: row.name })}
		/>
		<div class="flex-1"></div>
		{#if showPriority}
			<GiftDraftPriorityCell priority={row.priority} name={row.name} onchange={setPriority} />
		{/if}
		<Button
			intent="ghost"
			size="icon-sm"
			disabled
			aria-label={m.draft_grid_enrich_row()}
			surfaceClass="text-muted-foreground"
		>
			<SparklesIcon aria-hidden="true" />
		</Button>
		<Button
			intent="ghost"
			size="icon-sm"
			onclick={ondelete}
			aria-label={m.draft_grid_remove_row()}
			surfaceClass={cn('text-muted-foreground', DRAFT_DESTRUCTIVE_HOVER_CLASS)}
		>
			<Trash2Icon aria-hidden="true" />
		</Button>
	</div>

	<!-- Desktop select cell (col 1) -->
	<div class="hidden md:flex md:min-h-(--size-control-md) md:items-center md:justify-center">
		<Checkbox
			checked={row.selected}
			onCheckedChange={toggleSelected}
			aria-label={row.name.trim() === ''
				? m.draft_grid_select_row_unnamed()
				: m.draft_grid_select_row({ name: row.name })}
		/>
	</div>

	<!-- Název (col 2) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_name()}
		</span>
		<Input
			type="text"
			value={row.name}
			oninput={(event) => {
				row.name = event.currentTarget.value;
				markTouched();
			}}
			state={nameInvalid ? 'error' : 'default'}
			aria-invalid={nameInvalid}
			placeholder={m.draft_grid_name_placeholder()}
			aria-label={m.draft_grid_col_name()}
			class="font-semibold"
		/>
		{#if nameInvalid}
			<HelpText state="error">
				<CircleAlertIcon class="size-3.5" aria-hidden="true" />
				{m.draft_grid_name_required()}
			</HelpText>
		{/if}
		{#if isDuplicate}
			<SimpleTooltip text={m.draft_grid_duplicate_dismiss()} side="top">
				{#snippet asChild(triggerProps)}
					<button
						{...triggerProps}
						type="button"
						onclick={ondismissduplicate}
						class="inline-flex h-6 items-center gap-1.5 self-start rounded-full border border-[color-mix(in_oklch,var(--status-dup)_42%,transparent)] bg-[color-mix(in_oklch,var(--status-dup)_16%,transparent)] px-2.5 text-xs font-semibold text-[color-mix(in_oklch,var(--status-dup)_60%,var(--foreground))] transition-colors hover:bg-[color-mix(in_oklch,var(--status-dup)_26%,transparent)]"
					>
						<CopyIcon class="size-3" aria-hidden="true" />
						{m.draft_grid_duplicate_badge()}
						<XIcon class="size-3 opacity-70" aria-hidden="true" />
					</button>
				{/snippet}
			</SimpleTooltip>
		{/if}
	</div>

	<!-- Poznámka (col 3) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_note()}
		</span>
		<Textarea
			value={row.description}
			oninput={(event) => {
				row.description = event.currentTarget.value;
				markTouched();
			}}
			rows={1}
			placeholder={m.draft_grid_note_placeholder()}
			aria-label={m.draft_grid_col_note()}
		/>
	</div>

	<!-- Odkazy (col 4) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_links()}
		</span>
		<GiftDraftLinksCell bind:links={row.links} onchange={markTouched} />
	</div>

	<!-- Cena (col 5) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_price()}
		</span>
		<GiftDraftPriceCell
			price={row.price}
			currency={row.currency}
			onPriceInput={(value) => {
				row.price = value;
				markTouched();
			}}
			onCurrencyChange={(value) => {
				row.currency = value;
				markTouched();
			}}
		/>
	</div>

	<!-- External image URL + safe automatic thumbnail -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_image()}
		</span>
		<div class="flex items-center gap-2">
			{#if imageUrlValid && row.imageUrl.trim() !== ''}
				<ImageFrame
					src={row.imageUrl.trim()}
					alt=""
					class="size-10 shrink-0 rounded-md"
					referrerPolicy="no-referrer"
				/>
			{/if}
			<Input
				type="url"
				value={row.imageUrl}
				oninput={(event) => {
					row.imageUrl = event.currentTarget.value;
					markTouched();
				}}
				state={imageUrlValid ? 'default' : 'error'}
				aria-invalid={!imageUrlValid}
				placeholder="https://…"
				aria-label={m.draft_grid_col_image()}
			/>
		</div>
		{#if !imageUrlValid}
			<HelpText state="error">{m.draft_grid_image_https_required()}</HelpText>
		{/if}
	</div>

	<!-- Category -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_category()}
		</span>
		{#if categoryOptions.length > 0}
			<Select.Root
				type="single"
				value={row.categoryId}
				onValueChange={(value) => {
					row.categoryId = value;
					row.importedCategoryLabel = '';
					markTouched();
				}}
			>
				<Select.Trigger size="md" class="w-full">
					{#if row.categoryId}
						{@const selectedCategory = categoryOptions.find(
							(category) => category.id === row.categoryId,
						)}
						{selectedCategory === undefined
							? m.gift_category_none()
							: categoryLabel(selectedCategory)}
					{:else}
						{m.gift_category_none()}
					{/if}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.Item value="" label={m.gift_category_none()}>
							{m.gift_category_none()}
						</Select.Item>
						{#each categoryOptions as category (category.id)}
							{@const label = categoryLabel(category)}
							<Select.Item value={category.id} {label}>{label}</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		{:else}
			<span class="text-xs text-muted-foreground">{m.gift_category_none()}</span>
		{/if}
		{#if !categoryValid}
			<HelpText state="error">
				{m.import_category_unresolved({ label: row.importedCategoryLabel })}
			</HelpText>
		{/if}
	</div>

	<!-- Quantity -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_quantity()}
		</span>
		<Input
			type="number"
			class="numeric-input"
			min="1"
			step="1"
			value={row.quantity}
			oninput={(event) => {
				row.quantity = event.currentTarget.value;
				markTouched();
			}}
			state={quantityValid ? 'default' : 'error'}
			aria-invalid={!quantityValid}
			aria-label={m.draft_grid_col_quantity()}
		/>
		{#if !quantityValid}
			<HelpText state="error">{m.draft_grid_quantity_invalid()}</HelpText>
		{/if}
	</div>

	<!-- Priority heart toggle -->
	{#if showPriority}
		<div class="hidden md:flex md:items-start md:justify-center md:pt-1">
			<GiftDraftPriorityCell priority={row.priority} name={row.name} onchange={setPriority} />
		</div>
	{/if}

	<!-- Desktop enrich + remove actions (col 7, sharing one tight track) -->
	<div class="hidden md:flex md:items-start md:gap-0.5 md:pt-1">
		<Button
			intent="ghost"
			size="icon-sm"
			disabled
			aria-label={m.draft_grid_enrich_row()}
			surfaceClass="text-muted-foreground"
		>
			<SparklesIcon aria-hidden="true" />
		</Button>
		<Button
			intent="ghost"
			size="icon-sm"
			onclick={ondelete}
			aria-label={m.draft_grid_remove_row()}
			surfaceClass={cn('text-muted-foreground', DRAFT_DESTRUCTIVE_HOVER_CLASS)}
		>
			<Trash2Icon aria-hidden="true" />
		</Button>
	</div>
</div>
