/**
 * Hand-written fixture data for the landing page's interactive demo (issue #218).
 *
 * Nothing here touches the database, a remote function, or the session: the demo is a
 * pure client-side illustration of the product's core invariant (gifters see reservation
 * state, the recipient never does). The single exception lives outside this file — like
 * counts are real and shared, so they are passed in rather than hard-coded. Copy is
 * resolved through Paraglide at call time, so
 * every builder below is a function — calling it at module scope would freeze the fixtures
 * to whichever locale happened to load first.
 */
import { asset } from '$app/paths';
import { IMAGE_FIT_MODES } from '$lib/modules/images/fit_modes.js';
import type {
	ImageFocalPoint,
	ImageMetadata,
	WishlistImageSlots,
} from '$lib/modules/images/types.js';
import type { GiftForRecipient, GiftForVisitor, GiftLink } from '$lib/modules/gifts/types.js';
import {
	LANDING_DEMO_PAIR_GIFT_ID,
	type LandingDemoGiftSlug,
} from '$lib/modules/landing/landing_demo_gift_slugs.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';

const LANDING_DEMO_WISHLIST_ID = 'landing-demo-wishlist';

/** Fixed date so server and client render the identical fixture (no hydration mismatch). */
const LANDING_DEMO_CREATED_AT = new Date('2026-01-01T00:00:00Z');

/**
 * Cover-crop metadata for one demo photo. The gift card renders 4:3 and the list thumb
 * 1:1 from the SAME focal point, so each photo's focal is picked to keep the subject
 * inside both windows; `zoom` stays at the 100 % cover baseline throughout.
 */
function landingDemoImageMeta(focal: ImageFocalPoint, zoom = 1): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.coverCrop,
		cropRect: null,
		focal,
		zoom,
		bgColor: null,
	};
}

/** Centered crop — the subject is centered in the source and survives both windows. */
const LANDING_DEMO_CENTERED_FOCAL: ImageFocalPoint = { x: 50, y: 50 };

interface LandingDemoGiftSeed {
	/** Doubles as the slug the shared like counter is keyed on. */
	id: LandingDemoGiftSlug;
	name: () => string;
	description: () => string;
	price: number;
	imageUrl: string;
	/** Cover-crop focal point in percent; see {@link landingDemoImageMeta}. */
	focal: ImageFocalPoint;
	links: readonly GiftLink[];
}

/** Petra's birthday wishlist — six gifts, warm and ordinary on purpose. */
const LANDING_DEMO_GIFT_SEEDS = [
	{
		id: 'teapot',
		name: () => m.landing_demo_gift_teapot_name(),
		description: () => m.landing_demo_gift_teapot_description(),
		price: 890,
		imageUrl: asset('/demo/v1/teapot.jpg'),
		// Portrait source: the pot sits just below center, so the 4:3 window drops a little.
		focal: { x: 50, y: 56 },
		links: [{ url: 'https://www.alza.cz/' }],
	},
	{
		id: 'headphones',
		name: () => m.landing_demo_gift_headphones_name(),
		description: () => m.landing_demo_gift_headphones_description(),
		price: 2490,
		imageUrl: asset('/demo/v1/headphones.jpg'),
		focal: LANDING_DEMO_CENTERED_FOCAL,
		links: [{ url: 'https://www.alza.cz/' }],
	},
	{
		id: 'plant-book',
		name: () => m.landing_demo_gift_book_name(),
		description: () => m.landing_demo_gift_book_description(),
		price: 399,
		imageUrl: asset('/demo/v1/plant-book.jpg'),
		// Landscape source: the 1:1 thumb window slides left to keep the book, not the leaf.
		focal: { x: 40, y: 50 },
		links: [{ url: 'https://www.knihydobrovsky.cz/' }],
	},
	{
		id: 'candle',
		name: () => m.landing_demo_gift_candle_name(),
		description: () => m.landing_demo_gift_candle_description(),
		price: 650,
		imageUrl: asset('/demo/v1/candle.jpg'),
		// Tall 2:3 source with the hero candle in the lower half.
		focal: { x: 50, y: 62 },
		links: [{ url: 'https://www.notino.cz/' }],
	},
	{
		id: 'backpack',
		name: () => m.landing_demo_gift_backpack_name(),
		description: () => m.landing_demo_gift_backpack_description(),
		price: 1790,
		imageUrl: asset('/demo/v1/backpack.jpg'),
		focal: { x: 50, y: 55 },
		links: [],
	},
	{
		id: 'watercolours',
		name: () => m.landing_demo_gift_watercolours_name(),
		description: () => m.landing_demo_gift_watercolours_description(),
		price: 1290,
		imageUrl: asset('/demo/v1/watercolours.jpg'),
		focal: LANDING_DEMO_CENTERED_FOCAL,
		links: [],
	},
] as const satisfies readonly LandingDemoGiftSeed[];

