import { afterEach, describe, expect, it } from 'vitest';
import { resolveGiftContextFocusTarget } from './gift_context_focus.js';

function moreButton(giftId: string, options: { disabled?: boolean; hidden?: boolean } = {}) {
	const gift = document.createElement('article');
	gift.dataset.giftItem = '';
	gift.dataset.giftId = giftId;
	gift.hidden = options.hidden ?? false;
	const button = document.createElement('button');
	button.dataset.giftAction = 'more';
	button.disabled = options.disabled ?? false;
	button.textContent = `More ${giftId}`;
	gift.append(button);
	document.body.append(gift);
	return button;
}

function detachedButton() {
	const button = document.createElement('button');
	button.dataset.giftAction = 'more';
	return button;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('gift context focus target', () => {
	it('keeps a connected, enabled, visible original anchor', () => {
		const original = moreButton('gift-one');
		const replacement = moreButton('gift-one');

		expect(resolveGiftContextFocusTarget(original, 'gift-one', document.body)).toBe(original);
		expect(replacement).not.toBe(original);
	});

	it('resolves a replacement More action for the same gift', () => {
		const replacement = moreButton('gift-one');

		expect(resolveGiftContextFocusTarget(detachedButton(), 'gift-one', document.body)).toBe(
			replacement,
		);
	});

	it('replaces a connected original anchor in an inert outgoing collection', () => {
		const outgoingCollection = document.createElement('section');
		outgoingCollection.setAttribute('inert', '');
		document.body.append(outgoingCollection);
		const original = moreButton('gift-one');
		outgoingCollection.append(original.closest('[data-gift-item]')!);
		const replacement = moreButton('gift-one');

		expect(resolveGiftContextFocusTarget(original, 'gift-one', document.body)).toBe(
			replacement,
		);
	});

	it('replaces a connected original anchor in an aria-hidden outgoing collection', () => {
		const outgoingCollection = document.createElement('section');
		outgoingCollection.setAttribute('aria-hidden', 'true');
		document.body.append(outgoingCollection);
		const original = moreButton('gift-one');
		outgoingCollection.append(original.closest('[data-gift-item]')!);
		const replacement = moreButton('gift-one');

		expect(resolveGiftContextFocusTarget(original, 'gift-one', document.body)).toBe(
			replacement,
		);
	});

	it('skips replacement candidates in inert or aria-hidden subtrees', () => {
		const inertGift = moreButton('gift-one');
		inertGift.setAttribute('inert', '');
		const ariaHiddenGift = moreButton('gift-one');
		ariaHiddenGift.setAttribute('aria-hidden', 'true');
		const replacement = moreButton('gift-one');

		expect(resolveGiftContextFocusTarget(detachedButton(), 'gift-one', document.body)).toBe(
			replacement,
		);
	});

	it('does not use the first gift when the requested gift is second', () => {
		const first = moreButton('gift-one');
		const second = moreButton('gift-two');

		expect(resolveGiftContextFocusTarget(detachedButton(), 'gift-two', document.body)).toBe(
			second,
		);
		expect(first).not.toBe(second);
	});

	it('returns null when the same gift is deleted or its More action is hidden or disabled', () => {
		moreButton('other-gift');
		expect(
			resolveGiftContextFocusTarget(detachedButton(), 'deleted-gift', document.body),
		).toBeNull();

		document.body.replaceChildren();
		moreButton('gift-one', { hidden: true });
		moreButton('gift-one', { disabled: true });
		expect(
			resolveGiftContextFocusTarget(detachedButton(), 'gift-one', document.body),
		).toBeNull();
	});

	it('compares gift ids as data values without selector interpolation', () => {
		const adversarialId = 'gift-"] button, [data-gift-id="other';
		moreButton('other');
		const exact = moreButton(adversarialId);

		expect(resolveGiftContextFocusTarget(detachedButton(), adversarialId, document.body)).toBe(
			exact,
		);
	});
});
