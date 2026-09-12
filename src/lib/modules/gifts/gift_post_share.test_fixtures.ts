import type { PreShareGiftSnapshot } from './gift_post_share.js';
import type { UpdateGiftInput } from './types.js';

export const NOW = new Date('2024-02-01T12:00:00.000Z');

export function makeCurrent(overrides: Partial<PreShareGiftSnapshot> = {}): PreShareGiftSnapshot {
	return {
		name: 'Camera',
		description: null,
		descriptionAppends: [],
		quantity: 3,
		price: 1000,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		links: [],
		priorityLevelId: null,
		...overrides,
	};
}

export function makeInput(overrides: Partial<UpdateGiftInput> = {}): UpdateGiftInput {
	return { id: 'gift-1', ...overrides };
}
