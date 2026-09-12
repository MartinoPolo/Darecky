import { describe, expect, it, vi } from 'vitest';
import {
	canonicalGiftIngestionItemHash,
	prepareGiftIngestionImages,
	processGiftIngestion,
} from './ingestion_service.js';
import {
	config,
	IMAGE_BODY,
	IMAGE_SHA256,
	imageManifest,
	store,
} from './ingestion_service.test_fixtures.js';

describe('gift ingestion image staging and compensation', () => {
	it('prepares only validated creatable manifest items with exact short-lived presigned bindings', async () => {
		const database = store();
		const presign = vi.fn(async () => 'https://r2.example/signed');
		const prepared = await prepareGiftIngestionImages(imageManifest, {
			config,
			store: database,
			images: [
				{
					itemId: 'item-1',
					sha256: IMAGE_SHA256,
					contentType: 'image/png',
					byteLength: 30,
					width: 2,
					height: 3,
				},
			],
			presign,
		});
		expect(prepared).toEqual([
			expect.objectContaining({
				itemId: 'item-1',
				uploadUrl: 'https://r2.example/signed',
				key: expect.stringMatching(/^gifts\/ingestion\/wishlist-db-id\/batch-1\/item-1\//),
			}),
		]);
		expect(presign).toHaveBeenCalledWith(
			expect.objectContaining({
				objectKey: prepared[0]!.key,
				contentType: 'image/png',
				contentLength: 30,
			}),
		);
	});

	it('verifies staged image metadata before insertion and compensates every staged object when the transaction fails', async () => {
		const remove = vi.fn(async () => undefined);
		const recordOrphan = vi.fn(async () => undefined);
		const failing = store({
			transaction: vi.fn(async () => {
				throw new Error('database failed');
			}),
		});
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: failing,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
					isReferenced: vi.fn(async () => false),
					remove,
					recordOrphan,
				},
			}),
		).rejects.toThrow(/database/i);
		expect(remove).toHaveBeenCalledWith(key);
		expect(recordOrphan).not.toHaveBeenCalled();
	});

	it('rejects same-size and same-MIME wrong image bytes before insertion and cleans them', async () => {
		const database = store();
		const remove = vi.fn(async () => undefined);
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: database,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({
						body: new Uint8Array(30).fill(1).buffer,
						contentType: 'image/png',
					})),
					isReferenced: vi.fn(async () => false),
					remove,
					recordOrphan: vi.fn(async () => undefined),
				},
			}),
		).rejects.toThrow(/digest mismatch/i);
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(remove).toHaveBeenCalledWith(key);
	});

	it('reports failed reference verification without deleting the staged image', async () => {
		const remove = vi.fn(async () => undefined);
		const recordOrphan = vi.fn<
			(input: {
				key: string;
				reason: string;
				manifestId: string;
				itemId: string;
			}) => Promise<void>
		>(async () => undefined);
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: store({
					transaction: vi.fn(async () => {
						throw new Error('database failed');
					}),
				}),
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
					isReferenced: vi.fn(async () => {
						throw new Error(`reference database unavailable ${'x'.repeat(400)}`);
					}),
					remove,
					recordOrphan,
				},
			}),
		).rejects.toThrow(/database/i);

		expect(remove).not.toHaveBeenCalled();
		expect(recordOrphan).toHaveBeenCalledOnce();
		const report = recordOrphan.mock.calls[0]![0];
		expect(report).toMatchObject({ key, manifestId: 'batch-1', itemId: 'item-1' });
		expect(report.reason).toMatch(/^Reference verification failed:/);
		expect(report.reason.length).toBeLessThanOrEqual(300);
	});

	it('aborts before gift creation on missing/mismatched requested images and reports bounded cleanup failures', async () => {
		const database = store();
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: database,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({
						body: new Uint8Array(29).buffer,
						contentType: 'image/png',
					})),
					isReferenced: vi.fn(async () => false),
					remove: vi.fn(async () => {
						throw new Error('r2 unavailable');
					}),
					recordOrphan: vi.fn(async () => undefined),
				},
			}),
		).rejects.toThrow(/verification/i);
		expect(database.appendGifts).not.toHaveBeenCalled();
	});
	it('cleans an unreferenced image made unnecessary by locked replanning but retains a referenced deterministic object', async () => {
		for (const referenced of [false, true]) {
			let sourceLookup = 0;
			const concurrentStore = store({
				findExistingSourceKeys: vi.fn(async () => {
					sourceLookup += 1;
					return sourceLookup === 1
						? new Set<string>()
						: new Set(['shop.example/camera?ref=agent']);
				}),
			});
			const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
			const remove = vi.fn(async () => undefined);
			const result = await processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: concurrentStore,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
					isReferenced: vi.fn(async () => referenced),
					remove,
					recordOrphan: vi.fn(async () => undefined),
				},
			});
			expect(result.skipped).toHaveLength(1);
			expect(remove).toHaveBeenCalledTimes(referenced ? 0 : 1);
		}
	});

	it('cleans a prepared byte-hash key when locked replanning finds the item already applied', async () => {
		let itemLookup = 0;
		const itemHash = await canonicalGiftIngestionItemHash(imageManifest.items[0]!);
		const database = store({
			findItems: vi.fn(async () => {
				itemLookup += 1;
				return itemLookup === 1
					? []
					: [{ itemId: 'item-1', itemHash, createdGiftId: 'gift-existing' }];
			}),
		});
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		const remove = vi.fn(async () => undefined);
		const result = await processGiftIngestion(imageManifest, {
			apply: true,
			config,
			store: database,
			preparedImages: [
				{
					wishlistId: 'wishlist-db-id',
					manifestId: 'batch-1',
					itemId: 'item-1',
					key,
					sha256: IMAGE_SHA256,
					contentType: 'image/png',
					byteLength: 30,
				},
			],
			imageStorage: {
				get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
				isReferenced: vi.fn(async () => false),
				remove,
				recordOrphan: vi.fn(async () => undefined),
			},
		});

		expect(result.alreadyApplied).toEqual([{ itemId: 'item-1', giftId: 'gift-existing' }]);
		expect(remove).toHaveBeenCalledWith(key);
	});
});
