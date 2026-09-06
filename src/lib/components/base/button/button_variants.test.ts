import { describe, expect, it } from 'vitest';
import {
	ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES,
	BUTTON_ICON_SIZES,
	BUTTON_TEXT_SIZES,
	buttonVariants,
	CIRCULAR_STICKER_OWNER_CLASSES,
	CIRCULAR_STICKER_SURFACE_CLASSES,
} from './button_variants.js';
import {
	overlayCloseButtonClass,
	overlayCloseButtonSurfaceClass,
} from '../dialog/dialog_close_button.js';
import { giftDetailModalVariants } from '../../blocks/gift/gift_detail_modal_variants.js';
import { giftCardVariants } from '../../blocks/gift/gift_card_variants.js';
import { wishlistCardVariants } from '../../blocks/dashboard/wishlist_card_variants.js';

const RAISED_INTENTS = [
	'primary',
	'secondary',
	'danger',
	'primary-destructive',
	'outline',
] as const;

describe('button elevation structure', () => {
	it('keeps raised owners stationary while the surface owns paint and motion', () => {
		for (const intent of RAISED_INTENTS) {
			const classes = buttonVariants({ intent, size: 'md' });
			expect(classes.owner()).toContain('elevation-owner');
			expect(classes.owner()).toContain('elevation-owner-raised');
			expect(classes.owner()).toContain('elevation-owner-anchored');
			expect(classes.owner()).not.toMatch(/bg-|border-|shadow-|translate-|scale-/);
			expect(classes.surface()).toContain('elevation-surface');
			expect(classes.surface()).toMatch(/group-hover(?:\/[^:]+)?:/);
			expect(classes.surface()).not.toMatch(/(?:^|\s)hover:/);
			expect(classes.surface()).not.toContain('elevation-owner');
		}
	});

	it('keeps the sticker constants split between owner geometry and surface paint', () => {
		expect(CIRCULAR_STICKER_OWNER_CLASSES).toContain('elevation-owner');
		expect(CIRCULAR_STICKER_OWNER_CLASSES).toContain('elevation-owner-raised');
		expect(CIRCULAR_STICKER_SURFACE_CLASSES).toContain('elevation-surface');
		expect(ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES).toContain('elevation-owner-anchored');
		expect(ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES).toContain('elevation-owner-raised');
	});

	it('keeps text sizes on the owner height and the surface padding', () => {
		for (const size of BUTTON_TEXT_SIZES) {
			const classes = buttonVariants({ intent: 'primary', size });
			expect(classes.owner()).toContain(
				size === 'sm'
					? 'h-(--size-control-sm)'
					: size === 'md'
						? 'h-(--size-control-md)'
						: size === 'lg'
							? 'h-(--size-control-lg)'
							: 'h-(--size-control-xl)',
			);
			expect(classes.surface()).toMatch(/px-[23.5]|px-4|px-5/);
		}
	});

	it('keeps icon sizes on the owner and the surface padding reset', () => {
		for (const size of BUTTON_ICON_SIZES) {
			const classes = buttonVariants({ intent: 'primary', size });
			expect(classes.owner()).toContain(
				size === 'icon' ? 'size-(--size-control-md)' : 'size-(--size-control-sm)',
			);
			expect(classes.surface()).toContain('p-0');
		}
	});

	it('keeps the overlay close button geometry on the owner and rotation on the surface', () => {
		expect(overlayCloseButtonClass).toContain('absolute');
		expect(overlayCloseButtonClass).toContain('top-4');
		expect(overlayCloseButtonClass).toContain('right-4');
		expect(overlayCloseButtonClass).toContain('rounded-full');
		expect(overlayCloseButtonSurfaceClass).toContain('dialog-close-surface');
		expect(overlayCloseButtonSurfaceClass).toContain('border-ink');
		expect(overlayCloseButtonSurfaceClass).toContain('bg-card');
		expect(overlayCloseButtonSurfaceClass).toContain('[&_svg]:size-4');
		expect(overlayCloseButtonSurfaceClass).toContain('[&_svg]:transition-[rotate]');
		expect(overlayCloseButtonSurfaceClass).not.toContain('group-hover');
		expect(overlayCloseButtonSurfaceClass).not.toContain('motion-reduce');
	});

	it('keeps stacked gift-detail buttons free of transform and counter-motion classes', () => {
		expect(giftDetailModalVariants().submitButton()).not.toMatch(
			/translate|scale|motion-reduce/,
		);
		expect(giftDetailModalVariants().releaseButton()).not.toMatch(
			/translate|scale|motion-reduce/,
		);
	});

	it('keeps moving card plates on the plate instead of the root', () => {
		const giftCard = giftCardVariants({ dimmed: false });
		expect(giftCard.card()).toContain('elevation-owner');
		expect(giftCard.card()).toContain('elevation-owner-raised');
		expect(giftCard.card()).not.toMatch(/border-|translate-|scale-/);
		expect(giftCard.plate()).toContain('elevation-ordinary');
		expect(giftCard.plate()).toContain('border-[2.5px]');
		expect(giftCard.plate()).toContain('border-ink');
		expect(giftCard.plate()).toContain('rounded-panel');
		expect(giftCard.plate()).toContain('transition-[translate,scale,box-shadow]');
		expect(giftCard.plate()).toMatch(/group-hover\/gift-card/);
		expect(giftCard.plate()).not.toContain('hover:-translate-y-0.5');
		expect(giftCard.plate()).not.toContain('focus-within:-translate-y-0.5');

		const dimmedGiftCard = giftCardVariants({ dimmed: true });
		expect(dimmedGiftCard.card()).not.toContain('elevation-owner');
		expect(dimmedGiftCard.card()).not.toContain('elevation-owner-raised');

		const wishlistCard = wishlistCardVariants({ archived: false });
		expect(wishlistCard.root()).toContain('elevation-owner');
		expect(wishlistCard.root()).toContain('elevation-owner-raised');
		expect(wishlistCard.root()).not.toMatch(/border-|translate-|scale-/);
		expect(wishlistCard.plate()).toContain('elevation-ordinary');
		expect(wishlistCard.plate()).toContain('border-[2.5px]');
		expect(wishlistCard.plate()).toContain('border-ink');
		expect(wishlistCard.plate()).toContain('rounded-panel');
		expect(wishlistCard.plate()).toContain('transition-[translate,scale,box-shadow]');
		expect(wishlistCard.plate()).not.toContain('hover:-translate-y-0.5');
		expect(wishlistCard.plate()).not.toContain('focus-within:-translate-y-0.5');

		const archivedWishlistCard = wishlistCardVariants({ archived: true });
		expect(archivedWishlistCard.root()).not.toContain('elevation-owner');
		expect(archivedWishlistCard.root()).not.toContain('elevation-owner-raised');
	});
});
