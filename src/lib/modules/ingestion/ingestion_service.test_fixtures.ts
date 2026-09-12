import { vi } from 'vitest';
import type { GiftIngestionStore } from './ingestion_service.js';
import type { GiftIngestionManifest } from './manifest.js';

export const manifest: GiftIngestionManifest = {
	schemaVersion: 1,
	manifestId: 'batch-1',
	wishlist: { shortId: 'fixed-list', title: 'Christmas', recipient: 'Rosie' },
	items: [
		{
			itemId: 'item-1',
			sourceUrl: 'https://shop.example/camera?ref=agent',
			gift: {
				name: 'Camera',
				links: [{ url: 'https://shop.example/camera?ref=agent' }],
				currency: 'CZK',
				quantity: 1,
				priority: 'high',
			},
			provenance: { gatheredAt: '2026-08-08T10:00:00.000Z', fields: { name: 'json-ld' } },
		},
	],
};

export function store(overrides: Partial<GiftIngestionStore> = {}): GiftIngestionStore {
	return {
		transaction: vi.fn(async (work) => work({})),
		lockTarget: vi.fn(async () => undefined),
		resolveTarget: vi.fn(async () => ({
			id: 'wishlist-db-id',
			shortId: 'fixed-list',
			title: 'Christmas',
			recipient: 'Rosie',
			status: 'active',
		})),
		findRun: vi.fn(async () => null),
		findItems: vi.fn(async () => []),
		findExistingSourceKeys: vi.fn(async () => new Set<string>()),
		resolvePriorities: vi.fn(async () => ({
			high: 'priority-high',
			medium: 'priority-medium',
		})),
		appendGifts: vi.fn(async () => [{ id: 'gift-1' }]),
		insertRun: vi.fn(async () => 'run-1'),
		insertItems: vi.fn(async () => undefined),
		...overrides,
	};
}

export const config = { targetShortId: 'fixed-list', actorId: 'machine-actor' };
export const IMAGE_BODY = new Uint8Array(30).buffer;
export const IMAGE_SHA256 = '0679246d6c4216de0daa08e5523fb2674db2b6599c3b72ff946b488a15290b62';
export const imageManifest: GiftIngestionManifest = {
	...manifest,
	items: manifest.items.map((item) => ({
		...item,
		gift: { ...item.gift, imageUrl: 'https://cdn.example/camera.png' },
	})),
};
