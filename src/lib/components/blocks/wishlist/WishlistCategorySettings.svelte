<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { ColorPicker } from '$lib/components/derived/color-picker/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import { getGiftCategorySettingsRows } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
	import { saveGiftCategorySettingsCommand } from '$lib/modules/gift-categories/gift_categories.remote.js';
	import {
		GIFT_CATEGORY_PRESETS,
		MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
		type GiftCategoryPresetKey,
	} from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import {
		getServerErrorCode,
		translateServerError,
	} from '$lib/modules/errors/translate_server_error.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { onDestroy, onMount, tick } from 'svelte';
	import { giftCategoryColorForIndex } from '$lib/modules/gift-categories/gift_category_colors.js';
	import { createCategorySettingsMotion } from './wishlist_category_settings_motion.svelte.js';

	interface CategoryDraft {
		customCategories: Array<{ id: string | null; label: string; color: string }>;
		presetKeys: GiftCategoryPresetKey[];
		presetColors: Array<{ key: GiftCategoryPresetKey; color: string }>;
		confirmedRemovalCategoryIds: string[];
	}
	interface Props {
		wishlistId: string;
		saving?: boolean;
		commitVersion?: number;
		ondirtychange?: (dirty: boolean) => void;
		ondraftchange?: (draft: CategoryDraft | null) => void;
	}
	interface CustomDraft {
		key: string;
		id: string | null;
		label: string;
		color: string;
	}
	interface PendingRemoval {
		type: 'custom' | 'preset';
		key: string;
		categoryId: string;
		label: string;
		usedCount: number;
	}

	let {
		wishlistId,
		saving = false,
		commitVersion = 0,
		ondirtychange,
		ondraftchange,
	}: Props = $props();
	const categoriesQuery = $derived(getGiftCategorySettingsRows(wishlistId));
	const settingsRows = $derived(categoriesQuery.current ?? []);
	const categories = $derived(settingsRows.filter((category) => category.enabled));
	let customLabel = $state('');
	let customDrafts = $state<CustomDraft[]>([]);
	let enabledPresets = $state<GiftCategoryPresetKey[]>([]);
	let presetColors = $state<Partial<Record<GiftCategoryPresetKey, string>>>({});
	let baseline = $state('');
	let seededSignature = $state('');
	let nextCustomColorIndex = $state(0);
	// svelte-ignore state_referenced_locally (one-time version seed)
	let seenCommitVersion = $state(commitVersion);
	let pendingRemoval = $state<PendingRemoval | null>(null);
	let confirmedRemovalCategoryIds = $state<string[]>([]);
	let removalTrigger = $state<HTMLElement | null>(null);
	let categoryRowsElement = $state<HTMLElement | null>(null);
	let usageRefreshStatus = $state<'loading' | 'fresh' | 'error'>('loading');
	const categoryControlsDisabled = $derived(saving || usageRefreshStatus !== 'fresh');
	const categoryMotion = createCategorySettingsMotion();
	onDestroy(() => categoryMotion.destroy());
	onMount(() => {
		void refreshCategoryUsage();
	});

	async function refreshCategoryUsage() {
		usageRefreshStatus = 'loading';
		try {
			if (categoriesQuery.current === undefined) {
				await categoriesQuery;
			} else {
				await categoriesQuery.refresh();
			}
			usageRefreshStatus = 'fresh';
		} catch (thrown) {
			console.error('Failed to refresh category usage:', thrown);
			usageRefreshStatus = 'error';
		}
	}

	function usedCountForCategoryId(categoryId: string | null): number {
		if (categoryId === null) {
			return 0;
		}
		return (
			categoriesQuery.current?.find((category) => category.id === categoryId)?.usedCount ?? 0
		);
	}

	function snapshot(): string {
		return JSON.stringify({
			custom: customDrafts.map(({ id, label, color }) => ({
				id,
				label: label.trim(),
				color,
			})),
			presets: [...enabledPresets].sort().map((key) => ({ key, color: presetColors[key] })),
		});
	}
	const dirty = $derived(baseline !== '' && snapshot() !== baseline);
	function buildDraft(): CategoryDraft {
		return {
			customCategories: customDrafts.map(({ id, label, color }) => ({
				id,
				label: label.trim(),
				color,
			})),
			presetKeys: enabledPresets,
			presetColors: enabledPresets.map((key) => ({
				key,
				color:
					presetColors[key] ??
					GIFT_CATEGORY_PRESETS.find((preset) => preset.key === key)!.color,
			})),
			confirmedRemovalCategoryIds,
		};
	}
	$effect(() => {
		ondirtychange?.(dirty);
		ondraftchange?.(dirty ? buildDraft() : null);
	});
	$effect(() => {
		if (commitVersion !== seenCommitVersion) {
			seenCommitVersion = commitVersion;
			confirmedRemovalCategoryIds = [];
			baseline = snapshot();
		}
	});
	$effect(() => {
		const signature = JSON.stringify(settingsRows);
		if (signature === seededSignature || dirty) {
			return;
		}
		customDrafts = categories
			.filter((category) => category.customLabel !== null)
			.map((category) => ({
				key: category.id,
				id: category.id,
				label: category.customLabel ?? '',
				color: category.color,
			}));
		enabledPresets = categories.flatMap((category) => category.presetKey ?? []);
		presetColors = Object.fromEntries(
			settingsRows.flatMap((category) =>
				category.presetKey === null ? [] : [[category.presetKey, category.color]],
			),
		);
		nextCustomColorIndex = settingsRows.filter(
			(category) => category.presetKey === null,
		).length;
		baseline = snapshot();
		seededSignature = signature;
	});

	function createCustom() {
		const label = customLabel.trim();
		if (!label || saving) {
			return;
		}
		customDrafts = [
			{
				key: crypto.randomUUID(),
				id: null,
				label,
				color: giftCategoryColorForIndex(nextCustomColorIndex),
			},
			...customDrafts,
		];
		nextCustomColorIndex += 1;
		customLabel = '';
	}
	function handleCreateKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.isComposing) {
			return;
		}
		event.preventDefault();
		createCustom();
	}
	async function move(index: number, direction: -1 | 1) {
		const snapshot =
			categoryRowsElement === null ? null : categoryMotion.capture(categoryRowsElement);
		const next = [...customDrafts];
		const item = next.splice(index, 1)[0]!;
		next.splice(index + direction, 0, item);
		customDrafts = next;
		await tick();
		if (snapshot !== null && categoryRowsElement !== null) {
			void categoryMotion.play(snapshot, categoryRowsElement);
		}
	}
	async function togglePreset(
		key: GiftCategoryPresetKey,
		checked: boolean,
		label: string,
		usedCount: number,
	) {
		const persisted = categories.find((category) => category.presetKey === key);
		if (!checked && persisted !== undefined && usedCount > 0) {
			removalTrigger = document.activeElement as HTMLElement | null;
			pendingRemoval = { type: 'preset', key, categoryId: persisted.id, label, usedCount };
			// Bits UI updates its bindable state before reporting the attempted toggle. Drive the
			// controlled prop through a full state change to restore it without recreating the node.
			enabledPresets = enabledPresets.filter((candidate) => candidate !== key);
			await tick();
			if (pendingRemoval?.categoryId === persisted.id) {
				enabledPresets = [...enabledPresets, key];
			}
			return;
		}
		if (checked) {
			enabledPresets = enabledPresets.includes(key)
				? enabledPresets
				: [...enabledPresets, key];
			presetColors[key] ??= GIFT_CATEGORY_PRESETS.find((preset) => preset.key === key)!.color;
			if (persisted !== undefined) {
				confirmedRemovalCategoryIds = confirmedRemovalCategoryIds.filter(
					(id) => id !== persisted.id,
				);
			}
		} else {
			enabledPresets = enabledPresets.filter((candidate) => candidate !== key);
		}
	}
	async function requestCustomRemoval(category: CustomDraft, trigger: HTMLElement) {
		if (categoryControlsDisabled) {
			return;
		}
		const usedCount = usedCountForCategoryId(category.id);
		if (category.id !== null && usedCount > 0) {
			removalTrigger = trigger;
			pendingRemoval = {
				type: 'custom',
				key: category.key,
				categoryId: category.id,
				label: category.label.trim(),
				usedCount,
			};
			return;
		}
		const snapshot =
			categoryRowsElement === null
				? null
				: categoryMotion.capture(categoryRowsElement, category.key);
		customDrafts = customDrafts.filter((item) => item.key !== category.key);
		await tick();
		if (snapshot !== null && categoryRowsElement !== null) {
			void categoryMotion.play(snapshot, categoryRowsElement);
		}
	}
	async function confirmRemoval() {
		const removal = pendingRemoval;
		if (removal === null) {
			return;
		}
		const snapshot =
			removal.type === 'custom' && categoryRowsElement !== null
				? categoryMotion.capture(categoryRowsElement, removal.key)
				: null;
		confirmedRemovalCategoryIds = [
			...confirmedRemovalCategoryIds.filter((id) => id !== removal.categoryId),
			removal.categoryId,
		];
		if (removal.type === 'custom') {
			customDrafts = customDrafts.filter((item) => item.key !== removal.key);
		} else {
			enabledPresets = enabledPresets.filter((key) => key !== removal.key);
		}
		pendingRemoval = null;
		await tick();
		if (snapshot !== null && categoryRowsElement !== null) {
			void categoryMotion.play(snapshot, categoryRowsElement);
		}
	}
	function restoreRemovalTrigger(event: Event) {
		if (removalTrigger?.isConnected === true) {
			event.preventDefault();
			removalTrigger.focus();
		}
		removalTrigger = null;
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (ondraftchange !== undefined) {
			return;
		}
		saving = true;
		try {
			await saveGiftCategorySettingsCommand({ wishlistId, ...buildDraft() });
			confirmedRemovalCategoryIds = [];
			baseline = snapshot();
			await tick();
			toastSuccess(m.gift_categories_saved());
		} catch (thrown) {
			if (
				getServerErrorCode(thrown) ===
				SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH
			) {
				confirmedRemovalCategoryIds = [];
				baseline = '';
				seededSignature = '';
				await refreshCategoryUsage();
			}
			toastError(translateServerError(thrown));
		} finally {
			saving = false;
		}
	}
