import { describe, expect, it, vi } from 'vitest';
import {
	IngestionWarningCollector,
	prepareGiftIngestionImages,
	processGiftIngestion,
} from './ingestion_service.js';
import type { GiftIngestionManifest } from './manifest.js';
import { config, manifest, store } from './ingestion_service.test_fixtures.js';

describe('gift ingestion planning and validation', () => {
	it('passes a valid enabled category assignment into atomic gift creation', async () => {
		const database = store({
			resolveCategoryLabels: vi.fn(async () => new Map([['Hry', 'category-games']])),
		});
		await processGiftIngestion(
			{
				...manifest,
				items: manifest.items.map((item) => ({
					...item,
					gift: { ...item.gift, category: 'Hry' },
				})),
			},
			{ apply: true, config, store: database },
		);

		expect(database.appendGifts).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				gifts: [expect.objectContaining({ categoryId: 'category-games' })],
			}),
		);
	});

	it('rejects an unknown category before applying any gift', async () => {
		const database = store({
			resolveCategoryLabels: vi.fn(async () => new Map()),
		});
		await expect(
			processGiftIngestion(
				{
					...manifest,
					items: manifest.items.map((item) => ({
						...item,
						gift: { ...item.gift, category: 'Outdoor' },
					})),
				},
				{ apply: true, config, store: database },
			),
		).rejects.toMatchObject({ code: 'category_unknown' });
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(database.insertRun).not.toHaveBeenCalled();
	});

	it('keeps dry-run side-effect free and reports the resolved target and proposed items', async () => {
		const database = store();
		const result = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: database,
		});

		expect(result).toMatchObject({
			mode: 'dry-run',
			target: { shortId: 'fixed-list', title: 'Christmas', recipient: 'Rosie' },
			wouldCreate: [{ itemId: 'item-1', name: 'Camera' }],
			alreadyApplied: [],
			skipped: [],
			warnings: [],
			conflicts: [],
		});
		expect(database.transaction).not.toHaveBeenCalled();
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(database.insertRun).not.toHaveBeenCalled();
		expect(database.insertItems).not.toHaveBeenCalled();
	});

	it('reports ambiguities in dry-run and rejects apply and image preparation before side effects', async () => {
		const ambiguous: GiftIngestionManifest = {
			...manifest,
			ambiguities: [{ itemId: 'item-1', field: 'price', reason: 'Two prices match.' }],
		};
		const database = store();
		const dryRun = await processGiftIngestion(ambiguous, {
			apply: false,
			config,
			store: database,
		});
		expect(dryRun.ambiguities).toEqual(ambiguous.ambiguities);
		await expect(
			processGiftIngestion(ambiguous, { apply: true, config, store: database }),
		).rejects.toMatchObject({ code: 'ambiguity' });
		const presign = vi.fn(async () => 'https://r2.example/signed');
		await expect(
			prepareGiftIngestionImages(ambiguous, { config, store: database, images: [], presign }),
		).rejects.toMatchObject({ code: 'ambiguity' });
		expect(database.transaction).not.toHaveBeenCalled();
		expect(presign).not.toHaveBeenCalled();
	});

	it('reports a changed reused manifest id during dry-run before image preparation', async () => {
		const database = store({ findRun: vi.fn(async () => ({ manifestHash: 'different' })) });
		const result = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: database,
		});

		expect(result.conflicts).toEqual([
			{ manifestId: 'batch-1', reason: 'manifest-content-changed' },
		]);
		expect(database.transaction).not.toHaveBeenCalled();
	});

	it('rejects fixed-target, exact identity, and archived mismatches before mutation', async () => {
		for (const [changedManifest, target] of [
			[{ ...manifest, wishlist: { ...manifest.wishlist, shortId: 'other' } }, undefined],
			[{ ...manifest, wishlist: { ...manifest.wishlist, title: 'Other' } }, undefined],
			[manifest, { status: 'archived' }],
		] as const) {
			const database = store(
				target === undefined
					? {}
					: {
							resolveTarget: vi.fn(async () => ({
								id: 'wishlist-db-id',
								shortId: 'fixed-list',
								title: 'Christmas',
								recipient: 'Rosie',
								status: target.status,
							})),
						},
			);
			await expect(
				processGiftIngestion(changedManifest, { apply: true, config, store: database }),
			).rejects.toThrow(/target|identity|archived/i);
			expect(database.appendGifts).not.toHaveBeenCalled();
		}
	});

	it('bounds warning count and message length', () => {
		const collector = new IngestionWarningCollector();
		for (let index = 0; index < 60; index += 1) {
			collector.add(`${index}:${'x'.repeat(400)}`);
		}
		expect(collector.values()).toHaveLength(50);
		expect(collector.values().every((warning) => warning.length <= 300)).toBe(true);
	});

	it('collects bounded metadata and image provenance warnings and replays them', async () => {
		const warningManifest: GiftIngestionManifest = {
			...manifest,
			manifestId: 'batch-warnings',
			items: [
				{
					...manifest.items[0]!,
					gift: {
						...manifest.items[0]!.gift,
						description: 'Mirrorless camera',
						price: 12_000,
						imageUrl: 'https://cdn.example/camera.png',
					},
					provenance: {
						...manifest.items[0]!.provenance,
						fields: { name: 'json-ld' },
						imageSource: { url: 'https://cdn.example/other.png', method: 'open-graph' },
					},
				},
			],
		};
		const database = store();
		const dryRun = await processGiftIngestion(warningManifest, {
			apply: false,
			config,
			store: database,
		});
		expect(dryRun.warnings).toEqual([
			'Item item-1: add metadata provenance for description, price.',
			'Item item-1: gift image URL differs from its image provenance URL.',
		]);

		const applyStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(warningManifest, { apply: true, config, store: applyStore });
		const recorded = (applyStore.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		const replayStore = store({
			findRun: vi.fn(async () => recorded),
		});
		const replay = await processGiftIngestion(warningManifest, {
			apply: false,
			config,
			store: replayStore,
		});
		expect(replay.warnings).toEqual(dryRun.warnings);
	});

	it('warns for both missing sides of image provenance without rejecting the plan', async () => {
		const items: GiftIngestionManifest['items'] = [
			{
				...manifest.items[0]!,
				itemId: 'image-without-provenance',
				gift: {
					...manifest.items[0]!.gift,
					imageUrl: 'https://cdn.example/camera.png',
				},
			},
			{
				...manifest.items[0]!,
				itemId: 'provenance-without-image',
				sourceUrl: 'https://shop.example/book',
				gift: {
					...manifest.items[0]!.gift,
					name: 'Book',
					links: [{ url: 'https://shop.example/book' }],
				},
				provenance: {
					...manifest.items[0]!.provenance,
					imageSource: { url: 'https://cdn.example/book.png', method: 'json-ld' },
				},
			},
		];
		const result = await processGiftIngestion(
			{ ...manifest, manifestId: 'batch-image-warnings', items },
			{ apply: false, config, store: store() },
		);
		expect(result.wouldCreate).toHaveLength(2);
		expect(result.warnings).toEqual([
			'Item image-without-provenance: image URL is present but image provenance is missing.',
			'Item provenance-without-image: image provenance is present but the gift image URL is missing.',
		]);
	});

	it('rejects duplicate canonical source URLs newly planned within one manifest', async () => {
		const duplicateManifest: GiftIngestionManifest = {
			...manifest,
			items: [
				manifest.items[0]!,
				{
					...manifest.items[0]!,
					itemId: 'item-2',
					sourceUrl: 'https://www.shop.example/camera?ref=agent#details',
				},
			],
		};

		const result = await processGiftIngestion(duplicateManifest, {
			apply: false,
			config,
			store: store(),
		});

		expect(result.wouldCreate).toEqual([{ itemId: 'item-1', name: 'Camera' }]);
		expect(result.skipped).toEqual([{ itemId: 'item-2', reason: 'existing-source-url' }]);
	});
});
