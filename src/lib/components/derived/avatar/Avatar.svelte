<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { ImageFrame } from '$lib/components/derived/image-frame/index.js';
	import {
		avatarVariants,
		type AvatarAppearance,
		type AvatarShape,
		type AvatarSize,
	} from './avatar_variants.js';

	interface Props {
		/** Image source. Null/empty renders the initials fallback. */
		src?: string | null;
		/** Accessible description. Empty string marks the avatar as decorative. */
		alt: string;
		/** Fallback text (user initials) shown when no image is available. */
		initials: string;
		/** Box size – `sm` (32px) matches the header icon controls. */
		size?: AvatarSize;
		/** Crop shape. The default remains the established rounded square. */
		shape?: AvatarShape;
		/** Ink border + sticker shadow so the avatar matches neighboring header buttons. */
		bordered?: boolean;
		/** Descriptive visual treatment for a known shared placement. */
		appearance?: AvatarAppearance;
		class?: string;
	}

	let {
		src = null,
		alt,
		initials,
		size = 'sm',
		shape = 'square',
		bordered = false,
		appearance = 'default',
		class: className,
	}: Props = $props();

	// Tracks the src that failed to load (e.g. a revoked Google profile picture URL) so a broken
	// image falls back to the initials chip instead of ImageFrame's own generic emoji tile.
	// Comparing against the live `src` – rather than a boolean – auto-resets the moment the prop
	// changes, mirroring ImageFrame's own erroredSrc tracking.
	let erroredSrc = $state<string | null>(null);

	const hasSrc = $derived(src !== null && src.trim() !== '' && src !== erroredSrc);
	const styles = $derived(avatarVariants({ size, shape, bordered, appearance }));
</script>

<span data-slot="avatar" class={cn(styles.root(), className)}>
	{#if hasSrc}
		<ImageFrame
			{src}
			{alt}
			{shape}
			fitMode="cover-crop"
			referrerPolicy="no-referrer"
			class={styles.image()}
			onerror={() => (erroredSrc = src)}
		/>
	{:else}
		<span
			class={styles.fallback()}
			role={alt === '' ? undefined : 'img'}
			aria-label={alt === '' ? undefined : alt}
			aria-hidden={alt === '' ? 'true' : undefined}
		>
			{initials}
		</span>
	{/if}
</span>
