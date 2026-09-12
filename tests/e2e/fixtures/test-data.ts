import { randomUUID } from 'node:crypto';

export function uniqueEmail(prefix: string): string {
	return `e2e-${prefix}-${randomUUID()}@test.prejemesi.cz`;
}

export const TEST_PASSWORD = 'TestPassword123!';

export function createTestUser(role: string) {
	return {
		name: `E2E ${role}`,
		email: uniqueEmail(role),
		password: TEST_PASSWORD,
	};
}

export const TEST_WISHLIST = {
	title: 'E2E Testovaci seznam',
};

export const TEST_GIFT = {
	name: 'Testovaci darek',
	url: 'https://example.com/gift',
	price: '500',
};

export const ANONYMOUS_RESERVER = {
	name: 'Anonymni Jan',
	email: 'anon@test.prejemesi.cz',
};
