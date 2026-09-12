import { describe, expect, it } from 'vitest';
import { getInitials } from './initials.js';

describe('getInitials', () => {
	it.each([
		['Jana Dvořáková', 'JD'],
		['Martin', 'M'],
		['Anna Marie Nováková', 'AM'],
		['Jana  Dvořáková', 'JD'],
		['', ''],
	])('derives the avatar fallback for %j', (name, expected) => {
		expect(getInitials(name)).toBe(expected);
	});
});
