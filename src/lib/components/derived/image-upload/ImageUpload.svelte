<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { uploadFile } from '$lib/modules/uploads/upload.js';
	import type { UploadTarget } from '$lib/server/storage/r2.js';
	import { ALLOWED_CONTENT_TYPES } from '$lib/modules/uploads/types.js';
	import type { UploadResult, UploadProgress } from '$lib/modules/uploads/types.js';
	import { imageUploadVariants, type ImageUploadSize } from './image_upload_variants.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		/** Upload target (determines R2 path prefix and size limits). */
		target: UploadTarget;
		/** Allowed MIME types. Defaults to all image types. */
		accept?: string;
		/** Maximum file size in bytes. Overrides the default for the target if set. */
		maxSize?: number;
		/** Component size variant. */
		size?: ImageUploadSize;
		/** Optional visible and accessible label for compact upload actions. */
		label?: string;
		/** Existing image shown as the initial preview (edit mode); replaced on upload. */
		initialPreviewUrl?: string;
		/** Called when upload completes successfully. */
		onUpload?: (result: UploadResult) => void;
		/** Called when an error occurs. */
		onError?: (error: Error) => void;
		/** Called when the user clears the current image (so callers can drop the key/url). */
		onRemove?: () => void;
		/** Additional CSS classes. */
		class?: string;
	}

	let {
		target,
		accept = ALLOWED_CONTENT_TYPES.join(','),
		maxSize,
		size = 'medium',
		label,
		initialPreviewUrl,
		onUpload,
		onError,
		onRemove,
		class: className,
	}: Props = $props();

	let fileInputElement: HTMLInputElement | undefined = $state(undefined);
	let isDragOver = $state(false);
	// Seed from the existing image (edit mode). A real http(s) URL here, not a blob –
	// the revoke-on-cleanup calls below are harmless no-ops for non-blob URLs.
	// svelte-ignore state_referenced_locally
	let previewUrl = $state<string | undefined>(initialPreviewUrl);
	let activeAbortController: AbortController | null = null;
	let progress = $state<UploadProgress>({
		status: 'idle',
		percentage: 0,
	});

	const currentState = $derived(
		isDragOver
			? 'dragover'
			: progress.status === 'uploading'
				? 'uploading'
				: progress.status === 'complete'
					? 'complete'
					: progress.status === 'error'
						? 'error'
						: 'idle',
	);

	const styles = $derived(imageUploadVariants({ state: currentState, size }));

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		const file = event.dataTransfer?.files[0];
		if (file != null) {
			void processFile(file);
		}
	}

	function handleClick() {
		if (progress.status !== 'uploading') {
			fileInputElement?.click();
		}
	}

	/** Opens the native file picker programmatically (e.g. from an external click-to-edit affordance). */
	export function openFilePicker(): void {
		handleClick();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file != null) {
			void processFile(file);
		}
		// Reset input so re-selecting the same file triggers change
		input.value = '';
	}

	async function processFile(file: File) {
		// Client-side max size check
		if (maxSize != null && file.size > maxSize) {
			const maxMb = Math.round(maxSize / (1024 * 1024));
			const fileError = new Error(`File too large. Maximum size: ${String(maxMb)}MB`);
			progress = { status: 'error', percentage: 0, errorMessage: fileError.message };
			onError?.(fileError);
			return;
		}

		// Generate preview
		if (previewUrl != null) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = URL.createObjectURL(file);

		activeAbortController = new AbortController();

		try {
			const result = await uploadFile(
				file,
				target,
				(uploadProgress) => {
					progress = uploadProgress;
				},
				activeAbortController.signal,
			);
			onUpload?.(result);
		} catch (thrown) {
			const uploadError = thrown instanceof Error ? thrown : new Error('Upload failed');
			onError?.(uploadError);
		} finally {
			activeAbortController = null;
		}
	}

	function handleRemove(event: MouseEvent) {
		event.stopPropagation();
		if (previewUrl != null) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = undefined;
		progress = { status: 'idle', percentage: 0 };
		onRemove?.();
	}

	// Unmount guard – manual revokes in handlers cover the normal case
	$effect(() => {
		const url = previewUrl;
		return () => {
			if (url != null) {
				URL.revokeObjectURL(url);
			}
		};
	});

	$effect(() => {
		return () => {
			activeAbortController?.abort();
		};
	});
</script>

<div
	class={cn(styles.root(), className)}
	role="button"
	aria-label={label ?? m.image_upload_aria()}
	tabindex={progress.status === 'uploading' ? -1 : 0}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	<input
		bind:this={fileInputElement}
		type="file"
		{accept}
		class="sr-only"
		onchange={handleFileSelect}
		tabindex={-1}
	/>

	{#if previewUrl}
		<img
			src={previewUrl}
			alt={m.image_upload_preview_alt()}
			class={styles.preview()}
			data-testid="image-upload-preview"
		/>

		{#if progress.status !== 'uploading'}
			<Button
				size="icon-sm"
				intent="ghost"
				class={styles.removeButtonOwner()}
				surfaceClass={styles.removeButtonSurface()}
				onclick={handleRemove}
				aria-label={m.image_upload_remove()}
			>
				<XIcon data-icon="solo" />
			</Button>
		{/if}
	{:else}
		<UploadIcon class={size === 'compact' ? 'size-4' : 'size-8 text-muted-foreground'} />
		<p class={styles.label()}>{label ?? m.image_upload_dropzone()}</p>
	{/if}

	{#if progress.status === 'uploading'}
		<div class={styles.progressTrack()}>
			<div class={styles.progressBar()} style:width="{String(progress.percentage)}%"></div>
		</div>
	{/if}

	{#if progress.status === 'error' && progress.errorMessage}
		<p class={styles.errorText()}>{progress.errorMessage}</p>
	{/if}
</div>
