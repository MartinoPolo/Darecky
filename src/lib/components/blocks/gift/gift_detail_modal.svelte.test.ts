import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';

// Same stub as gift_detail_form.svelte.test.ts: the images module barrel reads
// `$env/dynamic/public`, which vitest-browser-svelte's bare document doesn't seed.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDetailModal } = await import('./GiftDetailModal.svelte');

function makeGift(overrides: Partial<GiftByRole> = {}): GiftByRole {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Ledové království',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 300,
		priceMax: null,
		currency: 'CZK',
		imageUrl: '',
		imageKey: '',
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		...overrides,
	};
}

const baseProps = {
	open: true,
	wishlistId: 'wishlist-1',
	priorityLevels: [],
	postShareLocked: false,
	canDelete: false,
	isSubmitting: false,
	isDeleting: false,
};

describe('GiftDetailModal focus contract', () => {
	it.each([
		{ name: 'desktop', width: 1280, height: 800 },
		{ name: 'mobile', width: 390, height: 844 },
	])('owns focus without opening the $name text editor', async ({ width, height }) => {
		await page.viewport(width, height);
		const onclose = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onclose,
		});

		const dialog = screen.getByRole('dialog').element() as HTMLDivElement;
		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() }).element();
		await expect.poll(() => document.activeElement).toBe(dialog);
		expect(nameInput).not.toBe(document.activeElement);

		await userEvent.tab();
		expect(dialog.contains(document.activeElement)).toBe(true);
		expect(document.activeElement).not.toBe(dialog);

		await userEvent.keyboard('{Escape}');
		expect(onclose).toHaveBeenCalledOnce();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});
});

describe('GiftDetailModal form identity (2026-08-04 data-corruption incident)', () => {
	// The `?gift=` deep-link effect can legitimately flip the modal from create to edit
	// while it is open. The form must NOT carry typed field state across that swap:
	// retained values would be submitted as an update to the OTHER gift, silently
	// overwriting it (this renamed a reserved production gift). The {#key} on
	// mode + gift id forces a remount, so the edit form reseeds from the gift row.
	it('reseeds the form when mode/gift swap under an open modal', async () => {
		const oncreate = vi.fn();
		const onupdate = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			oncreate,
			onupdate,
		});

		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Králík je taky jenom člověk');
		await expect.element(nameInput).toHaveValue('Králík je taky jenom člověk');

		await screen.rerender({ mode: 'edit' as const, gift: makeGift() });

		// Remounted + reseeded: the typed create-mode value must be gone.
		const reseededNameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await expect.element(reseededNameInput).toHaveValue('Ledové království');

		// Submitting now sends the gift's own data — never the retained typed values.
		// Desktop and mobile footers each render a submit button; either proves the point.
		await screen.getByRole('button', { name: m.save() }).first().click();
		expect(oncreate).not.toHaveBeenCalled();
		expect(onupdate).toHaveBeenCalledOnce();
		expect(onupdate.mock.calls[0]![0]).toMatchObject({
			id: 'gift-1',
			name: 'Ledové království',
		});
	});
});
