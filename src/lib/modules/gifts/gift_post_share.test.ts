import { describe, it, expect } from 'vitest';
import { computePreShareOwnerEdit, toPreShareGiftSnapshot } from './gift_post_share.js';
import { makeCurrent, makeInput, NOW } from './gift_post_share.test_fixtures.js';

describe('computePreShareOwnerEdit', () => {
	describe('name', () => {
		it('ignores name when unchanged (never writes name)', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ name: 'Camera' }),
				makeInput({ name: 'Camera' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect('name' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('ignores absent name', () => {
			const outcome = computePreShareOwnerEdit(makeCurrent(), makeInput(), NOW);
			expect(outcome.rejection).toBeNull();
			expect('name' in outcome.updateData).toBe(false);
		});

		it('rejects with 403 CANNOT_EDIT_AFTER_SHARING when name changes', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ name: 'Camera' }),
				makeInput({ name: 'New Camera' }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 403, code: 'CANNOT_EDIT_AFTER_SHARING' });
		});
	});

	describe('category', () => {
		it('allows changing category without changing the frozen gift name', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ categoryId: 'category-old' }),
				makeInput({ categoryId: 'category-new', name: 'Camera' }),
				NOW,
			);

			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.categoryId).toBe('category-new');
			expect('name' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(true);
		});

		it('keeps category assignment in the pre-share snapshot used for net-zero comparisons', () => {
			expect(
				toPreShareGiftSnapshot(makeCurrent({ categoryId: 'category-books' })).categoryId,
			).toBe('category-books');
		});
	});

	describe('quantity', () => {
		it('allows raising quantity and writes it', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: 3 }),
				makeInput({ quantity: 5 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.quantity).toBe(5);
			expect(outcome.changed).toBe(true);
		});

		it('treats equal quantity as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: 3 }),
				makeInput({ quantity: 3 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.changed).toBe(false);
		});

		it('rejects with 400 QUANTITY_CANNOT_BE_LOWERED when lowering', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: 3 }),
				makeInput({ quantity: 1 }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 400, code: 'QUANTITY_CANNOT_BE_LOWERED' });
		});

		it('uses default quantity of 1 when current quantity is null', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: null }),
				makeInput({ quantity: 1 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.changed).toBe(false);
		});
	});

	describe('description append engine', () => {
		it('appends a timestamped segment when base description is non-empty', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original description', descriptionAppends: [] }),
				makeInput({ description: 'blue variant' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			// Original base untouched
			expect('description' in outcome.updateData).toBe(false);
			expect(outcome.updateData.descriptionAppends).toEqual([
				{ text: 'blue variant', addedAt: NOW.toISOString() },
			]);
			expect(outcome.changed).toBe(true);
		});

		it('does not append when submitted description equals the frozen base', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original description', descriptionAppends: [] }),
				makeInput({ description: ' Original description ' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('does not append when submitted description equals the latest append', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [
						{ text: 'latest note', addedAt: '2024-01-01T00:00:00.000Z' },
					],
				}),
				makeInput({ description: ' latest note ' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('can update another field without duplicating the unchanged frozen base', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original description', price: 1000 }),
				makeInput({ description: 'Original description', price: 1200 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.price).toBe(1200);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(true);
		});

		it('preserves existing appends and adds the new one', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [{ text: 'first', addedAt: '2024-01-01T00:00:00.000Z' }],
				}),
				makeInput({ description: 'second' }),
				NOW,
			);
			expect(outcome.updateData.descriptionAppends).toEqual([
				{ text: 'first', addedAt: '2024-01-01T00:00:00.000Z' },
				{ text: 'second', addedAt: NOW.toISOString() },
			]);
		});

		it('fills the main description when base is null (empty-at-share, no append)', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: null }),
				makeInput({ description: 'now has text' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.description).toBe('now has text');
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(true);
		});

		it('fills the main description when base is whitespace-only', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: '   ' }),
				makeInput({ description: 'now has text' }),
				NOW,
			);
			expect(outcome.updateData.description).toBe('now has text');
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(true);
		});

		it('is a no-op when input description is undefined', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original' }),
				makeInput(),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
		});

		it('is a no-op when input description is null', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original' }),
				makeInput({ description: null }),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
		});

		it('is a no-op when input description is empty/whitespace', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original' }),
				makeInput({ description: '   ' }),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('never clears the frozen base when input description is empty and base is empty', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: null }),
				makeInput({ description: '' }),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});
	});

	describe('descriptionAppendEdit (per-segment grace window, issue #83)', () => {
		const WITHIN = NOW.toISOString(); // addedAt == now → window open
		const STALE = new Date(NOW.getTime() - 3 * 60 * 1000).toISOString(); // 3 min ago → closed

		it('replaces a segment text within its window and resets its addedAt', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [
						{ text: 'old note', addedAt: WITHIN },
						{ text: 'keep me', addedAt: STALE },
					],
				}),
				makeInput({ descriptionAppendEdit: { index: 0, text: 'fixed note' } }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.descriptionAppends).toEqual([
				{ text: 'fixed note', addedAt: NOW.toISOString() },
				{ text: 'keep me', addedAt: STALE },
			]);
			expect(outcome.changed).toBe(true);
		});

		it('deletes a segment within its window when text is null', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [
						{ text: 'first', addedAt: STALE },
						{ text: 'remove me', addedAt: WITHIN },
					],
				}),
				makeInput({ descriptionAppendEdit: { index: 1, text: null } }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.descriptionAppends).toEqual([
				{ text: 'first', addedAt: STALE },
			]);
			expect(outcome.changed).toBe(true);
		});

		it('deletes a segment when text is blank/whitespace', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [{ text: 'remove me', addedAt: WITHIN }],
				}),
				makeInput({ descriptionAppendEdit: { index: 0, text: '   ' } }),
				NOW,
			);
			expect(outcome.updateData.descriptionAppends).toEqual([]);
			expect(outcome.changed).toBe(true);
		});

		it('rejects 403 when editing a segment past its own window', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [{ text: 'frozen note', addedAt: STALE }],
				}),
				makeInput({ descriptionAppendEdit: { index: 0, text: 'too late' } }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 403, code: 'CANNOT_EDIT_AFTER_SHARING' });
			expect(outcome.updateData).toEqual({});
		});

		it('rejects 404 DESCRIPTION_APPEND_NOT_FOUND for an out-of-range index', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [{ text: 'only one', addedAt: WITHIN }],
				}),
				makeInput({ descriptionAppendEdit: { index: 5, text: 'nope' } }),
				NOW,
			);
			expect(outcome.rejection).toEqual({
				status: 404,
				code: 'DESCRIPTION_APPEND_NOT_FOUND',
			});
		});

		it('ignores a new-segment append when an append edit is also supplied', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [{ text: 'editable', addedAt: WITHIN }],
				}),
				makeInput({
					description: 'should be ignored',
					descriptionAppendEdit: { index: 0, text: 'edited' },
				}),
				NOW,
			);
			const appends = outcome.updateData.descriptionAppends as {
				text: string;
				addedAt: string;
			}[];
			expect(appends).toEqual([{ text: 'edited', addedAt: NOW.toISOString() }]);
		});
	});

	describe('image / links / price / currency / priority', () => {
		it('detects price change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ price: 1000 }),
				makeInput({ price: 1500 }),
				NOW,
			);
			expect(outcome.updateData.price).toBe(1500);
			expect(outcome.changed).toBe(true);
		});

		it('detects priceMax change (price range upper bound, issue #155)', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ priceMax: null }),
				makeInput({ priceMax: 1500 }),
				NOW,
			);
			expect(outcome.updateData.priceMax).toBe(1500);
			expect(outcome.changed).toBe(true);
		});

		it('treats identical priceMax as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ priceMax: 1500 }),
				makeInput({ priceMax: 1500 }),
				NOW,
			);
			expect('priceMax' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('detects currency change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ currency: 'CZK' }),
				makeInput({ currency: 'EUR' }),
				NOW,
			);
			expect(outcome.updateData.currency).toBe('EUR');
			expect(outcome.changed).toBe(true);
		});

		it('detects priorityLevelId change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ priorityLevelId: null }),
				makeInput({ priorityLevelId: 'prio-1' }),
				NOW,
			);
			expect(outcome.updateData.priorityLevelId).toBe('prio-1');
			expect(outcome.changed).toBe(true);
		});

		it('detects imageUrl/imageKey change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ imageUrl: null, imageKey: null }),
				makeInput({ imageUrl: 'https://img/x.jpg', imageKey: 'gifts/x.jpg' }),
				NOW,
			);
			expect(outcome.updateData.imageUrl).toBe('https://img/x.jpg');
			expect(outcome.updateData.imageKey).toBe('gifts/x.jpg');
			expect(outcome.changed).toBe(true);
		});

		it('detects imageMeta change via JSON compare', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ imageMeta: null }),
				makeInput({ imageMeta: { fitMode: 'cover-crop' } }),
				NOW,
			);
			expect(outcome.updateData.imageMeta).toEqual({ fitMode: 'cover-crop' });
			expect(outcome.changed).toBe(true);
		});

		it('detects links change after normalization', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ links: [] }),
				makeInput({ links: [{ url: ' https://example.com/path ' }] }),
				NOW,
			);
			expect(outcome.updateData.links).toEqual([{ url: 'https://example.com/path' }]);
			expect(outcome.changed).toBe(true);
		});

		it('treats normalized-identical links as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ links: [{ url: 'https://example.com/path' }] }),
				makeInput({ links: [{ url: ' https://example.com/path ' }] }),
				NOW,
			);
			expect(outcome.changed).toBe(false);
		});

		it('treats identical price/currency/priority as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ price: 1000, currency: 'CZK', priorityLevelId: 'prio-1' }),
				makeInput({ price: 1000, currency: 'CZK', priorityLevelId: 'prio-1' }),
				NOW,
			);
			expect(outcome.changed).toBe(false);
		});
	});

	describe('idempotency', () => {
		it('changed=false when nothing differs', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					name: 'Camera',
					description: 'Original',
					quantity: 3,
					price: 1000,
					currency: 'CZK',
					links: [{ url: 'https://example.com/' }],
				}),
				makeInput({
					name: 'Camera',
					quantity: 3,
					price: 1000,
					currency: 'CZK',
					links: [{ url: 'https://example.com' }],
				}),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.changed).toBe(false);
		});
	});

	describe('rejection short-circuits before building updateData', () => {
		it('returns rejection without writing other allowed fields', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ name: 'Camera', price: 1000 }),
				makeInput({ name: 'New Name', price: 2000 }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 403, code: 'CANNOT_EDIT_AFTER_SHARING' });
			// Short-circuit: no allowed field is written and nothing is flagged as changed,
			// even though price was also supplied.
			expect(outcome.updateData).toEqual({});
			expect(outcome.changed).toBe(false);
		});
	});
});
