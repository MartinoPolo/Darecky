import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Landing-page interactive demo (issue #218).
 *
 * The section renders a fixture birthday wishlist for "Petra" through the real gift
 * components twice — once as a gifter, once as the recipient — to demonstrate the
 * product's surprise invariant: gifters see reservation state, the recipient never does.
 * Reservations are local Svelte state, so they may never reach the network and a reload
 * must start the visitor over. Likes are the one deliberate exception: the heart writes to
 * a real, shared counter and persists per browser via the anonymous visitor cookie.
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 } as const;
const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;

/** Copy asserted below, mirrored from messages/cs.json + messages/en.json. */
const CS = {
	badge: 'Toto je ukázka',
	headline: 'Rezervaci uvidí kamarádi. Petra ne.',
	roleGifter: 'Kamarád',
	roleRecipient: 'Petra',
	reservedSticker: 'Rezervováno někým jiným',
	reserve: 'Rezervovat',
	cancelReservation: 'Zrušit rezervaci',
	invariantCaption: 'Petra nevidí, že je rezervováno — překvapení platí.',
	teapotName: 'Porcelánová konvička na čaj',
	likePopup: 'Počítadlo je opravdové',
	gifterPhotoAlt: 'Kamarádi s dárky',
	recipientPhotoAlt: 'Petra',
	gifterPhotoCaption: 'Kamarádi',
	recipientPhotoCaption: 'Petra',
} as const;

const EN = {
	badge: 'This is a demo',
	headline: "Friends see the reservation. Petra doesn't.",
	teapotName: 'Porcelain teapot',
} as const;

/**
 * Any rendering of a reservation, in either locale — nothing of this may reach Petra.
 * Only ever matched inside a `gift-list-item`, so the panes' own hint copy ("Žádné
 * rezervace…") stays out of scope.
 */
const RESERVATION_TRACE = /rezervov|rezervac|reserv/i;

const DEMO_GIFT_ID = 'teapot';

function gifterPane(page: Page): Locator {
	return page.getByTestId('landing-demo-pane-gifter');
}

function recipientPane(page: Page): Locator {
	return page.getByTestId('landing-demo-pane-recipient');
}

/** Per-gift wrapper — the same id exists in both panes, so always scope to one pane. */
function demoGift(pane: Locator, giftId: string = DEMO_GIFT_ID): Locator {
	return pane.getByTestId(`landing-demo-gift-${giftId}`);
}

async function gotoDemo(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
	await page.waitForSelector('[data-testid="landing-demo"]');
}

/**
 * Toggles a reserve button and waits for its label to flip. The section is server-rendered,
 * so a click can land before hydration wires the handler — retry until it takes (the house
 * alternative to a `networkidle` wait, see image-crop.spec.ts).
 */
async function toggleReservation(button: Locator, expectedLabel: string): Promise<void> {
	await expect(async () => {
		await button.click();
		await expect(button).toHaveText(expectedLabel, { timeout: 2_000 });
	}).toPass({ timeout: 30_000 });
}

/**
 * The demo's only like button that renders its count: the mobile hook's gifter `GiftCard`.
 * The two panes use `GiftListItem`, which passes `showCount={false}`, so their hearts show
 * pressed state only.
 */
function pairLikeButton(page: Page): Locator {
	return page.getByTestId('landing-demo-pair-gifter').locator('button[aria-pressed]');
}

/**
 * Resolves on the next like-counter round trip. The demo's only remote traffic is the like
 * query and command, so any `/_app/remote/` response is one of them. Every count read has to
 * be sequenced behind one of these: the query loads after hydration (counts pop in) and the
 * button paints an optimistic number before the command answers, so an unsequenced read can
 * catch either placeholder instead of the shared truth.
 */
function likeCounterResponse(page: Page): Promise<unknown> {
	return page.waitForResponse((response) => response.url().includes('/_app/remote/'), {
		timeout: 15_000,
	});
}

/** Rendered like count; `LikeButton` hides a zero, so an empty label reads as 0. */
async function likeCount(button: Locator): Promise<number> {
	const label = (await button.innerText()).trim();
	return label === '' ? 0 : Number(label);
}

