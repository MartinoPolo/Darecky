import { describe, it, expect } from 'vitest';
import { computePostShareEditTransparency, type PreShareGiftSnapshot } from './gift_post_share.js';
import { makeCurrent, NOW } from './gift_post_share.test_fixtures.js';

describe('computePostShareEditTransparency', () => {
	function makeParams(
		overrides: Partial<Parameters<typeof computePostShareEditTransparency>[0]> = {},
	): Parameters<typeof computePostShareEditTransparency>[0] {
		return {
			existingSnapshot: null,
			graceOpen: true,
			beforeEdit: makeCurrent({ name: 'Kolo' }),
			afterEdit: makeCurrent({ name: 'Kolo horské' }),
			now: NOW,
			...overrides,
		};
	}

	describe('REQ-1: first in-grace edit captures the pre-edit state', () => {
		it('sets editedAfterShareAt and snapshots the pre-edit state when no snapshot exists yet', () => {
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: null,
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo' }),
					afterEdit: makeCurrent({ name: 'Kolo horské' }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toEqual(makeCurrent({ name: 'Kolo' }));
		});
	});

	describe('REQ-2: subsequent in-grace edits compare against the original snapshot', () => {
		it('clears the badge when the edit reverts the gift byte-identically to the snapshot', () => {
			// "Kolo" -> "Kolo horské" (1st edit, snapshot = Kolo) -> "Kolo" (2nd edit, reverts).
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: makeCurrent({ name: 'Kolo' }),
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo horské' }),
					afterEdit: makeCurrent({ name: 'Kolo' }),
				}),
			);
			expect(outcome.editedAfterShareAt).toBeNull();
			expect(outcome.preEditShareSnapshot).toBeNull();
		});

		it('keeps the badge set when the edit does not net out to zero', () => {
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: makeCurrent({ name: 'Kolo' }),
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo horské' }),
					afterEdit: makeCurrent({ name: 'Kolo elektrické' }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			// The ORIGINAL share-time snapshot is preserved, not the intermediate "Kolo horské" state,
			// so a later edit back to "Kolo horské" does NOT count as a net-zero revert.
			expect(outcome.preEditShareSnapshot).toEqual(makeCurrent({ name: 'Kolo' }));
		});

		it('compares against the original snapshot, not the immediately-preceding edit', () => {
			// Snapshot is "Kolo" (share-time). Current state is "Kolo elektrické" (2nd edit).
			// Reverting to "Kolo horské" (the 1st edit's value) is NOT a net-zero revert.
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: makeCurrent({ name: 'Kolo' }),
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo elektrické' }),
					afterEdit: makeCurrent({ name: 'Kolo horské' }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toEqual(makeCurrent({ name: 'Kolo' }));
		});

		it('clears the badge when a multi-field edit nets out to zero across all tracked fields', () => {
			const shareTimeState = makeCurrent({ name: 'Kolo', price: 1000, quantity: 1 });
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: shareTimeState,
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo horské', price: 1500, quantity: 2 }),
					afterEdit: shareTimeState,
				}),
			);
			expect(outcome.editedAfterShareAt).toBeNull();
			expect(outcome.preEditShareSnapshot).toBeNull();
		});

		it('keeps the badge set when only some fields revert (net-nonzero)', () => {
			const shareTimeState = makeCurrent({ name: 'Kolo', price: 1000 });
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: shareTimeState,
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo horské', price: 1500 }),
					// name reverted, price did not.
					afterEdit: makeCurrent({ name: 'Kolo', price: 1500 }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toEqual(shareTimeState);
		});
	});

	describe('jsonb round-trip key reordering (issue #124 regression)', () => {
		// Postgres jsonb does not preserve JS key insertion order: a snapshot read back from the
		// `pre_edit_share_snapshot` column can have different key order (including inside nested
		// objects like `imageMeta`) than a freshly-built snapshot, even when every value matches.
		// A raw JSON.stringify comparison treats this as "changed" and the badge never clears.
		function reorderKeys(snapshot: PreShareGiftSnapshot): PreShareGiftSnapshot {
			// Rebuild with reversed key order plus a differently-ordered nested object, simulating
			// what a jsonb round-trip can produce. Only reorders existing keys - never adds/drops any,
			// so the two objects remain value-identical.
			const reordered = {
				priorityLevelId: snapshot.priorityLevelId,
				links: snapshot.links,
				imageMeta: snapshot.imageMeta
					? (Object.fromEntries(
							Object.entries(snapshot.imageMeta).reverse(),
						) as PreShareGiftSnapshot['imageMeta'])
					: snapshot.imageMeta,
				imageKey: snapshot.imageKey,
				imageUrl: snapshot.imageUrl,
				currency: snapshot.currency,
				priceMax: snapshot.priceMax,
				price: snapshot.price,
				quantity: snapshot.quantity,
				descriptionAppends: snapshot.descriptionAppends,
				description: snapshot.description,
				name: snapshot.name,
			};
			return reordered as PreShareGiftSnapshot;
		}

		it('clears the badge for a value-identical revert even when the existing snapshot has reordered keys', () => {
			const shareTimeState = makeCurrent({
				name: 'Kolo',
				price: 1000,
				imageMeta: { fitMode: 'cover-crop', bgColor: '#ffffff' },
				links: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }],
			});
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: reorderKeys(shareTimeState),
					graceOpen: true,
					beforeEdit: makeCurrent({
						name: 'Kolo horské',
						price: 1500,
						imageMeta: { fitMode: 'cover-crop', bgColor: '#ffffff' },
						links: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }],
					}),
					// Reverts byte-for-byte to shareTimeState (net-zero).
					afterEdit: shareTimeState,
				}),
			);
			expect(outcome.editedAfterShareAt).toBeNull();
			expect(outcome.preEditShareSnapshot).toBeNull();
		});

		it('still keeps the badge set when a genuinely different value is compared against a reordered snapshot', () => {
			const shareTimeState = makeCurrent({ name: 'Kolo', price: 1000 });
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: reorderKeys(shareTimeState),
					graceOpen: true,
					beforeEdit: makeCurrent({ name: 'Kolo horské', price: 1500 }),
					// price does not revert -> genuinely changed, not net-zero.
					afterEdit: makeCurrent({ name: 'Kolo', price: 1500 }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toEqual(shareTimeState);
		});

		it('still treats a reordered array (same elements, different order) as a real change', () => {
			const shareTimeState = makeCurrent({
				name: 'Kolo',
				links: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }],
			});
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: reorderKeys(shareTimeState),
					graceOpen: true,
					beforeEdit: makeCurrent({
						name: 'Kolo',
						links: [{ url: 'https://example.com/b' }, { url: 'https://example.com/a' }],
					}),
					// Same link objects as shareTimeState but reordered - not a net-zero revert.
					afterEdit: makeCurrent({
						name: 'Kolo',
						links: [{ url: 'https://example.com/b' }, { url: 'https://example.com/a' }],
					}),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toEqual(shareTimeState);
		});
	});

	describe('REQ-3: post-grace edits always badge permanently, even if later reverted', () => {
		it('sets the badge and does not snapshot once the grace window has closed', () => {
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: null,
					graceOpen: false,
					beforeEdit: makeCurrent({ price: 1000 }),
					afterEdit: makeCurrent({ price: 1500 }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toBeNull();
		});

		it('badges permanently even when the post-grace edit reverts a still-open pre-grace change', () => {
			// A week-later price revert is itself a change gifters should notice (decision 2026-07-12).
			const outcome = computePostShareEditTransparency(
				makeParams({
					existingSnapshot: makeCurrent({ price: 1000 }),
					graceOpen: false,
					beforeEdit: makeCurrent({ price: 1500 }),
					afterEdit: makeCurrent({ price: 1000 }),
				}),
			);
			expect(outcome.editedAfterShareAt).toEqual(NOW);
			expect(outcome.preEditShareSnapshot).toBeNull();
		});
	});
});