function buildDemoGift(
	seed: LandingDemoGiftSeed,
	sortOrder: number,
	likeCount: number,
): GiftForVisitor {
	return {
		id: seed.id,
		wishlistId: LANDING_DEMO_WISHLIST_ID,
		name: seed.name(),
		description: seed.description(),
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [...seed.links],
		price: seed.price,
		priceMax: null,
		currency: 'CZK',
		imageUrl: seed.imageUrl,
		imageKey: null,
		imageMeta: landingDemoImageMeta(seed.focal),
		quantity: 1,
		sortOrder,
		received: false,
		createdAt: LANDING_DEMO_CREATED_AT,
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};
}

/** How far ahead the demo event sits, so the countdown chip always renders and never goes stale. */
const LANDING_DEMO_EVENT_DAYS_AHEAD = 21;

/**
 * Crop metadata for the demo cover photo. Only the `thumbnail` slot is populated: the
 * landing hero renders the square polaroid and nothing else consumes this fixture. The
 * source is a wide 3:2 shot with the balloon cluster hard against the left edge, so the
 * square window is zoomed in and pushed left: it frames the balloons plus the first word
 * of the banner instead of the empty wall that dominates the right half.
 */
const LANDING_DEMO_COVER_SLOTS: WishlistImageSlots = {
	thumbnail: landingDemoImageMeta({ x: 5, y: 50 }, 1.35),
};

/**
 * The wishlist the two demo panes belong to, as the real `WishlistHeader` renders it.
 * `role: visitor` is what hides every manager control (share, správci, archive, the edit
 * pencils) without the demo having to opt out of them one by one.
 */
export function createLandingDemoWishlistHeaderProps() {
	return {
		title: m.landing_demo_wishlist_title(),
		recipientDisplayName: m.landing_demo_wishlist_recipient(),
		recipientImage: null,
		isForSomeoneElse: false,
		managerNames: [],
		description: m.landing_demo_wishlist_description(),
		imageKey: null,
		imageSrc: asset('/demo/v1/cover-1.webp'),
		imageSlots: LANDING_DEMO_COVER_SLOTS,
		themeEmoji: '🎂',
		eventDate: new Date(Date.now() + LANDING_DEMO_EVENT_DAYS_AHEAD * 86_400_000),
		status: 'active' as const,
		role: WISHLIST_ROLES.visitor,
		giftCount: LANDING_DEMO_GIFT_SEEDS.length,
		recipientIsModerator: false,
	};
}

/**
 * Live like counts per demo slug. Absent slugs render as zero, which is also shown on a
 * cold start before the counter query resolves and hydration supplies the live count.
 */
export type LandingDemoLikeCounts = Partial<Record<LandingDemoGiftSlug, number>>;

/** The unreserved baseline every demo view derives from. */
export function createLandingDemoGifts(likeCounts: LandingDemoLikeCounts): GiftForVisitor[] {
	return LANDING_DEMO_GIFT_SEEDS.map((seed, sortOrder) =>
		buildDemoGift(seed, sortOrder, likeCounts[seed.id] ?? 0),
	);
}

/**
 * The gift shown twice in the mobile hook. Its own id keeps it addressable
 * independently of the interactive list below, which repeats the same wish — but both
 * copies share one slug, so they show the same count.
 */
export function createLandingDemoPairGift(likeCounts: LandingDemoLikeCounts): GiftForVisitor {
	const seed = LANDING_DEMO_GIFT_SEEDS[0];
	return {
		...buildDemoGift(seed, 0, likeCounts[seed.id] ?? 0),
		id: LANDING_DEMO_PAIR_GIFT_ID,
	};
}

/**
 * The same gift once it is claimed — what a fellow gifter sees. `reservedByViewer` decides
 * whether the demo visitor holds the reservation (and can cancel it) or someone else does.
 */
export function reserveDemoGift(gift: GiftForVisitor, reservedByViewer: boolean): GiftForVisitor {
	return {
		...gift,
		reservedCount: 1,
		isFullyReserved: true,
		// Reserver names reach moderators only; a plain visitor sees the anonymous state.
		reserverNames: [],
		myReservationId: reservedByViewer ? `${gift.id}-reservation` : null,
	};
}

/**
 * Strips every reservation-derived field, exactly as the server does before a recipient
 * ever receives a gift row. The demo drops them on the client too, so the recipient pane
 * cannot render the surprise even by accident.
 */
export function toRecipientView(gift: GiftForVisitor): GiftForRecipient {
	return {
		id: gift.id,
		wishlistId: gift.wishlistId,
		name: gift.name,
		description: gift.description,
		descriptionAppends: gift.descriptionAppends,
		editedAfterShareAt: gift.editedAfterShareAt,
		links: gift.links,
		price: gift.price,
		priceMax: gift.priceMax,
		currency: gift.currency,
		imageUrl: gift.imageUrl,
		imageKey: gift.imageKey,
		imageMeta: gift.imageMeta,
		quantity: gift.quantity,
		sortOrder: gift.sortOrder,
		received: gift.received,
		createdAt: gift.createdAt,
		priorityLevelId: gift.priorityLevelId,
		priorityLabel: gift.priorityLabel,
		prioritySortOrder: gift.prioritySortOrder,
	};
}
