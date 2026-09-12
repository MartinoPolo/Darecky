<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import {
		coverWindowLayout,
		resolveAutoFit,
		resolveFrameFill,
		hasExplicitFrameFill,
		IMAGE_FIT_MODES,
		type ImageFitMode,
		type ImageTokenScope,
	} from './image_frame_fit.js';
	import {
		imageFrameVariants,
		type ImageFrameShape,
		type ImageFrameResolvedFit,
	} from './image_frame_variants.js';
	import type { ImageFocalPoint } from '$lib/modules/images/types.js';
	import { transformedImageUrl, type ImageVariant } from '$lib/modules/images/variants.js';

	/**
	 * Fixed box shown for a `natural` frame while loading or falling back – its
	 * eventual natural size is unknown until the image decodes, so there is no
	 * "real" size to skeleton toward.
	 */
	const NATURAL_PLACEHOLDER_CLASS = 'aspect-square w-full max-w-[280px]';

	interface Props {
		/** Image source. Null/empty renders the themed fallback. */
		src?: string | null;
		/** Accessible description. Empty string marks the image as decorative. */
		alt: string;
		/**
		 * Size-appropriate delivery variant (issue #107). When set, the frame loads
		 * a width-bounded Cloudflare transformation of `src` (falling back to the
		 * original if the transformation fails); when null, the original loads.
		 */
		variant?: ImageVariant | null;
		/**
		 * Loads the image eagerly (above-the-fold surfaces like the page banner).
		 * Everything else lazy-loads and decodes asynchronously (issue #107).
		 */
		eagerLoading?: boolean;
		/** Fit strategy for the box (REQ-1). */
		fitMode?: ImageFitMode;
		/** Focal point (%) honored in cover-crop. */
		focal?: ImageFocalPoint;
		/** Zoom factor (1 = 100%) honored in cover-crop, magnifying toward the focal point. */
		zoom?: number;
		/** Extracted/manual dominant color – tier 1 of the fill chain (REQ-3). */
		fillColor?: string | null;
		/** Scopes the tier-2 fill to the wishlist or the global surface (REQ-3). */
		tokenScope?: ImageTokenScope;
		/** Emoji shown in the empty/error fallback (REQ-4). */
		fallbackEmoji?: string;
		/** Optional faint label under the fallback emoji. */
		fallbackLabel?: string;
		/** Box shape – square inherits radius, circle for avatars. */
		shape?: ImageFrameShape;
		/** Adds keyboard focusability + focus-visible ring (e.g. opens a crop editor). */
		interactive?: boolean;
		/**
		 * Renders the image at its natural size — uncropped, ignoring
		 * `fitMode`/`focal`/`zoom` entirely (issue #183 REQ-10). The frame box
		 * shrink-wraps around the rendered image instead of stretching it to fill
		 * a fixed box, so `class` should cap the image directly (e.g.
		 * `max-h-[480px] max-w-full`) and the browser scales it down preserving
		 * its aspect ratio. Used by the visitor gift detail view, which stops
		 * being a crop-target consumer.
		 */
		natural?: boolean;
		/** Force the loading skeleton (e.g. parent still fetching before `src` exists). */
		loading?: boolean;
		/** Fires once the image genuinely fails to load (after any transformed-variant retry). Lets a
		 *  consumer (e.g. Avatar) swap to a fallback other than this frame's own emoji tile. */
		onerror?: () => void;
		/**
		 * Referrer policy for the underlying `<img>`. Avatars pass `no-referrer` so external
		 * Google profile-picture URLs (lh3.googleusercontent.com) don't 403: Google's CDN
		 * rejects avatar requests that carry a foreign `Referer`, which the app's global
		 * `strict-origin-when-cross-origin` policy would otherwise send (issue #158).
		 */
		referrerPolicy?: ReferrerPolicy;
		class?: string;
	}

	let {
		src = null,
		alt,
		variant = null,
		eagerLoading = false,
		fitMode = IMAGE_FIT_MODES.auto,
		focal = { x: 50, y: 50 },
		zoom = 1,
		fillColor = null,
		tokenScope = 'global',
		fallbackEmoji = '🎁',
		fallbackLabel,
		shape = 'square',
		interactive = false,
		natural = false,
		loading = false,
		onerror,
		referrerPolicy,
		class: className,
	}: Props = $props();

	// Load progress is tracked against the current `src` so it resets automatically
	// (via $derived) whenever the source changes – no state-syncing $effect needed.
	let loadedSrc = $state<string | null>(null);
	let erroredSrc = $state<string | null>(null);
	// Transformation delivery is fail-open: when the variant URL errors (e.g. the
	// free-tier transformation quota is exhausted), the frame retries the original.
	let transformFailedSrc = $state<string | null>(null);
	let measured = $state<{ src: string; ratio: number } | null>(null);
	let boxWidth = $state(0);
	let boxHeight = $state(0);

	const hasSrc = $derived(src !== null && src.trim() !== '');
	const displaySrc = $derived(
		!hasSrc || transformFailedSrc === src ? src : transformedImageUrl(src, variant),
	);
	const errored = $derived(hasSrc && erroredSrc === src);
	// Skeleton shows while the image is in flight, or when the parent forces it.
	const pending = $derived(hasSrc && loadedSrc !== src && erroredSrc !== src);
	const showSkeleton = $derived(loading || pending);
	const naturalRatio = $derived(
		measured !== null && measured.src === src ? measured.ratio : null,
	);

	const frameFill = $derived(resolveFrameFill({ fillColor, tokenScope }));
	const explicitFillClass = $derived(
		hasExplicitFrameFill(fillColor) ? 'bg-[var(--frame-fill)]' : undefined,
	);
	// Loading takes precedence over the empty/error fallback.
	const showFallback = $derived(!showSkeleton && (!hasSrc || errored));

	const effectiveFit = $derived<ImageFrameResolvedFit>(
		fitMode === IMAGE_FIT_MODES.auto
			? naturalRatio !== null && boxWidth > 0 && boxHeight > 0
				? resolveAutoFit(naturalRatio, boxWidth / boxHeight)
				: IMAGE_FIT_MODES.coverCrop
			: fitMode,
	);

	const styles = $derived(
		imageFrameVariants({ fit: effectiveFit, shape, interactive, loadingOverlay: loading }),
	);

	// Zoomed OUT below the cover baseline (#116 round 2): object-fit clips to the
	// element box, so the source window is rendered by positioning the image
	// explicitly – the frame fill letterboxes the overhang on one axis. Null until
	// the box/natural ratio are measured (the loading skeleton covers that gap).
	const zoomOutLayout = $derived(
		effectiveFit === IMAGE_FIT_MODES.coverCrop && zoom < 1 && naturalRatio !== null
			? coverWindowLayout({ focal, zoom, boxWidth, boxHeight, naturalRatio })
			: null,
	);

	// Natural mode (REQ-10): the frame box shrink-wraps around the rendered image
	// once it loads (or shows a fixed placeholder while loading/falling back,
	// since the eventual natural size is unknown until then); `className`
	// applies to the `<img>` directly instead of the box so the caller's cap
	// (e.g. `max-h-[480px] max-w-full`) does the actual scaling.
	const rootClass = $derived(
		natural
			? cn(
					styles.root(),
					showFallback || showSkeleton ? NATURAL_PLACEHOLDER_CLASS : 'inline-block',
					explicitFillClass,
				)
			: cn(styles.root(), className, explicitFillClass),
	);
	const imageClass = $derived(
		natural
			? cn('relative z-10 block h-auto w-auto object-contain', className)
			: zoomOutLayout !== null
				? 'absolute z-10 max-w-none'
				: styles.image(),
	);

	// cover-crop honors the focal point (object-position) and an optional zoom that
	// magnifies toward that same point – together they reproduce a saved manual crop.
	const imageStyle = $derived.by(() => {
		if (natural) {
			return undefined;
		}
		if (zoomOutLayout !== null) {
			return (
				`left: ${zoomOutLayout.left}px; top: ${zoomOutLayout.top}px;` +
				` width: ${zoomOutLayout.width}px; height: ${zoomOutLayout.height}px;`
			);
		}
		if (effectiveFit !== IMAGE_FIT_MODES.coverCrop) {
			return undefined;
		}
		return (
			`object-position: ${focal.x}% ${focal.y}%;` +
			(zoom > 1
				? ` transform: scale(${zoom}); transform-origin: ${focal.x}% ${focal.y}%;`
				: '')
		);
	});

	const fallbackText = $derived(alt !== '' ? alt : (fallbackLabel ?? m.image_frame_no_image()));

	const interactiveAttrs = $derived(
		interactive ? { role: 'button', tabindex: 0, 'aria-label': alt || fallbackText } : {},
	);

	function markLoaded(img: HTMLImageElement) {
		if (src !== null && img.naturalWidth > 0 && img.naturalHeight > 0) {
			measured = { src, ratio: img.naturalWidth / img.naturalHeight };
		}
		loadedSrc = src;
	}

	function markErrored() {
		if (displaySrc !== src) {
			// The transformed variant failed – fall back to the original (REQ-3).
			transformFailedSrc = src;
		} else {
			erroredSrc = src;
			onerror?.();
		}
	}

	// A cached or SSR-rendered image can finish loading in the gap between the server
	// paint and client hydration, so framework-wired `onload`/`onerror` handlers (added
	// during hydration) may miss the event entirely and leave the skeleton stuck. This
	// attachment registers its listeners the moment the element mounts and reconciles
	// the already-`complete` case, closing that race.
	function trackImageLoad(img: HTMLImageElement) {
		const onLoad = () => markLoaded(img);
		const onError = () => {
			markErrored();
		};
		if (img.complete) {
			if (img.naturalWidth > 0) {
				onLoad();
			} else {
				onError();
			}
		}
		img.addEventListener('load', onLoad);
		img.addEventListener('error', onError);
		return () => {
			img.removeEventListener('load', onLoad);
			img.removeEventListener('error', onError);
		};
	}
</script>

<div
	class={rootClass}
	data-testid="image-frame"
	style:--frame-fill={frameFill}
	bind:clientWidth={boxWidth}
	bind:clientHeight={boxHeight}
	{...interactiveAttrs}
>
	{#if showFallback}
		<div class={styles.fallback()} role="img" aria-label={fallbackText}>
			<span class={styles.fallbackIcon()} aria-hidden="true">{fallbackEmoji}</span>
			{#if fallbackLabel}
				<span class={styles.fallbackLabel()}>{fallbackLabel}</span>
			{/if}
		</div>
	{:else}
		{#if showSkeleton}
			<Skeleton
				class={styles.skeleton()}
				style="background-color: var(--frame-fill)"
				role="status"
				aria-label={m.image_frame_loading()}
			/>
		{/if}
		{#if hasSrc}
			<img
				{@attach trackImageLoad}
				class={imageClass}
				style={imageStyle}
				src={displaySrc}
				{alt}
				loading={eagerLoading ? 'eager' : 'lazy'}
				decoding="async"
				referrerpolicy={referrerPolicy}
				aria-hidden={alt === '' ? 'true' : undefined}
			/>
		{/if}
	{/if}
</div>
