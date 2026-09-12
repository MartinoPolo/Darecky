import { describe, expect, it } from 'vitest';
import { ROW_STATUS, deriveRowStatus, headerSelectionState } from './draft_grid.js';

describe('deriveRowStatus', () => {
	it.each(['', '   '])('treats touched blank name %j as an error', (name) => {
		expect(deriveRowStatus({ name, isDuplicate: false, pristine: false })).toBe(
			ROW_STATUS.error,
		);
	});

	it('keeps a blank pristine row neutral', () => {
		expect(deriveRowStatus({ name: '', isDuplicate: false, pristine: true })).toBe(
			ROW_STATUS.neutral,
		);
	});

	it('a named duplicate row is duplicate', () => {
		expect(deriveRowStatus({ name: 'Hrnek', isDuplicate: true, pristine: false })).toBe(
			ROW_STATUS.duplicate,
		);
	});

	it('a named, non-duplicate row is ready', () => {
		expect(deriveRowStatus({ name: 'Hrnek', isDuplicate: false, pristine: false })).toBe(
			ROW_STATUS.ready,
		);
	});

	it('error takes precedence over duplicate (blank name wins)', () => {
		expect(deriveRowStatus({ name: '', isDuplicate: true, pristine: false })).toBe(
			ROW_STATUS.error,
		);
	});

	it('a named row is never neutral even when pristine', () => {
		expect(deriveRowStatus({ name: 'Kniha', isDuplicate: false, pristine: true })).toBe(
			ROW_STATUS.ready,
		);
	});

	it('a pristine blank row stays neutral even if flagged duplicate', () => {
		// The pristine (untouched) check runs before duplicate, so an untouched
		// starter row never shows an orange tint.
		expect(deriveRowStatus({ name: '', isDuplicate: true, pristine: true })).toBe(
			ROW_STATUS.neutral,
		);
	});
});

describe('headerSelectionState', () => {
	it.each([
		[[], 'none'],
		[[{ selected: false }, { selected: false }], 'none'],
		[[{ selected: true }, { selected: false }], 'some'],
		[[{ selected: true }, { selected: true }], 'all'],
	] as const)('derives %s selection as %s', (rows, expected) => {
		expect(headerSelectionState(rows)).toBe(expected);
	});
});
