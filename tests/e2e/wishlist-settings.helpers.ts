import { expect, type Page } from '@playwright/test';

/** The Details card form is the only one containing the description textarea. */
export function detailsForm(page: Page) {
	return page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Popis' }) });
}

export function shortIdFromPath(path: string): string {
	const id = path.split('/').filter(Boolean).pop();
	expect(id, 'wishlist short id present in path').toBeTruthy();
	return id!;
}
