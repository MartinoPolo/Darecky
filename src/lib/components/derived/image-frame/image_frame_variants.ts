import { tv } from 'tailwind-variants';

export const imageFrameVariants = tv({
	slots: {
		root: 'relative isolate block overflow-hidden bg-[var(--frame-fill)]',
		image: 'relative z-10 block size-full',
		fallback: 'flex size-full flex-col items-center justify-center gap-2 text-center',
		fallbackIcon: 'text-4xl leading-none text-primary',
		fallbackLabel: 'text-xs text-muted-foreground',
		skeleton: 'absolute inset-0 z-0 size-full rounded-none',
	},
	variants: {
		/** Concrete fit applied to the image (after `auto` has been resolved). */
		fit: {
			/* Letterboxed photos keep breathing room so the frame fill (or a parent's
			   dotted mat) reads as a passe-partout (Redesign 2026 round-2 delta). */
			'contain-padded': { image: 'object-contain p-2' },
			'cover-crop': { image: 'object-cover' },
		},
		shape: {
			square: { root: 'rounded-md' },
			circle: { root: 'rounded-full' },
		},
		interactive: {
			true: {
				root: 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
			},
			false: {},
		},
		// Ordinary load progress is a backdrop so an SSR-painted image stays visible
		// before hydration resolves it. Explicit parent loading remains a true cover.
		loadingOverlay: {
			true: { skeleton: 'z-20' },
			false: {},
		},
	},
	defaultVariants: {
		fit: 'cover-crop',
		shape: 'square',
		interactive: false,
		loadingOverlay: false,
	},
});

/** Resolved fit values usable as a variant axis (excludes `auto`). */
export type ImageFrameResolvedFit = keyof typeof imageFrameVariants.variants.fit;

export type ImageFrameShape = keyof typeof imageFrameVariants.variants.shape;
