import {
	CIRCULAR_STICKER_OWNER_CLASSES,
	CIRCULAR_STICKER_SURFACE_CLASSES,
} from '$lib/components/base/button/button_variants.js';

export const overlayCloseButtonClass = `absolute top-4 right-4 size-(--size-control-lg) rounded-full ${CIRCULAR_STICKER_OWNER_CLASSES}`;
export const overlayCloseButtonSurfaceClass = `dialog-close-surface border-[2.5px] border-ink bg-card text-ink hover:bg-card hover:text-ink [&_svg]:size-4 [&_svg]:transition-[rotate] [&_svg]:duration-(--duration-normal) [&_svg]:ease-(--ease-standard) [&_svg]:delay-0 ${CIRCULAR_STICKER_SURFACE_CLASSES}`;