</script>

<form id="wishlist-categories-form" class="flex flex-col gap-5" onsubmit={save}>
	<p class="text-sm text-muted-foreground">{m.gift_categories_settings_hint()}</p>
	<HelpText>{m.gift_category_color_save_hint()}</HelpText>
	{#if usageRefreshStatus === 'error'}
		<div
			class="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3"
			role="alert"
		>
			<p class="text-sm text-destructive">{m.error_generic()}</p>
			<Button type="button" size="sm" intent="outline" onclick={refreshCategoryUsage}>
				{m.import_wizard_retry()}
			</Button>
		</div>
	{/if}

	<div class="flex flex-col gap-2">
		<h3 class="text-base font-semibold">{m.gift_category_create()}</h3>
		<div class="flex flex-wrap gap-2">
			<Input
				bind:value={customLabel}
				maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
				placeholder={m.gift_category_custom_placeholder()}
				class="min-w-56 flex-1"
				disabled={categoryControlsDisabled}
				onkeydown={handleCreateKeydown}
			/>
			<Button
				type="button"
				onclick={createCustom}
				disabled={categoryControlsDisabled || customLabel.trim() === ''}
				>{m.gift_category_create()}</Button
			>
		</div>
	</div>

	<div class="flex flex-col gap-3" bind:this={categoryRowsElement}>
		<h3 class="text-base font-semibold">{m.gift_categories_custom_title()}</h3>
		{#if customDrafts.length === 0}
			<HelpText>{m.gift_categories_empty()}</HelpText>
		{:else}
			{#each customDrafts as category, index (category.key)}
				{@const usedCount = usedCountForCategoryId(category.id)}
				<div
					class="flex items-center gap-2 rounded-lg border border-border border-l-4 bg-surface px-3 py-2"
					style:border-left-color={category.color}
					data-testid="gift-category-settings-card"
					data-category-row
					data-category-id={category.key}
					data-category-label={category.label}
				>
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<ColorPicker
							bind:value={category.color}
							label={category.label}
							disabled={categoryControlsDisabled}
						/>
						<Input
							bind:value={category.label}
							maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
							class="min-w-0 flex-1"
							disabled={categoryControlsDisabled}
						/>
						<span
							data-testid="gift-category-used-count"
							class="w-20 shrink-0 text-right text-xs text-muted-foreground"
							>{m.gift_category_usage_compact({ count: usedCount })}</span
						>
					</div>
					<Button
						type="button"
						size="icon-sm"
						intent="ghost"
						disabled={categoryControlsDisabled || index === 0}
						onclick={() => move(index, -1)}
						aria-label={m.move_up()}><ArrowUpIcon /></Button
					>
					<Button
						type="button"
						size="icon-sm"
						intent="ghost"
						disabled={categoryControlsDisabled || index === customDrafts.length - 1}
						onclick={() => move(index, 1)}
						aria-label={m.move_down()}><ArrowDownIcon /></Button
					>
					<Button
						type="button"
						size="icon-sm"
						intent="ghost"
						disabled={categoryControlsDisabled}
						onclick={(event) => requestCustomRemoval(category, event.currentTarget)}
						aria-label={m.delete()}><TrashIcon /></Button
					>
				</div>
			{/each}
		{/if}
	</div>

	<div class="flex flex-col gap-3">
		<h3 class="text-base font-semibold">{m.gift_categories_presets_title()}</h3>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each GIFT_CATEGORY_PRESETS as preset (preset.key)}
				{@const checked = enabledPresets.includes(preset.key)}
				{@const label = preset.labels[getLocale().startsWith('en') ? 'en' : 'cs']}
				{@const usedCount =
					categories.find((category) => category.presetKey === preset.key)?.usedCount ??
					0}
				{@const accentColor = checked
					? (presetColors[preset.key] ?? preset.color)
					: preset.color}
				<div
					class="flex items-center gap-3 rounded-lg border border-border border-l-4 bg-surface px-3 py-2 text-sm font-semibold"
					style:border-left-color={accentColor}
					data-testid="gift-category-settings-card"
					data-category-label={label}
				>
					<Checkbox
						id={`gift-category-preset-${preset.key}`}
						{checked}
						disabled={categoryControlsDisabled}
						onCheckedChange={(value) =>
							togglePreset(preset.key, value === true, label, usedCount)}
					/>
					<label class="min-w-0 flex-1" for={`gift-category-preset-${preset.key}`}
						>{label}</label
					>
					{#if checked}
						<ColorPicker
							value={presetColors[preset.key] ?? preset.color}
							onValueChange={(value) => (presetColors[preset.key] = value)}
							{label}
							disabled={categoryControlsDisabled}
						/>
						<span
							data-testid="gift-category-used-count"
							class="w-20 shrink-0 text-right text-xs font-normal text-muted-foreground"
							>{m.gift_category_usage_compact({ count: usedCount })}</span
						>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</form>

<Dialog.Root
	open={pendingRemoval !== null}
	onOpenChange={(open: boolean) => {
		if (open === false) pendingRemoval = null;
	}}
>
	<Dialog.Content size="md" onCloseAutoFocus={restoreRemovalTrigger}>
		<Dialog.Header>
			<Dialog.Title>
				{m.gift_category_remove_confirm_title({ category: pendingRemoval?.label ?? '' })}
			</Dialog.Title>
			<Dialog.Description>
				{m.gift_category_remove_confirm_description({
					count: pendingRemoval?.usedCount ?? 0,
				})}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button type="button" intent="outline" onclick={() => (pendingRemoval = null)}>
				{m.cancel()}
			</Button>
			<Button
				type="button"
				intent="danger"
				data-testid="gift-category-remove-confirm"
				onclick={confirmRemoval}
			>
				{m.gift_category_remove_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
