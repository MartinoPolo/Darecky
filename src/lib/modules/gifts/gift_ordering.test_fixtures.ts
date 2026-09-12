import type { GiftForVisitor } from './types.js';
import type { GiftSection } from './gift_ordering.js';

let idCounter = 0;

export function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	idCounter += 1;
	return {
		id: `gift-${idCounter}`,
		wishlistId: 'wishlist-1',
		name: `Gift ${idCounter}`,
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: idCounter,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

/** All gift ids across every section, in flattened render order. */
export function flatIds(sections: GiftSection[]): string[] {
	return sections.flatMap((section) => section.gifts.map((gift) => gift.id));
}

export const LOCALE = 'cs';
