import { tv } from 'tailwind-variants';

export const imageUploadVariants = tv({
	slots: {
		root: 'relative flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors',
		label: 'text-sm font-medium text-muted-foreground',
		preview: 'rounded-md object-cover',
		progressBar: 'h-2 rounded-full bg-primary transition-all',
		progressTrack: 'h-2 w-full rounded-full bg-muted',
		errorText: 'text-sm text-destructive',
		removeButtonOwner:
			'absolute top-2 right-2 flex size-6 items-center justify-center rounded-full',
		removeButtonSurface: 'bg-destructive text-destructive-foreground shadow-sm',
	},
	variants: {
		state: {
			idle: {
				root: 'cursor-pointer border-muted-foreground/25 hover:border-primary/50 hover:bg-surface-hover',
			},
			dragover: {
				root: 'border-primary bg-primary/10',
			},
			uploading: {
				root: 'cursor-not-allowed border-primary/30 bg-primary/5',
			},
			complete: {
				root: 'border-primary/50',
			},
			error: {
				root: 'border-destructive/50 bg-destructive/5',
			},
		},
		size: {
			compact: {
				root: 'h-9 flex-row gap-2 rounded-md border border-solid px-3 py-2 text-sm font-medium shadow-xs',
				label: 'text-sm font-medium text-foreground',
			},
			small: {
				root: 'p-4',
				preview: 'max-h-24 max-w-24',
			},
			medium: {
				root: 'p-6',
				preview: 'max-h-40 max-w-40',
			},
			large: {
				root: 'p-8',
				preview: 'max-h-64 max-w-full',
			},
		},
	},
	defaultVariants: {
		state: 'idle',
		size: 'medium',
	},
});

/** @public */
export type ImageUploadState = keyof typeof imageUploadVariants.variants.state;
export type ImageUploadSize = keyof typeof imageUploadVariants.variants.size;
