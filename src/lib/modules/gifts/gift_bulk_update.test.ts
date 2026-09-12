import { describe, expect, it } from 'vitest';
import { bulkGiftUpdateData, isBulkPresentationAction } from './gift_bulk_update.js';
import type { BulkUpdateGiftsInput } from './types.js';
import { fillImageMeta } from '$lib/modules/images/editor_modes.js';

const presentationActionCases = [
	[{ action: 'priority', priorityLevelId: null, wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'category', categoryId: null, wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'imageFit', fit: 'fill', wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'imageBackground', background: null, wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'received', received: true, wishlistId: 'w', giftIds: ['g'] }, false],
] satisfies Array<[BulkUpdateGiftsInput, boolean]>;

describe('bulk gift updates', () => {
	it.each(presentationActionCases)(
		'classifies $0.action presentation semantics as $1',
		(input, expected) => {
			expect(isBulkPresentationAction(input)).toBe(expected);
		},
	);

	it('restores each gift from its exact heterogeneous received prior-state map', () => {
		const input = {
			action: 'restoreReceived' as const,
			states: { a: true, b: false },
			wishlistId: 'w',
			giftIds: ['a', 'b'],
		};
		expect(bulkGiftUpdateData(input, { id: 'a', imageMeta: null })).toEqual({ received: true });
		expect(bulkGiftUpdateData(input, { id: 'b', imageMeta: null })).toEqual({
			received: false,
		});
	});

	it('explicit Fit clears manual crops while preserving the gift background', () => {
		expect(
			bulkGiftUpdateData(
				{ action: 'imageFit', fit: 'fit', wishlistId: 'w', giftIds: ['g'] },
				{ imageMeta: { ...fillImageMeta('#000000'), targets: { square: {} as never } } },
			),
		).toMatchObject({
			imageMeta: { fitMode: 'contain-padded', bgColor: '#000000', targets: undefined },
		});
	});

	it('changing image background preserves existing fit and crop metadata', () => {
		const imageMeta = fillImageMeta();
		expect(
			bulkGiftUpdateData(
				{
					action: 'imageBackground',
					background: '#ffffff',
					wishlistId: 'w',
					giftIds: ['g'],
				},
				{ imageMeta },
			),
		).toEqual({ imageMeta: { ...imageMeta, bgColor: '#ffffff' } });
	});
});
