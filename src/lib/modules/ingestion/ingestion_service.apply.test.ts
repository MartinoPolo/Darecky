import { describe, expect, it, vi } from 'vitest';
import { canonicalGiftIngestionItemHash, processGiftIngestion } from './ingestion_service.js';
import type { GiftIngestionManifest } from './manifest.js';
import { config, manifest, store } from './ingestion_service.test_fixtures.js';

describe('gift ingestion apply and replay', () => {
	it('appends through the shared transaction once and records gift audit atomically', async () => {
		const database = store();
		const result = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: database,
		});

		expect(database.transaction).toHaveBeenCalledOnce();
		expect(database.appendGifts).toHaveBeenCalledOnce();
		expect(database.appendGifts).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				wishlistId: 'wishlist-db-id',
				actorId: 'machine-actor',
				gifts: [
					expect.objectContaining({ name: 'Camera', priorityLevelId: 'priority-high' }),
				],
			}),
		);
		expect(database.insertItems).toHaveBeenCalledWith(expect.anything(), 'run-1', [
			expect.objectContaining({
				itemId: 'item-1',
				createdGiftId: 'gift-1',
				provenance: manifest.items[0]!.provenance,
			}),
		]);
		expect(result).toMatchObject({
			mode: 'apply',
			created: [{ itemId: 'item-1', giftId: 'gift-1' }],
		});
	});

	it('persists source-skipped identities and reuses their null audit identity safely', async () => {
		const firstStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(manifest, { apply: true, config, store: firstStore });
		const inserted = (firstStore.insertItems as ReturnType<typeof vi.fn>).mock.calls[0]![2] as {
			itemId: string;
			itemHash: string;
			createdGiftId: string | null;
		}[];
		expect(inserted).toEqual([
			expect.objectContaining({ itemId: 'item-1', createdGiftId: null }),
		]);

		const priorItem = inserted[0]!;
		const reuseStore = store({
			findItems: vi.fn(async () => [priorItem]),
			findExistingSourceKeys: vi.fn(async () => new Set<string>()),
		});
		const reused = await processGiftIngestion(
			{ ...manifest, manifestId: 'batch-2' },
			{ apply: true, config, store: reuseStore },
		);
		expect(reused.skipped).toEqual([{ itemId: 'item-1', reason: 'existing-source-url' }]);
		expect(reused.alreadyApplied).toEqual([]);
		expect(reuseStore.insertItems).toHaveBeenCalledWith(expect.anything(), 'run-1', []);

		const changed = {
			...manifest,
			manifestId: 'batch-3',
			items: manifest.items.map((item) => ({
				...item,
				gift: { ...item.gift, name: 'Changed camera' },
			})),
		};
		const conflict = await processGiftIngestion(changed, {
			apply: false,
			config,
			store: reuseStore,
		});
		expect(conflict.conflicts).toEqual([{ itemId: 'item-1', reason: 'item-content-changed' }]);
	});

	it('records no-op applies and rejects a changed hash for an existing manifest id', async () => {
		const noOpStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(manifest, { apply: true, config, store: noOpStore });
		expect(noOpStore.insertRun).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				result: expect.objectContaining({ created: [], skipped: expect.any(Array) }),
			}),
		);

		const recorded = (noOpStore.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		(noOpStore.findRun as ReturnType<typeof vi.fn>).mockResolvedValue({
			manifestHash: recorded.manifestHash,
			result: recorded.result,
		});
		const replay = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: noOpStore,
		});
		expect(replay.skipped).toHaveLength(1);
		expect(noOpStore.insertRun).toHaveBeenCalledOnce();

		await expect(
			processGiftIngestion(
				{
					...manifest,
					items: manifest.items.map((item) => ({
						...item,
						gift: { ...item.gift, name: 'Changed camera' },
					})),
				},
				{ apply: true, config, store: noOpStore },
			),
		).rejects.toThrow(/idempotency conflict/i);
	});

	it('does not append when the target cannot be locked for apply', async () => {
		const database = store({
			lockTarget: vi.fn(async () => {
				throw new Error('target disappeared before lock');
			}),
		});

		await expect(
			processGiftIngestion(manifest, { apply: true, config, store: database }),
		).rejects.toThrow(/before lock/);
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(database.insertRun).not.toHaveBeenCalled();
	});

	it('persists prior-applied identities and restores them with newly created identities on replay', async () => {
		const mixedManifest: GiftIngestionManifest = {
			...manifest,
			manifestId: 'batch-mixed',
			items: [
				manifest.items[0]!,
				{
					...manifest.items[0]!,
					itemId: 'item-2',
					sourceUrl: 'https://shop.example/book',
					gift: {
						...manifest.items[0]!.gift,
						name: 'Book',
						links: [{ url: 'https://shop.example/book' }],
					},
				},
			],
		};
		const priorHash = await canonicalGiftIngestionItemHash(mixedManifest.items[0]!);
		const database = store({
			findItems: vi.fn(async () => [
				{ itemId: 'item-1', itemHash: priorHash, createdGiftId: 'gift-prior' },
			]),
			appendGifts: vi.fn(async () => [{ id: 'gift-new' }]),
		});

		const first = await processGiftIngestion(mixedManifest, {
			apply: true,
			config,
			store: database,
		});
		expect(first.alreadyApplied).toEqual([{ itemId: 'item-1', giftId: 'gift-prior' }]);
		expect(first.created).toEqual([{ itemId: 'item-2', giftId: 'gift-new' }]);
		const recorded = (database.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		expect(recorded.result).toMatchObject({
			alreadyApplied: [{ itemId: 'item-1', giftId: 'gift-prior' }],
			created: [{ itemId: 'item-2', giftId: 'gift-new' }],
		});

		(database.findRun as ReturnType<typeof vi.fn>).mockResolvedValue({
			manifestHash: recorded.manifestHash,
			result: recorded.result,
		});
		const dryRun = await processGiftIngestion(mixedManifest, {
			apply: false,
			config,
			store: database,
		});
		const apply = await processGiftIngestion(mixedManifest, {
			apply: true,
			config,
			store: database,
		});
		const replayed = [
			{ itemId: 'item-1', giftId: 'gift-prior' },
			{ itemId: 'item-2', giftId: 'gift-new' },
		];
		expect(dryRun.alreadyApplied).toEqual(replayed);
		expect(apply.alreadyApplied).toEqual(replayed);
		expect(database.appendGifts).toHaveBeenCalledOnce();
	});

	it('restores a stored no-op replay despite later source-state changes in dry-run and apply', async () => {
		const first = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(manifest, { apply: true, config, store: first });
		const recorded = (first.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		const replayStore = store({
			findRun: vi.fn(async () => ({
				manifestHash: recorded.manifestHash,
				result: recorded.result,
			})),
			findExistingSourceKeys: vi.fn(async () => new Set<string>()),
		});

		const dryRun = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: replayStore,
		});
		const apply = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: replayStore,
		});

		expect(dryRun.skipped).toEqual([{ itemId: 'item-1', reason: 'existing-source-url' }]);
		expect(apply.skipped).toEqual(dryRun.skipped);
		expect(dryRun.wouldCreate).toEqual([]);
		expect(apply.wouldCreate).toEqual([]);
		expect(replayStore.appendGifts).not.toHaveBeenCalled();
	});

	it('returns identical replays, rejects changed item IDs, and skips canonical source duplicates', async () => {
		const replayStore = store({
			findItems: vi.fn(async () => [
				{ itemId: 'item-1', itemHash: 'MATCH', createdGiftId: 'gift-old' },
			]),
		});
		const itemHash = await canonicalGiftIngestionItemHash(manifest.items[0]!);
		(replayStore.findItems as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ itemId: 'item-1', itemHash, createdGiftId: 'gift-old' },
		]);
		const replay = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: replayStore,
		});
		expect(replay.alreadyApplied).toEqual([{ itemId: 'item-1', giftId: 'gift-old' }]);
		expect(replayStore.appendGifts).not.toHaveBeenCalled();

		const conflictStore = store({
			findItems: vi.fn(async () => [
				{ itemId: 'item-1', itemHash: 'changed', createdGiftId: 'gift-old' },
			]),
		});
		await expect(
			processGiftIngestion(manifest, { apply: true, config, store: conflictStore }),
		).rejects.toThrow(/conflict/i);
		expect(conflictStore.transaction).toHaveBeenCalledOnce();
		expect(conflictStore.appendGifts).not.toHaveBeenCalled();

		const duplicateStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		const duplicate = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: duplicateStore,
		});
		expect(duplicate.skipped).toEqual([
			expect.objectContaining({ itemId: 'item-1', reason: 'existing-source-url' }),
		]);
		expect(duplicate.wouldCreate).toEqual([]);
	});
});