/**
 * Clicks a like button and waits for its pressed state to flip. Same retry rationale as
 * {@link toggleReservation}: the section is server-rendered, so a click can land before
 * hydration wires the handler.
 */
async function toggleLike(button: Locator, expectedPressed: boolean): Promise<void> {
	await expect(async () => {
		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', String(expectedPressed), {
			timeout: 2_000,
		});
	}).toPass({ timeout: 30_000 });
}

/**
 * `toggleLike` returns as soon as the OPTIMISTIC state flips, which is before the command
 * has landed. Reloading into that gap would race the write. The anonymous visitor cookie is
 * minted by that same command response (a query cannot set cookies), so in a fresh browser
 * context its appearance is exact proof that the first like committed server-side.
 */
async function waitForFirstLikeToCommit(page: Page): Promise<void> {
	await expect
		.poll(
			async () => {
				const cookies = await page.context().cookies();
				return cookies.some((cookie) => cookie.name === 'prejemesi_anon_id');
			},
			{ timeout: 15_000 },
		)
		.toBe(true);
}

test.describe('Landing demo section', () => {
	test('is server-rendered and sits between the hero and how-it-works', async ({
		page,
		request,
	}) => {
		// No JS at all: the section must exist in the SSR payload.
		const response = await request.get('/');
		expect(response.status()).toBe(200);
		const html = await response.text();
		expect(html).toContain('data-testid="landing-demo"');
		expect(html).toContain(CS.badge);

		for (const viewport of [MOBILE_VIEWPORT, DESKTOP_VIEWPORT]) {
			await page.setViewportSize(viewport);
			await gotoDemo(page);

			await expect(page.getByTestId('landing-demo')).toBeVisible();
			await expect(page.getByTestId('landing-demo-badge')).toHaveText(new RegExp(CS.badge));
			await expect(page.getByRole('heading', { name: CS.headline })).toBeVisible();

			// Document order: hero <h1> … demo section … how-it-works section.
			const order = await page.evaluate(() => {
				const heroHeading = document.querySelector('h1');
				const demo = document.querySelector('#ukazka');
				const howItWorks = document.querySelector('#jak-to-funguje');
				if (heroHeading === null || demo === null || howItWorks === null) {
					return null;
				}
				const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
				return {
					demoAfterHero: (heroHeading.compareDocumentPosition(demo) & FOLLOWING) !== 0,
					demoBeforeHowItWorks:
						(demo.compareDocumentPosition(howItWorks) & FOLLOWING) !== 0,
				};
			});
			expect(order).toEqual({ demoAfterHero: true, demoBeforeHowItWorks: true });
		}
	});

	test('mobile pair shows the same gift reserved for the gifter and clean for Petra', async ({
		page,
	}) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await gotoDemo(page);

		const pair = page.getByTestId('landing-demo-pair');
		await expect(pair).toBeVisible();

		const pairGifter = page.getByTestId('landing-demo-pair-gifter');
		const pairRecipient = page.getByTestId('landing-demo-pair-recipient');

		// Same wish on both sides.
		await expect(pairGifter.getByRole('heading', { name: CS.teapotName })).toBeVisible();
		await expect(pairRecipient.getByRole('heading', { name: CS.teapotName })).toBeVisible();

		// Only the visible gifter overlay carries the reservation sticker.
		await expect(pairGifter.locator('[data-testid="gift-state-overlay"]:visible')).toHaveText(
			CS.reservedSticker,
		);
		await expect(pairRecipient.getByText(RESERVATION_TRACE)).toHaveCount(0);
		// A frozen illustration: neither cell offers a control.
		await expect(pair.getByTestId('reserve-button')).toHaveCount(0);
	});

	test('mobile role toggle keeps the reservation invisible to Petra', async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await gotoDemo(page);

		const toggle = page.getByTestId('landing-demo-role-toggle');
		await expect(toggle).toBeVisible();

		// Default viewpoint is the gifter; only that pane is on screen.
		await expect(gifterPane(page)).toBeVisible();
		await expect(recipientPane(page)).toBeHidden();

		const gifterGift = demoGift(gifterPane(page));
		const reserveButton = gifterGift.getByTestId('reserve-button');
		await expect(reserveButton).toHaveText(CS.reserve);

		await toggleReservation(reserveButton, CS.cancelReservation);

		// Switch to Petra: the very same gift must show no reservation state at all.
		await page.getByTestId('landing-demo-role-recipient').click();
		await expect(recipientPane(page)).toBeVisible();
		await expect(gifterPane(page)).toBeHidden();

		const recipientGift = demoGift(recipientPane(page));
		await expect(recipientGift).toBeVisible();
		await expect(recipientGift.getByTestId('reserve-button')).toHaveCount(0);
		// The gift row itself (excluding the demo's own narration) is free of any trace.
		await expect(
			recipientGift.getByTestId('gift-list-item').getByText(RESERVATION_TRACE),
		).toHaveCount(0);

		// The narration only appears on the gift the visitor just reserved.
		const caption = recipientGift.getByTestId('landing-demo-invariant-caption');
		await expect(caption).toBeVisible();
		await expect(caption).toHaveText(new RegExp(CS.invariantCaption));
		await expect(recipientPane(page).getByTestId('landing-demo-invariant-caption')).toHaveCount(
			1,
		);

		// Back to the gifter: the reservation is still there, and cancelling restores the start.
		await page.getByTestId('landing-demo-role-gifter').click();
		await expect(gifterPane(page)).toBeVisible();
		await expect(reserveButton).toHaveText(CS.cancelReservation);

		await toggleReservation(reserveButton, CS.reserve);

		await page.getByTestId('landing-demo-role-recipient').click();
		await expect(recipientPane(page).getByTestId('landing-demo-invariant-caption')).toHaveCount(
			0,
		);
	});

	test('desktop split view leaves the recipient pane untouched by a reservation', async ({
		page,
	}) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		// The narrow-screen scaffolding is gone; both panes are on screen at once.
		await expect(page.getByTestId('landing-demo-pair')).toBeHidden();
		await expect(page.getByTestId('landing-demo-role-toggle')).toBeHidden();
		await expect(gifterPane(page)).toBeVisible();
		await expect(recipientPane(page)).toBeVisible();

		const recipientGift = demoGift(recipientPane(page));
		const recipientTextBefore = await recipientGift.innerText();

		const reserveButton = demoGift(gifterPane(page)).getByTestId('reserve-button');
		await expect(reserveButton).toHaveText(CS.reserve);
		await toggleReservation(reserveButton, CS.cancelReservation);

		// Positive control: the gifter's own row does carry the reservation wording, so the
		// absence assertions below are about the invariant, not about a dead locator.
		await expect(
			demoGift(gifterPane(page)).getByTestId('gift-list-item').getByText(RESERVATION_TRACE),
		).not.toHaveCount(0);

		// Petra's side must be indistinguishable from before the click. `innerText` is what she
		// can actually read, so the mobile-only narration (present but `lg:hidden`) is excluded.
		await expect.poll(() => recipientGift.innerText()).toBe(recipientTextBefore);
		await expect(recipientGift.getByTestId('reserve-button')).toHaveCount(0);
		await expect(
			recipientGift.getByTestId('gift-list-item').getByText(RESERVATION_TRACE),
		).toHaveCount(0);
		// The mobile-only narration must never surface in the split view.
		await expect(
			recipientPane(page).getByTestId('landing-demo-invariant-caption'),
		).toBeHidden();

		await toggleReservation(reserveButton, CS.reserve);
		await expect.poll(() => recipientGift.innerText()).toBe(recipientTextBefore);
	});

	test('each pane is flanked by its polaroid without breaking the panes alignment', async ({
		page,
	}) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		const gifterPolaroid = page.getByTestId('landing-demo-polaroid-gifter');
		const recipientPolaroid = page.getByTestId('landing-demo-polaroid-recipient');
		await expect(gifterPolaroid).toBeVisible();
		await expect(recipientPolaroid).toBeVisible();
		await expect(gifterPolaroid.getByAltText(CS.gifterPhotoAlt)).toBeVisible();
		await expect(recipientPolaroid.getByAltText(CS.recipientPhotoAlt)).toBeVisible();
		await expect(gifterPolaroid).toHaveText(new RegExp(CS.gifterPhotoCaption));
		await expect(recipientPolaroid).toHaveText(new RegExp(CS.recipientPhotoCaption));

		// The prints are asymmetric decoration; the two pane cards still start on one line.
		const gifterBox = await gifterPane(page).boundingBox();
		const recipientBox = await recipientPane(page).boundingBox();
		expect(gifterBox).not.toBeNull();
		expect(recipientBox).not.toBeNull();
		expect(Math.abs((gifterBox?.y ?? 0) - (recipientBox?.y ?? 0))).toBeLessThanOrEqual(1);

		// Overhanging prints must never push the page sideways. 1024px is the tightest
		// case: the absolute-positioned prints exist but the viewport margins around the
		// 1200px content column do not yet.
		for (const width of [1024, DESKTOP_VIEWPORT.width]) {
			await page.setViewportSize({ width, height: DESKTOP_VIEWPORT.height });
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
		}
	});

	test('the visible pane brings its own polaroid on narrow screens', async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await gotoDemo(page);

		const gifterPolaroid = page.getByTestId('landing-demo-polaroid-gifter');
		const recipientPolaroid = page.getByTestId('landing-demo-polaroid-recipient');
		await expect(gifterPolaroid).toBeVisible();
		await expect(recipientPolaroid).toBeHidden();

		// Server-rendered section: the click can land before hydration wires the toggle.
		await expect(async () => {
			await page.getByTestId('landing-demo-role-recipient').click();
			await expect(recipientPolaroid).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 30_000 });
		await expect(gifterPolaroid).toBeHidden();
	});

	test('reserving and unreserving fires no network mutation', async ({ page }) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		const reserveButton = demoGift(gifterPane(page)).getByTestId('reserve-button');
		await expect(reserveButton).toHaveText(CS.reserve);

		// Only non-GET traffic matters: the dev server streams module GETs continuously.
		const mutations: string[] = [];
		page.on('request', (networkRequest) => {
			const method = networkRequest.method();
			if (method !== 'GET' && method !== 'HEAD') {
				mutations.push(`${method} ${networkRequest.url()}`);
			}
		});

		await toggleReservation(reserveButton, CS.cancelReservation);
		await toggleReservation(reserveButton, CS.reserve);

		expect(mutations).toEqual([]);
	});

	test('a reload resets the demo', async ({ page }) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		const reserveButton = () => demoGift(gifterPane(page)).getByTestId('reserve-button');
		await toggleReservation(reserveButton(), CS.cancelReservation);

		await page.reload();
		await page.waitForSelector('[data-testid="landing-demo"]');

		await expect(reserveButton()).toHaveText(CS.reserve);
	});

	// The one real, shared, persisted surface in the demo. Serial because the counter is
	// global state and the config is `fullyParallel`: two like tests running at once would
	// see each other's writes land between a snapshot and its assertion.
	test.describe('like counter', () => {
		test.describe.configure({ mode: 'serial' });

		test('liking a demo gift moves the shared counter and unliking puts it back', async ({
			page,
		}) => {
			await page.setViewportSize(MOBILE_VIEWPORT);
			const initialCounts = likeCounterResponse(page);
			await gotoDemo(page);
			await initialCounts;

			const likeButton = pairLikeButton(page);
			await expect(likeButton).toHaveAttribute('aria-pressed', 'false');

			// The counter is real, shared, global state — parallel workers and reruns all write
			// to it, so only deltas against the count on screen right now can be asserted.
			const countBeforeLike = await likeCount(likeButton);

			const likeCommitted = likeCounterResponse(page);
			await toggleLike(likeButton, true);
			await likeCommitted;
			await expect.poll(() => likeCount(likeButton)).toBe(countBeforeLike + 1);

			const unlikeCommitted = likeCounterResponse(page);
			await toggleLike(likeButton, false);
			await unlikeCommitted;
			await expect.poll(() => likeCount(likeButton)).toBe(countBeforeLike);
		});

		test('a like survives a reload (anonymous visitor cookie)', async ({ page }) => {
			await page.setViewportSize(MOBILE_VIEWPORT);
			await gotoDemo(page);

			const likeButton = () => pairLikeButton(page);
			await toggleLike(likeButton(), true);
			await waitForFirstLikeToCommit(page);
			const countAfterLike = await likeCount(likeButton());

			await page.reload();
			await page.waitForSelector('[data-testid="landing-demo"]');

			// Unlike the reservation state, this one is restored from the server for this browser.
			await expect(likeButton()).toHaveAttribute('aria-pressed', 'true');
			await expect.poll(() => likeCount(likeButton())).toBe(countAfterLike);

			// Leave the shared counter as it was found.
			await toggleLike(likeButton(), false);
		});

		test('a like explains the counter once per session', async ({ page }) => {
			await page.setViewportSize(DESKTOP_VIEWPORT);
			await gotoDemo(page);

			const heart = demoGift(gifterPane(page)).locator('button[aria-pressed]');
			const popup = page.getByTestId('landing-demo-like-popup');
			// Nothing explains anything until the visitor actually likes something.
			await expect(popup).toHaveCount(0);

			await toggleLike(heart, true);
			await expect(popup).toBeVisible();
			await expect(popup).toHaveText(new RegExp(CS.likePopup));

			const giftCard = demoGift(gifterPane(page)).getByTestId('gift-list-item');
			const [popupBox, heartBox, giftCardBox] = await Promise.all([
				popup.boundingBox(),
				heart.boundingBox(),
				giftCard.boundingBox(),
			]);
			expect(popupBox).not.toBeNull();
			expect(heartBox).not.toBeNull();
			expect(giftCardBox).not.toBeNull();
			expect(popupBox!.x).toBeGreaterThanOrEqual(heartBox!.x + heartBox!.width);
			expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(
				giftCardBox!.x + giftCardBox!.width,
			);

			// Restore the shared counter; unliking must never trigger the explainer.
			await toggleLike(heart, false);
			await expect(popup).toHaveCount(0, { timeout: 15_000 });

			// Second like in the same session: the explainer has had its turn. Sequenced behind
			// the command response, since that is what would have opened the bubble.
			const secondLikeCommitted = likeCounterResponse(page);
			await toggleLike(heart, true);
			await secondLikeCommitted;
			await expect(popup).toHaveCount(0);

			await toggleLike(heart, false);
		});
	});

	test('the demo wishlist can be retinted with the palette switcher', async ({ page }) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		const switcher = page.getByTestId('landing-demo-palette-switcher');
		const wrapper = page.locator('#ukazka [data-palette]');
		await expect(wrapper).toHaveAttribute('data-palette', 'honey');

		// Same retry rationale as `toggleReservation`: the section is server-rendered, so a
		// click can land before hydration wires the handler.
		await expect(async () => {
			await switcher.getByRole('button', { name: 'Hrozen' }).click();
			await expect(wrapper).toHaveAttribute('data-palette', 'grape', { timeout: 2_000 });
		}).toPass({ timeout: 30_000 });

		// Demo state is local only: a reload starts the visitor over, palette included.
		await page.reload();
		await page.waitForSelector('[data-testid="landing-demo"]');
		await expect(wrapper).toHaveAttribute('data-palette', 'honey');
	});

	test('renders Czech at / and English at /en', async ({ page }) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);

		await gotoDemo(page, '/');
		await expect(page.getByTestId('landing-demo-badge')).toHaveText(new RegExp(CS.badge));
		await expect(page.getByRole('heading', { name: CS.headline })).toBeVisible();
		await expect(gifterPane(page).getByRole('heading', { name: CS.teapotName })).toBeVisible();

		await gotoDemo(page, '/en');
		await expect(page.getByTestId('landing-demo-badge')).toHaveText(new RegExp(EN.badge));
		await expect(page.getByRole('heading', { name: EN.headline })).toBeVisible();
		await expect(gifterPane(page).getByRole('heading', { name: EN.teapotName })).toBeVisible();
	});
});
